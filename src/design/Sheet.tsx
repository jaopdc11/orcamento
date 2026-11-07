import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icone } from '@/lib/icones'
import { cx } from './util'

export type PropsSheet = {
  aberto: boolean
  aoFechar: () => void
  titulo?: ReactNode
  /** microrrótulo acima do título */
  selo?: ReactNode
  children: ReactNode
  /** fixo no rodapé (botão salvar). Já leva o safe-area de baixo. */
  rodape?: ReactNode
  /** largura da caixa no desktop */
  largura?: 'sm' | 'md' | 'lg'
  /** sem padding no corpo (teclado de lançar, lista de borda a borda) */
  semPadding?: boolean
  /** altura cheia no celular (formulário longo, teclado) */
  alto?: boolean
}

const LARGURAS = { sm: 'sm:max-w-sm', md: 'sm:max-w-md', lg: 'sm:max-w-2xl' }

// Quantos sheets estão abertos: só o último solto destrava o scroll do body
// (sheet dentro de sheet — ex: editar a partir da busca).
let abertos = 0

/**
 * Bottom sheet no celular (sobe de baixo, alça, cantos de cima arredondados),
 * caixa centrada no desktop. Esc e toque no fundo fecham; trava o scroll da
 * página enquanto aberto. Renderiza em portal no <body>.
 */
export function Sheet({ aberto, aoFechar, titulo, selo, children, rodape, largura = 'md', semPadding = false, alto = false }: PropsSheet) {
  // ref pro callback mais novo: o efeito não re-roda a cada render do pai
  const fechar = useRef(aoFechar)
  fechar.current = aoFechar

  useEffect(() => {
    if (!aberto) return
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fechar.current()
    }
    document.addEventListener('keydown', tecla)
    abertos++
    const antes = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', tecla)
      abertos--
      if (abertos === 0) document.body.style.overflow = antes === 'hidden' ? '' : antes
    }
  }, [aberto])

  if (!aberto || typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="presentation">
      <button
        type="button"
        aria-label="Fechar"
        tabIndex={-1}
        onClick={() => fechar.current()}
        className="absolute inset-0 animate-fade bg-black/60 backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cx(
          'relative flex w-full flex-col overflow-hidden rounded-t-sheet border border-b-0 border-borda bg-superficie shadow-flutuante animate-subir-sheet',
          'sm:rounded-sheet sm:border-b sm:animate-scale-in',
          alto ? 'h-[94dvh] sm:h-[min(46rem,90dvh)]' : 'max-h-[90dvh]',
          LARGURAS[largura],
        )}
      >
        {/* alça: só no celular — é o que diz "isto é uma folha por cima" */}
        <span className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-borda-forte sm:hidden" aria-hidden />
        {(titulo || selo) && (
          <div className="flex shrink-0 items-start justify-between gap-3 px-5 pb-3 pt-3 sm:pt-5">
            <div className="min-w-0">
              {selo && <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.15em] text-tenue">{selo}</span>}
              {titulo && <h2 className="truncate font-display text-lg font-semibold text-texto">{titulo}</h2>}
            </div>
            <button
              type="button"
              onClick={() => fechar.current()}
              aria-label="Fechar"
              className="-mr-2 -mt-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-card text-suave transition-colors hover:bg-superficie-alta hover:text-texto"
            >
              <Icone n="x" className="h-5 w-5" />
            </button>
          </div>
        )}
        <div className={cx('rolagem-fina min-h-0 flex-1 overflow-y-auto', !semPadding && 'px-5 pb-5', !rodape && !semPadding && 'pb-[max(1.25rem,env(safe-area-inset-bottom))]')}>
          {children}
        </div>
        {rodape && (
          <div className="flex shrink-0 items-center gap-2 border-t border-borda bg-superficie px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-4">
            {rodape}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
