// Tempo real: a API avisa "o orçamento mudou" por SSE e quem estiver na tela relê.
//
// Um EventSource por orçamento, compartilhado entre os componentes que ouvem
// (Mes e Dashboard montam juntos). Fecha quando o último sai.
//
// O EventSource reconecta sozinho. O celular derruba a conexão em segundo plano,
// e aí quem cobre é a releitura ao ganhar foco que o useMes já faz — evento
// perdido enquanto estava fechado não importa.

import { API_URL } from './api'

export type TipoEvento = 'lancamentos' | 'metas' | 'membros'
type Ouvinte = (tipo: TipoEvento) => void

const canais = new Map<string, { fonte: EventSource; ouvintes: Set<Ouvinte> }>()

export function ouvirOrcamento(ledgerId: string, fn: Ouvinte): () => void {
  if (typeof EventSource === 'undefined') return () => {}

  let canal = canais.get(ledgerId)
  if (!canal) {
    const fonte = new EventSource(`${API_URL}/orcamentos/${ledgerId}/eventos`, {
      withCredentials: true, // manda o cookie de sessão
    })
    const ouvintes = new Set<Ouvinte>()
    fonte.addEventListener('mudou', (e) => {
      const tipo = (e as MessageEvent).data as TipoEvento
      ouvintes.forEach((o) => o(tipo))
    })
    canal = { fonte, ouvintes }
    canais.set(ledgerId, canal)
  }

  canal.ouvintes.add(fn)
  const atual = canal
  return () => {
    atual.ouvintes.delete(fn)
    if (atual.ouvintes.size === 0) {
      atual.fonte.close()
      canais.delete(ledgerId)
    }
  }
}

/** Junta rajadas (ex.: a fila subindo 5 lançamentos) numa releitura só. */
export function comAtraso(fn: () => void, ms = 300): { chamar: () => void; cancelar: () => void } {
  let timer: ReturnType<typeof setTimeout> | undefined
  return {
    chamar: () => {
      clearTimeout(timer)
      timer = setTimeout(fn, ms)
    },
    cancelar: () => clearTimeout(timer),
  }
}
