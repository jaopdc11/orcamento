import { api } from '@/lib/api'
import type { Categoria, Convite, Especie, Membro, Orcamento } from '@/lib/tipos'

/** Os orçamentos que você participa. A API já filtra pelos seus. */
export function meusOrcamentos(): Promise<Orcamento[]> {
  return api.get('/orcamentos')
}

export function membrosDo(ledgerId: string): Promise<Membro[]> {
  return api.get(`/orcamentos/${ledgerId}/membros`)
}

export async function criarOrcamento(nome: string, apelido?: string): Promise<string> {
  const { id } = await api.post<{ id: string }>('/orcamentos', { nome, apelido: apelido ?? null })
  return id
}

export async function criarConvite(ledgerId: string): Promise<string> {
  const { code } = await api.post<{ code: string }>(`/orcamentos/${ledgerId}/convites`)
  return code
}

/**
 * Devolve o id do orçamento em que você entrou.
 * Idempotente: aceitar duas vezes não duplica nem dá erro.
 */
export async function aceitarConvite(codigo: string): Promise<string> {
  const { ledgerId } = await api.post<{ ledgerId: string }>('/convites/aceitar', { codigo })
  return ledgerId
}

/** Convites pendentes (não usados e não vencidos) do orçamento. */
export function convitesPendentes(ledgerId: string): Promise<Convite[]> {
  return api.get(`/orcamentos/${ledgerId}/convites`)
}

export async function cancelarConvite(code: string): Promise<void> {
  await api.del(`/convites/${encodeURIComponent(code)}`)
}

/** Sair é sempre de si mesmo: a API usa a sessão, o usuarioId fica só pela assinatura antiga. */
export async function sairDoOrcamento(ledgerId: string, _usuarioId: string): Promise<void> {
  await api.del(`/orcamentos/${ledgerId}/membros/eu`)
}

/** 'ABCD1234' → 'ABCD-1234'. Só apresentação; a API normaliza o que receber. */
export function formatarCodigo(code: string): string {
  return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code
}

// --- F2: config do orçamento ---------------------------------------------------

export function renomearOrcamento(ledgerId: string, nome: string): Promise<Orcamento> {
  return api.put(`/orcamentos/${ledgerId}`, { nome })
}

export function mudarMeuApelido(ledgerId: string, apelido: string | null): Promise<Membro> {
  return api.put(`/orcamentos/${ledgerId}/membros/eu`, { apelido })
}

/** Qualquer membro remove qualquer um (inclusive a si = sair). */
export async function removerMembro(ledgerId: string, userId: string): Promise<void> {
  await api.del(`/orcamentos/${ledgerId}/membros/${userId}`)
}

/** Inclui as arquivadas: a config precisa delas pra desarquivar. */
export function todasCategorias(ledgerId: string): Promise<Categoria[]> {
  return api.get(`/orcamentos/${ledgerId}/categorias?arquivadas=1`)
}

export type DadosCategoria = { nome: string; kind: Especie; emoji: string | null; cor: string | null }

export function criarCategoria(ledgerId: string, c: DadosCategoria): Promise<Categoria> {
  return api.post(`/orcamentos/${ledgerId}/categorias`, c)
}

export function editarCategoria(
  ledgerId: string,
  id: string,
  m: Partial<Omit<DadosCategoria, 'kind'>>,
): Promise<Categoria> {
  return api.put(`/orcamentos/${ledgerId}/categorias/${id}`, m)
}

export function reordenarCategorias(ledgerId: string, ids: string[]): Promise<Categoria[]> {
  return api.post(`/orcamentos/${ledgerId}/categorias/reordenar`, { ids })
}

export function arquivarCategoria(ledgerId: string, id: string, arquivar: boolean): Promise<Categoria> {
  return api.post(`/orcamentos/${ledgerId}/categorias/${id}/${arquivar ? 'arquivar' : 'desarquivar'}`)
}
