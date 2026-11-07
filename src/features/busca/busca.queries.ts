import { api } from '@/lib/api'
import type { Especie, ResultadoBusca } from '@/lib/tipos'

export type FiltroBusca = {
  q?: string
  category_id?: string
  membro?: string // 'eu' | user_id
  de?: string
  ate?: string
  kind?: Especie
  limite?: number
  cursor?: string
}

export function buscarLancamentos(ledgerId: string, f: FiltroBusca): Promise<ResultadoBusca> {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(f)) if (v !== undefined && v !== '') qs.set(k, String(v))
  return api.get<ResultadoBusca>(`/orcamentos/${ledgerId}/busca?${qs}`)
}
