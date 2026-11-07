import { api } from '@/lib/api'
import type { Categoria, EdicaoLancamento, Lancamento } from '@/lib/tipos'

export function buscarCategorias(ledgerId: string): Promise<Categoria[]> {
  return api.get(`/orcamentos/${ledgerId}/categorias`)
}

/**
 * Os lançamentos de um mês. É a única leitura que o app faz pra "sincronizar":
 * não é diff nem merge, é reler. Um mês de casal são centenas de linhas.
 *
 * O servidor filtra por intervalo semiaberto de datas (date × date): imune a fuso.
 */
export function buscarLancamentosDoMes(ledgerId: string, mes: string): Promise<Lancamento[]> {
  return api.get(`/orcamentos/${ledgerId}/lancamentos?mes=${mes}`)
}

/** Apagar é soft delete: o histórico é o ativo, e estorno é linha nova negativa. */
export async function arquivarLancamento(id: string): Promise<void> {
  await api.del(`/lancamentos/${id}`)
}

/**
 * Editar é só online: a fila offline é só-INSERT de propósito (reenviar um
 * INSERT é idempotente pelo id; reenviar uma edição velha atropelaria a do outro).
 */
export function editarLancamento(id: string, mudancas: EdicaoLancamento): Promise<Lancamento> {
  return api.put(`/lancamentos/${id}`, mudancas)
}
