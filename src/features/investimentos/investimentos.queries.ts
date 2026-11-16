import { api } from '@/lib/api'
import type { Carteira, Indexador, Investimento, Movimento, TipoInvestimento } from '@/lib/tipos'

export type NovoInvestimento = {
  nome: string
  tipo: TipoInvestimento
  ticker?: string | null
  indexador?: Indexador | null
  taxa?: number | null
}

export type EdicaoDeInvestimento = Partial<{
  nome: string
  ticker: string
  indexador: Indexador
  taxa: number
  valor_atual_cents: number
  arquivado: boolean
}>

export type NovoMovimento = {
  id: string
  tipo: 'aporte' | 'resgate'
  amount_cents: number
  quantidade: string | null
  occurred_on: string
  paid_by: string | null
}

const base = (ledgerId: string) => `/orcamentos/${ledgerId}/investimentos`

export const buscarCarteira = (ledgerId: string) => api.get<Carteira>(base(ledgerId))

export const criarInvestimento = (ledgerId: string, dados: NovoInvestimento) =>
  api.post<Investimento>(base(ledgerId), dados)

export const editarInvestimento = (ledgerId: string, id: string, mudancas: EdicaoDeInvestimento) =>
  api.put<Investimento>(`${base(ledgerId)}/${id}`, mudancas)

export const apagarInvestimento = (ledgerId: string, id: string) =>
  api.del<{ removido: true }>(`${base(ledgerId)}/${id}`)

export const listarMovimentos = (ledgerId: string, id: string) =>
  api.get<Movimento[]>(`${base(ledgerId)}/${id}/movimentos`)

export const registrarMovimento = (ledgerId: string, id: string, dados: NovoMovimento) =>
  api.post<Movimento>(`${base(ledgerId)}/${id}/movimentos`, dados)

export const apagarMovimento = (ledgerId: string, id: string, moveId: string) =>
  api.del<{ removido: true }>(`${base(ledgerId)}/${id}/movimentos/${moveId}`)
