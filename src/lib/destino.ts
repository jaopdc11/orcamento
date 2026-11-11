// Destino aberto por um aviso tocado: orçamento + mês + tela (Metas para aviso de
// meta; Início para lançamento e recorrente).
// Chega por três caminhos:
// - URL `/?orcamento=<id>&mes=AAAA-MM` (abertura fria pelo toque na notificação);
// - mensagem do service worker (Web Push com o app já aberto numa aba);
// - evento `orcamento:abrir` disparado pelo app Android com o site já carregado.

export type Tela = 'metas' | 'inicio'
/** `lancamentoId`: aviso de um lançamento só; o Início abre a ficha dele. */
export type Destino = { ledgerId: string; mes: string; tela: Tela; lancamentoId?: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MES = /^\d{4}-(0[1-9]|1[0-2])$/

export function destinoValido(d: unknown): Destino | null {
  if (!d || typeof d !== 'object') return null
  const { ledgerId, mes, tela, lancamentoId } = d as Record<string, unknown>
  if (typeof ledgerId !== 'string' || !UUID.test(ledgerId) || typeof mes !== 'string' || !MES.test(mes)) return null
  // aviso antigo (sem tela) era sempre de meta
  const t: Tela = tela === 'inicio' ? 'inicio' : 'metas'
  return typeof lancamentoId === 'string' && UUID.test(lancamentoId) && t === 'inicio'
    ? { ledgerId, mes, tela: t, lancamentoId }
    : { ledgerId, mes, tela: t }
}

/** Lê o destino da URL uma vez e limpa a barra de endereço (recarregar não reabre). */
export function destinoDaUrl(): Destino | null {
  if (typeof window === 'undefined') return null
  const p = new URLSearchParams(window.location.search)
  const d = destinoValido({ ledgerId: p.get('orcamento'), mes: p.get('mes'), tela: p.get('tela'), lancamentoId: p.get('lancamento') })
  if (p.has('orcamento') || p.has('mes')) {
    p.delete('orcamento')
    p.delete('mes')
    p.delete('tela')
    p.delete('lancamento')
    const resto = p.toString()
    history.replaceState(history.state, '', window.location.pathname + (resto ? `?${resto}` : '') + window.location.hash)
  }
  return d
}

/** Destinos que chegam com o app já aberto. Devolve a função que para de ouvir. */
export function ouvirDestinos(aoAbrir: (d: Destino) => void): () => void {
  const doEvento = (e: Event) => {
    const d = destinoValido((e as CustomEvent).detail)
    if (d) aoAbrir(d)
  }
  const doSw = (e: MessageEvent) => {
    if (e.data?.tipo !== 'abrir') return
    const d = destinoValido(e.data)
    if (d) aoAbrir(d)
  }
  window.addEventListener('orcamento:abrir', doEvento)
  navigator.serviceWorker?.addEventListener('message', doSw)
  return () => {
    window.removeEventListener('orcamento:abrir', doEvento)
    navigator.serviceWorker?.removeEventListener('message', doSw)
  }
}
