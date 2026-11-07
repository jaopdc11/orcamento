import { useEffect, useState, type ReactNode } from 'react'
import { cx, prefereParado } from './util'

export type PropsBarra = {
  /** 0..∞ — passar de 100 é o estado "excedido" (meta estourada) */
  percentual: number
  rotulo?: ReactNode
  /** texto à direita; padrão = o percentual */
  direita?: ReactNode
  /** cor normal: acento (padrão), entrada ou saida. Excedido é sempre saida. */
  tom?: 'acento' | 'entrada' | 'saida' | 'atencao'
  /** a partir de quanto % fica âmbar (padrão 85). null desliga. */
  avisoEm?: number | null
  alta?: boolean
  className?: string
}

const TONS = { acento: 'bg-acento', entrada: 'bg-entrada', saida: 'bg-saida', atencao: 'bg-atencao' }

/** Barra que enche do zero na primeira pintura. Excedido (>100%) pinta de saida. */
export function BarraProgresso({ percentual, rotulo, direita, tom = 'acento', avisoEm = 85, alta = false, className }: PropsBarra) {
  const bruto = Number.isFinite(percentual) ? Math.max(0, percentual) : 0
  const pct = Math.min(100, bruto)
  const excedido = bruto > 100
  const cor = excedido ? 'bg-saida' : avisoEm !== null && bruto >= avisoEm ? 'bg-atencao' : TONS[tom]

  const [largura, setLargura] = useState(() => (prefereParado() ? pct : 0))
  useEffect(() => {
    // espera uma pintura em zero pra transição ter de onde partir
    const t = setTimeout(() => setLargura(pct), 40)
    return () => clearTimeout(t)
  }, [pct])

  return (
    <div className={className}>
      <div
        className={cx(alta ? 'h-2.5' : 'h-1.5', 'overflow-hidden rounded-full bg-superficie-alta')}
        role="progressbar"
        aria-valuenow={Math.round(bruto)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={cx('h-full rounded-full transition-[width] duration-[900ms] ease-suave', cor)} style={{ width: `${largura}%` }} />
      </div>
      {(rotulo !== undefined || direita !== undefined) && (
        <p className="mt-1.5 flex items-center justify-between gap-2 text-xs text-tenue">
          <span className="min-w-0 truncate">{rotulo}</span>
          <span className={cx('font-mono', excedido ? 'font-semibold text-saida' : 'text-suave')}>{direita ?? `${Math.round(bruto)}%`}</span>
        </p>
      )}
    </div>
  )
}
