import type { ReactNode } from 'react'
import { cx } from './util'

/** Microrrótulo uppercase acima de título/seção ("ESTE MÊS", "DESPESAS"). */
export function Selo({ children, tom = 'tenue', className }: { children: ReactNode; tom?: 'tenue' | 'acento'; className?: string }) {
  return (
    <span
      className={cx(
        'block text-[10px] font-semibold uppercase leading-none tracking-[0.15em]',
        tom === 'acento' ? 'text-acento' : 'text-tenue',
        className,
      )}
    >
      {children}
    </span>
  )
}

/** Título de seção dentro da tela: selo opcional + h3 + ação à direita. */
export function TituloSecao({ selo, titulo, acao, className }: { selo?: ReactNode; titulo: ReactNode; acao?: ReactNode; className?: string }) {
  return (
    <div className={cx('mb-3 flex items-end justify-between gap-3', className)}>
      <div className="min-w-0">
        {selo && <Selo className="mb-1.5">{selo}</Selo>}
        <h3 className="truncate font-display text-base font-semibold text-texto">{titulo}</h3>
      </div>
      {acao && <div className="shrink-0">{acao}</div>}
    </div>
  )
}
