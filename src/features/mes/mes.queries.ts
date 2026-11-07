import { api } from '@/lib/api'
import type { Meta } from '@/lib/tipos'

export function buscarMetas(ledgerId: string, mes: string): Promise<Meta[]> {
  return api.get(`/orcamentos/${ledgerId}/metas?mes=${mes}`)
}

/** Meta zerada é meta removida — o usuário "apaga" simplesmente limpando o campo. */
export async function definirMeta(
  ledgerId: string,
  categoryId: string,
  mes: string,
  limiteCentavos: number,
): Promise<void> {
  await api.put(`/orcamentos/${ledgerId}/metas/${categoryId}?mes=${mes}`, {
    limite_cents: Math.max(0, limiteCentavos),
  })
}

/**
 * Ninguém preenche 12 campos todo dia 1º. Copiar o mês anterior é o que faz
 * metas serem usadas de fato.
 */
export async function copiarMetasDoMesAnterior(ledgerId: string, mes: string): Promise<number> {
  const { copiadas } = await api.post<{ copiadas: number }>(
    `/orcamentos/${ledgerId}/metas/copiar?mes=${mes}`,
  )
  return copiadas
}
