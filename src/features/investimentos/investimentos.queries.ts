import { api } from '@/lib/api'
import type {
  Carteira,
  Indexador,
  Investimento,
  MetaAporte,
  Movimento,
  Pendencia,
  PontoCarteira,
  RecorrenteInvestimento,
  TipoInvestimento,
} from '@/lib/tipos'

export type NovoInvestimento = {
  nome: string
  tipo: TipoInvestimento
  ticker?: string | null
  indexador?: Indexador | null
  taxa?: number | null
  recorrente?: RecorrenteInvestimento | null
}

export type EdicaoDeInvestimento = Partial<{
  nome: string
  ticker: string
  indexador: Indexador
  taxa: number
  valor_atual_cents: number
  recorrente: RecorrenteInvestimento | null
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

/** Leva junto movimentações, pendências e os lançamentos delas. */
export const apagarInvestimento = (ledgerId: string, id: string) =>
  api.del<{ removido: true; lancamentos: number }>(`${base(ledgerId)}/${id}`)

export const listarMovimentos = (ledgerId: string, id: string) =>
  api.get<Movimento[]>(`${base(ledgerId)}/${id}/movimentos`)

export const registrarMovimento = (ledgerId: string, id: string, dados: NovoMovimento) =>
  api.post<Movimento>(`${base(ledgerId)}/${id}/movimentos`, dados)

export const apagarMovimento = (ledgerId: string, id: string, moveId: string) =>
  api.del<{ removido: true }>(`${base(ledgerId)}/${id}/movimentos/${moveId}`)

export const confirmarPendencia = (
  ledgerId: string,
  id: string,
  ajuste: { quantidade?: string | null; amount_cents?: number | null } = {},
) => api.post<Pendencia>(`${base(ledgerId)}/pendencias/${id}/confirmar`, ajuste)

export const recusarPendencia = (ledgerId: string, id: string) =>
  api.post<{ recusada: true }>(`${base(ledgerId)}/pendencias/${id}/recusar`)

export const buscarMetaAporte = (ledgerId: string, mes: string) =>
  api.get<MetaAporte>(`${base(ledgerId)}/meta?mes=${mes}`)

/** alvo 0 remove a meta. */
export const definirMetaAporte = (ledgerId: string, mes: string, alvo_cents: number) =>
  api.put<MetaAporte>(`${base(ledgerId)}/meta?mes=${mes}`, { alvo_cents })

export const buscarEvolucao = (ledgerId: string, dias: number) =>
  api.get<PontoCarteira[]>(`${base(ledgerId)}/evolucao?dias=${dias}`)
