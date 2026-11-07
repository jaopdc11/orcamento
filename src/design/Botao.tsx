import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cx } from './util'

export type VarianteBotao = 'primario' | 'secundario' | 'fantasma' | 'perigo'
export type TamanhoBotao = 'sm' | 'md' | 'lg'

export type PropsBotao = ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: VarianteBotao
  tamanho?: TamanhoBotao
  carregando?: boolean
  /** ocupa a largura toda (rodapé de sheet, formulário no celular) */
  cheio?: boolean
  icone?: ReactNode
}

// active:scale-[0.97] = o "afundou" que o toque espera. min-h-11 (44px) no md/lg:
// alvo de toque mínimo do celular.
const BASE =
  'inline-flex select-none items-center justify-center gap-2 rounded-card font-medium transition-[transform,background-color,color,opacity] duration-150 ease-suave active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100'

const VARIANTES: Record<VarianteBotao, string> = {
  primario: 'bg-acento text-sobre-acento hover:bg-acento-suave',
  secundario: 'border border-borda bg-superficie-alta text-texto hover:border-borda-forte',
  fantasma: 'bg-transparent text-suave hover:bg-superficie-alta hover:text-texto',
  perigo: 'bg-tinta-perigo text-perigo hover:bg-perigo hover:text-white',
}

const TAMANHOS: Record<TamanhoBotao, string> = {
  sm: 'min-h-9 px-3 text-sm',
  md: 'min-h-11 px-4 text-sm',
  lg: 'min-h-12 px-5 text-base',
}

export const Botao = forwardRef<HTMLButtonElement, PropsBotao>(function Botao(
  { variante = 'primario', tamanho = 'md', carregando = false, cheio = false, icone, className, children, disabled, type, ...resto },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      disabled={disabled || carregando}
      aria-busy={carregando || undefined}
      className={cx(BASE, VARIANTES[variante], TAMANHOS[tamanho], cheio && 'w-full', className)}
      {...resto}
    >
      {carregando ? <Girando /> : icone}
      {children}
    </button>
  )
})

function Girando() {
  return <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden />
}

/** Botão só de ícone (top bar, ação de linha). Sempre 44×44 de alvo; `rotulo` vira aria-label. */
export function BotaoIcone({
  rotulo,
  ativo = false,
  className,
  children,
  ...resto
}: ButtonHTMLAttributes<HTMLButtonElement> & { rotulo: string; ativo?: boolean }) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      title={rotulo}
      className={cx(
        'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-card transition-[transform,background-color,color] duration-150 ease-suave active:scale-[0.94]',
        ativo ? 'bg-superficie-alta text-texto' : 'text-suave hover:bg-superficie-alta hover:text-texto',
        className,
      )}
      {...resto}
    >
      {children}
    </button>
  )
}
