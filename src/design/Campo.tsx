import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cx } from './util'

// Fundo "campo" (base-900 no escuro) = um degrau ABAIXO do cartão: o input
// parece cavado na superfície. 44px de altura (alvo de toque); text-base no
// celular pra o iOS não dar zoom ao focar.
const CAMPO =
  'w-full min-h-11 rounded-card border border-borda bg-campo px-3.5 text-base text-texto placeholder:text-tenue outline-none transition-colors duration-150 focus:border-acento focus-visible:outline-none disabled:opacity-50 sm:text-sm'

export function Rotulo({ children, htmlFor, className }: { children: ReactNode; htmlFor?: string; className?: string }) {
  return (
    <label htmlFor={htmlFor} className={cx('mb-1.5 block text-xs font-medium text-suave', className)}>
      {children}
    </label>
  )
}

type Extras = {
  rotulo?: ReactNode
  /** texto de ajuda abaixo (text-tenue) */
  ajuda?: ReactNode
  /** mensagem de erro abaixo (text-perigo) — também pinta a borda */
  erro?: ReactNode
  /** classe do wrapper (o className vai pro próprio input) */
  classeCaixa?: string
}

function Moldura({ id, rotulo, ajuda, erro, classeCaixa, children }: Extras & { id: string; children: ReactNode }) {
  return (
    <div className={classeCaixa}>
      {rotulo && <Rotulo htmlFor={id}>{rotulo}</Rotulo>}
      {children}
      {erro ? (
        <p className="mt-1.5 text-xs text-perigo">{erro}</p>
      ) : ajuda ? (
        <p className="mt-1.5 text-xs text-tenue">{ajuda}</p>
      ) : null}
    </div>
  )
}

export const Campo = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & Extras>(function Campo(
  { rotulo, ajuda, erro, classeCaixa, className, id, ...resto },
  ref,
) {
  const auto = useId()
  const i = id ?? auto
  return (
    <Moldura id={i} rotulo={rotulo} ajuda={ajuda} erro={erro} classeCaixa={classeCaixa}>
      <input ref={ref} id={i} aria-invalid={!!erro || undefined} className={cx(CAMPO, erro && 'border-perigo', className)} {...resto} />
    </Moldura>
  )
})

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & Extras>(function Select(
  { rotulo, ajuda, erro, classeCaixa, className, id, children, ...resto },
  ref,
) {
  const auto = useId()
  const i = id ?? auto
  return (
    <Moldura id={i} rotulo={rotulo} ajuda={ajuda} erro={erro} classeCaixa={classeCaixa}>
      <select ref={ref} id={i} className={cx(CAMPO, 'appearance-none bg-no-repeat pr-9', erro && 'border-perigo', className)} style={SETA} {...resto}>
        {children}
      </select>
    </Moldura>
  )
})

// seta do select desenhada em SVG com currentColor não funciona em background;
// cinza médio serve nos dois temas.
const SETA = {
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
  backgroundPosition: 'right 0.75rem center',
  backgroundSize: '1rem',
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & Extras>(function Textarea(
  { rotulo, ajuda, erro, classeCaixa, className, id, rows = 3, ...resto },
  ref,
) {
  const auto = useId()
  const i = id ?? auto
  return (
    <Moldura id={i} rotulo={rotulo} ajuda={ajuda} erro={erro} classeCaixa={classeCaixa}>
      <textarea ref={ref} id={i} rows={rows} className={cx(CAMPO, 'py-2.5', erro && 'border-perigo', className)} {...resto} />
    </Moldura>
  )
})
