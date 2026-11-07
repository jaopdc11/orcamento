import { api } from '@/lib/api'
import type { Especie, Recorrente } from '@/lib/tipos'

export type DadosRecorrente = {
  descricao: string
  amount_cents: number
  kind: Especie
  category_id: string | null
  paid_by: string | null
  dia_do_mes: number
  ativo?: boolean
  inicio?: string
}

const base = (ledgerId: string) => `/orcamentos/${ledgerId}/recorrentes`

export const listarRecorrentes = (ledgerId: string) => api.get<Recorrente[]>(base(ledgerId))

export const criarRecorrente = (ledgerId: string, dados: DadosRecorrente) =>
  api.post<Recorrente>(base(ledgerId), dados)

export const editarRecorrente = (ledgerId: string, id: string, mudancas: Partial<DadosRecorrente>) =>
  api.put<Recorrente>(`${base(ledgerId)}/${id}`, mudancas)

export const apagarRecorrente = (ledgerId: string, id: string) =>
  api.del<{ removido: true }>(`${base(ledgerId)}/${id}`)
