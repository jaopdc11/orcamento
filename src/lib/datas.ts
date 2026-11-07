// Fuso: o Postgres do Supabase roda em UTC, o casal mora no Brasil.
// Toda função aqui existe pra impedir um off-by-one de um dia, que num app de
// orçamento vira "a compra de 31/01 sumiu do mês".
//
// PROIBIDO neste projeto:
//   new Date().toISOString().slice(0, 10)  → entre 21h e meia-noite adianta 1 dia
//   new Date('2026-01-31')                 → parseia como meia-noite UTC, exibe 30/01

/** Data de hoje no fuso do aparelho, como 'YYYY-MM-DD'. */
export function hoje(): string {
  // en-CA é o truque: já formata como YYYY-MM-DD, e usa o fuso local.
  return new Date().toLocaleDateString('en-CA')
}

/** 'YYYY-MM-DD' → Date na meia-noite LOCAL (não UTC). */
export function paraDataLocal(iso: string): Date {
  const [ano, mes, dia] = iso.split('-').map(Number)
  return new Date(ano, mes - 1, dia)
}

/** 'YYYY-MM-DD' → '31/01'. */
export function diaMes(iso: string): string {
  const [, mes, dia] = iso.split('-')
  return `${dia}/${mes}`
}

/** 'YYYY-MM-DD' → 'sábado, 31 de janeiro'. */
export function porExtenso(iso: string): string {
  return paraDataLocal(iso).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

/** 'YYYY-MM' do mês de uma data, ou do mês atual. */
export function mesDe(iso: string = hoje()): string {
  return iso.slice(0, 7)
}

/**
 * Intervalo semiaberto de um mês: [início, fim).
 * Usar sempre `occurred_on >= inicio and occurred_on < fim` — comparação
 * date × date é imune a fuso. Nunca fechar o mês por created_at.
 */
export function intervaloDoMes(mes: string): { inicio: string; fim: string } {
  const [ano, m] = mes.split('-').map(Number)
  const proximo = m === 12 ? `${ano + 1}-01` : `${ano}-${String(m + 1).padStart(2, '0')}`
  return { inicio: `${mes}-01`, fim: `${proximo}-01` }
}

/** 'YYYY-MM' → 'janeiro de 2026'. */
export function mesPorExtenso(mes: string): string {
  return paraDataLocal(`${mes}-01`).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  })
}

/** Mês anterior/seguinte, como 'YYYY-MM'. */
export function deslocarMes(mes: string, passos: number): string {
  const [ano, m] = mes.split('-').map(Number)
  const d = new Date(ano, m - 1 + passos, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
