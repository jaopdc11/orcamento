import type { ReactNode } from 'react'
import { cx } from './util'

export type Aba<T extends string> = { id: T; rotulo: ReactNode; badge?: number }

export type PropsTabs<T extends string> = {
  abas: Array<Aba<T>>
  ativa: T
  aoTrocar: (id: T) => void
  /** ocupa a largura toda com abas iguais (Saiu/Entrou, filtros de 2-3 opções) */
  cheio?: boolean
  /** cor da aba ativa: acento (padrão) ou o estado (saida/entrada) */
  tom?: 'acento' | 'saida' | 'entrada'
  className?: string
}

const ATIVA = {
  acento: 'bg-acento text-sobre-acento',
  saida: 'bg-tinta-saida text-saida',
  entrada: 'bg-tinta-entrada text-entrada',
}

/** Segmented control. Pra 2-4 vistas da MESMA coisa; navegação entre telas é a nav. */
export function Tabs<T extends string>({ abas, ativa, aoTrocar, cheio = false, tom = 'acento', className }: PropsTabs<T>) {
  return (
    <div role="tablist" className={cx(cheio ? 'flex' : 'inline-flex', 'gap-1 rounded-card border border-borda bg-campo p-1', className)}>
      {abas.map((a) => {
        const on = a.id === ativa
        return (
          <button
            key={a.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => aoTrocar(a.id)}
            className={cx(
              'flex min-h-9 items-center justify-center gap-1.5 rounded-[10px] px-3 text-sm transition-colors duration-150',
              cheio && 'flex-1',
              on ? cx('font-semibold', ATIVA[tom]) : 'text-suave hover:text-texto',
            )}
          >
            {a.rotulo}
            {a.badge !== undefined && a.badge > 0 && (
              <span className={cx('rounded-full px-1.5 font-mono text-[10px]', on ? 'bg-black/15' : 'bg-superficie-alta')}>{a.badge}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
