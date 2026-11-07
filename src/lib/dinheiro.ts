// Dinheiro é SEMPRE bigint de centavos. Nenhum valor monetário existe como
// float neste app — ponto flutuante em dinheiro produz centavo fantasma
// (0.1 + 0.2 !== 0.3) e num somatório de orçamento isso aparece.

const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

/** 123456 → 'R$ 1.234,56' */
export function formatar(centavos: number): string {
  return brl.format(centavos / 100)
}

/** 123456 → '1.234,56' (sem o símbolo, pra alinhar coluna) */
export function formatarSeco(centavos: number): string {
  return brl.format(centavos / 100).replace(/^R\$\s*/, '')
}

/**
 * Digitação estilo caixa eletrônico: cada tecla empurra um dígito pela direita.
 * Não tem cursor, não tem vírgula pra errar, não tem como digitar '1.2.3'.
 * É o que permite lançar em 3 toques.
 */
export function empurrarDigito(centavos: number, tecla: string): number {
  const d = Number(tecla)
  if (!Number.isInteger(d) || tecla.length !== 1) return centavos
  const novo = centavos * 10 + d
  // teto de R$ 99.999.999,99 — evita estourar precisão e o layout.
  return novo > 9_999_999_999 ? centavos : novo
}

export function apagarDigito(centavos: number): number {
  return Math.floor(centavos / 10)
}

/**
 * Texto livre → centavos. Aceita '12', '12,5', '12.50', 'R$ 1.234,56'.
 * Usado só no formulário de edição; a tela de lançar usa empurrarDigito.
 */
export function paraCentavos(texto: string): number | null {
  const limpo = texto.replace(/[^\d,.-]/g, '').trim()
  if (!limpo) return null
  // Se tem vírgula, ela é o separador decimal e pontos são milhar (pt-BR).
  // Se não tem vírgula, um único ponto é decimal ('12.50').
  const normalizado = limpo.includes(',')
    ? limpo.replace(/\./g, '').replace(',', '.')
    : limpo
  const n = Number(normalizado)
  if (!Number.isFinite(n)) return null
  return Math.round(n * 100)
}
