import type { ReactNode } from 'react'
import { cx } from './util'

export type TomBadge = 'neutro' | 'acento' | 'entrada' | 'saida' | 'atencao' | 'perigo'

const TONS: Record<TomBadge, string> = {
  neutro: 'bg-superficie-alta text-suave',
  acento: 'bg-tinta-acento text-acento',
  entrada: 'bg-tinta-entrada text-entrada',
  saida: 'bg-tinta-saida text-saida',
  atencao: 'bg-tinta-atencao text-atencao',
  perigo: 'bg-tinta-perigo text-perigo',
}

/** Etiqueta pequena NÃO tocável (status, contagem, "pendente", "recorrente"). */
export function Badge({ children, tom = 'neutro', mono = false, className }: { children: ReactNode; tom?: TomBadge; mono?: boolean; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium leading-4',
        mono && 'font-mono',
        TONS[tom],
        className,
      )}
    >
      {children}
    </span>
  )
}

/** Pílula TOCÁVEL de filtro/seleção (categoria, membro, período). Ativa = acento. */
export function Chip({
  children,
  ativo = false,
  aoTocar,
  icone,
  className,
}: {
  children: ReactNode
  ativo?: boolean
  aoTocar?: () => void
  icone?: ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={aoTocar}
      aria-pressed={ativo}
      className={cx(
        'inline-flex min-h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-sm transition-[transform,background-color,border-color,color] duration-150 ease-suave active:scale-[0.97]',
        ativo ? 'border-acento bg-tinta-acento text-acento' : 'border-borda bg-superficie text-suave hover:text-texto',
        className,
      )}
    >
      {icone}
      {children}
    </button>
  )
}

/** Fileira de chips que rola na horizontal no celular sem barra visível. */
export function FileiraChips({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx('-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden', className)}>
      {children}
    </div>
  )
}
