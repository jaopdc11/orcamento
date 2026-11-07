import { api } from '@/lib/api'
import type { EntidadeAtividade, PaginaHistorico } from '@/lib/tipos'

export function buscarHistorico(
  ledgerId: string,
  filtro: { antes?: string | null; limite?: number; entidade?: EntidadeAtividade; entidadeId?: string } = {},
): Promise<PaginaHistorico> {
  const q = new URLSearchParams()
  if (filtro.antes) q.set('antes', filtro.antes)
  if (filtro.limite) q.set('limite', String(filtro.limite))
  if (filtro.entidade) q.set('entidade', filtro.entidade)
  if (filtro.entidadeId) q.set('entidade_id', filtro.entidadeId)
  const s = q.toString()
  return api.get(`/orcamentos/${ledgerId}/historico${s ? `?${s}` : ''}`)
}
