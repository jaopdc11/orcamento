import type { HTMLAttributes, ReactNode } from 'react'
import { cx } from './util'

export type PropsCartao = HTMLAttributes<HTMLDivElement> & {
  /** vira <button>: ganha active:scale e foco. Use pra cartão que abre algo. */
  aoTocar?: () => void
  /** sem padding interno (lista dentro do cartão, gráfico de borda a borda) */
  semPadding?: boolean
  children: ReactNode
}

const BASE = 'rounded-card border border-borda bg-superficie shadow-card'

export function Cartao({ aoTocar, semPadding = false, className, children, ...resto }: PropsCartao) {
  const classe = cx(BASE, !semPadding && 'p-4', className)
  if (aoTocar) {
    return (
      <button
        type="button"
        onClick={aoTocar}
        className={cx(
          classe,
          'block w-full text-left transition-[transform,border-color] duration-150 ease-suave hover:border-borda-forte active:scale-[0.97]',
        )}
      >
        {children}
      </button>
    )
  }
  return (
    <div className={classe} {...resto}>
      {children}
    </div>
  )
}
