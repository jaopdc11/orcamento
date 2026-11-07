import { useEffect, useRef } from 'react'

// Atalhos de teclado (PC). Regras pra não atrapalhar quem está digitando:
//   - com foco num campo de texto, só passam as teclas listadas em `mesmoDigitando`
//   - Ctrl/Cmd/Alt nunca são capturados (copiar, colar, atalhos do navegador)
//   - atalho "global" é ignorado se houver um diálogo (Sheet) aberto: ele tem os seus

export type MapaAtalhos = Record<string, (e: KeyboardEvent) => void>

export function digitandoEm(alvo: EventTarget | null): boolean {
  const el = alvo as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

export function haDialogoAberto(): boolean {
  return document.querySelector('[role="dialog"]') !== null
}

export function useAtalhos(
  mapa: MapaAtalhos,
  {
    ativo = true,
    global = false,
    mesmoDigitando = [],
  }: { ativo?: boolean; global?: boolean; mesmoDigitando?: string[] } = {},
) {
  // ref: o mapa muda a cada render (closures novas) sem re-registrar o listener
  const ref = useRef(mapa)
  ref.current = mapa

  useEffect(() => {
    if (!ativo) return
    function aoTeclar(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return
      if (global && haDialogoAberto()) return
      if (digitandoEm(e.target) && !mesmoDigitando.includes(e.key)) return
      const fn = ref.current[e.key] ?? ref.current[e.key.toLowerCase()]
      if (!fn) return
      e.preventDefault()
      fn(e)
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
    // mesmoDigitando é literal estável nos usos; o join evita re-registro por identidade
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, global, mesmoDigitando.join('|')])
}

/** Lista exibida na ajuda (tecla ?). Fonte única: mude aqui ao mexer nos atalhos. */
export const AJUDA_ATALHOS: { grupo: string; itens: [string, string][] }[] = [
  {
    grupo: 'Em qualquer tela',
    itens: [
      ['N', 'Novo lançamento'],
      ['1 2 3 4', 'Início · Mês · Análises · Mais'],
      ['/', 'Busca'],
      ['O', 'Trocar de orçamento'],
      ['V', 'Ocultar / mostrar valores'],
      ['T', 'Tema claro / escuro'],
      ['?', 'Esta ajuda'],
      ['Esc', 'Fechar / voltar'],
    ],
  },
  {
    grupo: 'Lançando',
    itens: [
      ['0–9', 'Digitar o valor'],
      ['⌫', 'Apagar dígito'],
      ['S  E', 'Saiu · Entrou'],
      ['← → ↑ ↓', 'Escolher categoria'],
      ['D', 'Ir pra descrição'],
      ['Enter', 'Lançar'],
    ],
  },
  {
    grupo: 'No mês',
    itens: [
      ['← →', 'Mês anterior · próximo'],
      ['H', 'Voltar pro mês atual'],
    ],
  },
]
