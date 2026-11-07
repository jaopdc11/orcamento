import { api } from '@/lib/api'
import type { Economia, Lancamento } from '@/lib/tipos'

// As de limite por categoria moram em features/mes/mes.queries.ts (o Mes.tsx
// antigo também usa); re-exporto pra tela de Metas importar de um lugar só.
export { buscarMetas, copiarMetasDoMesAnterior, definirMeta } from '@/features/mes/mes.queries'

export function buscarEconomia(ledgerId: string, mes: string): Promise<Economia> {
  return api.get(`/orcamentos/${ledgerId}/economia?mes=${mes}`)
}

/** Alvo 0 remove a meta, igual ao limite de categoria. */
export function definirEconomia(ledgerId: string, mes: string, alvoCentavos: number): Promise<Economia> {
  return api.put(`/orcamentos/${ledgerId}/economia?mes=${mes}`, {
    target_cents: Math.max(0, alvoCentavos),
  })
}

export function buscarSerieEconomia(ledgerId: string, ate: string, meses = 6): Promise<Economia[]> {
  return api.get(`/orcamentos/${ledgerId}/economia/serie?ate=${ate}&meses=${meses}`)
}

/**
 * Gasto do mês por categoria, do orçamento inteiro (metas não têm escopo).
 * Lê a lista de lançamentos em vez de ter rota própria: o GET do mês já
 * materializa recorrentes, então o gasto bate com o que aparece no Dashboard.
 */
export async function gastoPorCategoria(ledgerId: string, mes: string): Promise<Map<string, number>> {
  const linhas = await api.get<Lancamento[]>(`/orcamentos/${ledgerId}/lancamentos?mes=${mes}`)
  const gasto = new Map<string, number>()
  for (const l of linhas) {
    if (l.deleted_at || l.kind !== 'expense' || !l.category_id) continue
    gasto.set(l.category_id, (gasto.get(l.category_id) ?? 0) + l.amount_cents)
  }
  return gasto
}
