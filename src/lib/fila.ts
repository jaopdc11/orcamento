import { api } from './api'
import type { LancamentoNovo } from './tipos'

// Fila de reenvio. Só INSERT — editar e apagar exigem rede, de propósito:
// o caso real de offline é lançar dentro do mercado, não editar. Só-insert
// elimina a classe inteira de bug de "reenvio tardio sobrescreve edição nova".
//
// localStorage, não IndexedDB: a fila nunca passa de alguns lançamentos.
//
// A idempotência NÃO vem daqui, vem do id UUIDv7 gerado no cliente + o
// ON CONFLICT DO NOTHING no POST /lancamentos. Reenviar a mesma linha duas
// vezes é inofensivo por construção.

const CHAVE = 'orcamento:fila:v1'

type Ouvinte = (pendentes: LancamentoNovo[]) => void
const ouvintes = new Set<Ouvinte>()
let enviando = false

export function lerFila(): LancamentoNovo[] {
  try {
    const cru = localStorage.getItem(CHAVE)
    return cru ? (JSON.parse(cru) as LancamentoNovo[]) : []
  } catch {
    // storage cheio, modo privado, JSON corrompido: fila vazia é melhor que crash.
    return []
  }
}

function gravarFila(itens: LancamentoNovo[]): void {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(itens))
  } catch {
    /* sem storage, o item vive só em memória até o flush */
  }
  ouvintes.forEach((fn) => fn(itens))
}

export function aoMudarFila(fn: Ouvinte): () => void {
  ouvintes.add(fn)
  fn(lerFila())
  return () => ouvintes.delete(fn)
}

/** Enfileira e tenta mandar na hora. Nunca lança: a UI não espera rede. */
export async function enfileirar(item: LancamentoNovo): Promise<void> {
  gravarFila([...lerFila(), item])
  await drenar()
}

/**
 * Tenta subir tudo que está pendente.
 *
 * A API devolve duas listas, e as duas saem da fila:
 *  - confirmados: gravados agora ou que já existiam num orçamento seu (reenvio duplicado)
 *  - rejeitados: nunca vão entrar (orçamento que você saiu, categoria de fora).
 *    Mantê-los seria loop eterno de reenvio.
 * Qualquer falha de rede/servidor mantém tudo na fila pro próximo gatilho.
 */
export async function drenar(): Promise<void> {
  if (enviando) return
  const pendentes = lerFila()
  if (pendentes.length === 0) return
  if (typeof navigator !== 'undefined' && !navigator.onLine) return

  enviando = true
  try {
    const { confirmados, rejeitados } = await api.post<{
      confirmados: string[]
      rejeitados: string[]
    }>('/lancamentos', pendentes)

    if (rejeitados.length > 0) {
      // eslint-disable-next-line no-console
      console.warn('[fila] lançamentos recusados pelo servidor e descartados:', rejeitados)
    }
    const resolvidos = new Set([...confirmados, ...rejeitados])
    gravarFila(lerFila().filter((p) => !resolvidos.has(p.id)))
  } catch {
    /* rede ou servidor: mantém na fila, tenta no próximo gatilho */
  } finally {
    enviando = false
  }
}

/**
 * Gatilhos de drenagem. Background Sync não existe no iOS, então não dá pra
 * contar com ele: sobra rede voltando e app ganhando foco.
 */
export function ligarDrenagemAutomatica(): () => void {
  const aoVoltarRede = () => void drenar()
  const aoVoltarFoco = () => {
    if (document.visibilityState === 'visible') void drenar()
  }

  window.addEventListener('online', aoVoltarRede)
  document.addEventListener('visibilitychange', aoVoltarFoco)
  void drenar()

  return () => {
    window.removeEventListener('online', aoVoltarRede)
    document.removeEventListener('visibilitychange', aoVoltarFoco)
  }
}
