import { api } from '@/lib/api'
import type { Acerto, Membro } from '@/lib/tipos'

// Normaliza porque a tela itera listas: resposta fora do formato (proxy,
// versão velha da API, mock) vira acerto vazio em vez de derrubar o React.
export async function buscarAcerto(ledgerId: string, mes: string): Promise<Acerto> {
  const a = (await api.get(`/orcamentos/${ledgerId}/acerto?mes=${mes}`)) as Partial<Acerto> | null
  return {
    mes: a?.mes ?? mes,
    total_cents: typeof a?.total_cents === 'number' ? a.total_cents : 0,
    membros: Array.isArray(a?.membros) ? a.membros : [],
    transferencias: Array.isArray(a?.transferencias) ? a.transferencias : [],
  }
}

export function salvarProporcoes(
  ledgerId: string,
  proporcoes: { user_id: string; proporcao: number }[],
): Promise<Membro[]> {
  return api.put(`/orcamentos/${ledgerId}/acerto/proporcoes`, { proporcoes })
}
