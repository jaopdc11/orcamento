import type { Categoria } from './tipos'

type LinhaExportavel = {
  occurred_on: string
  kind: 'expense' | 'income'
  amount_cents: number
  descricao: string | null
  category_id: string | null
}

/**
 * Escapa um campo de CSV. Descrição é texto livre digitado por gente: aspas,
 * ponto e vírgula e quebra de linha aparecem, e sem escapar o arquivo sai torto.
 *
 * A vírgula NÃO entra aqui: o separador é ';' e a vírgula é o decimal. Escapar
 * vírgula poria todo valor monetário entre aspas, e campo com aspas o Excel lê
 * como texto — matando justamente a soma que a pessoa foi fazer na planilha.
 */
function campo(valor: string): string {
  return /[";\n\r]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor
}

/**
 * Valor em formato que o Brasil lê: vírgula decimal. Sem símbolo de moeda —
 * planilha nenhuma gosta de "R$" dentro de célula numérica.
 */
function valorBr(centavos: number): string {
  const sinal = centavos < 0 ? '-' : ''
  const abs = Math.abs(centavos)
  return `${sinal}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, '0')}`
}

export function gerarCsv(
  linhas: readonly LinhaExportavel[],
  categorias: ReadonlyMap<string, Categoria>,
): string {
  const cabecalho = ['data', 'tipo', 'categoria', 'descricao', 'valor']
  // Ponto e vírgula: é o que o Excel pt-BR espera, já que a vírgula é decimal.
  const corpo = linhas.map((l) =>
    [
      l.occurred_on,
      l.kind === 'income' ? 'entrada' : 'saida',
      (l.category_id ? categorias.get(l.category_id)?.nome : '') ?? '',
      l.descricao ?? '',
      valorBr(l.kind === 'income' ? l.amount_cents : -l.amount_cents),
    ]
      .map(campo)
      .join(';'),
  )
  return [cabecalho.join(';'), ...corpo].join('\r\n')
}

export function baixarCsv(
  linhas: readonly LinhaExportavel[],
  categorias: ReadonlyMap<string, Categoria>,
  mes: string,
  nomeOrcamento: string,
): void {
  const csv = gerarCsv(linhas, categorias)
  // BOM: sem ele o Excel no Windows abre "Alimentação" como "AlimentaÃ§Ã£o".
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = `${nomeOrcamento.replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase()}-${mes}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
