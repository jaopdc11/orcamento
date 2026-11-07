import { useRef, useState } from 'react'
import { cx } from './util'

// Código de 6 dígitos em 6 caixas mono. Por baixo é UM input só (transparente,
// por cima das caixas): é o que mantém o autocomplete "one-time-code" do iOS/
// Android funcionando e o colar inteiro de uma vez. As caixas são só desenho.
// Usado no Login e na troca de e-mail do Perfil.
export function CaixasCodigo({
  valor,
  aoMudar,
  autoFocus,
  rotulo = 'Código de 6 dígitos',
  erro = false,
}: {
  valor: string
  aoMudar: (v: string) => void
  autoFocus?: boolean
  rotulo?: string
  erro?: boolean
}) {
  const ref = useRef<HTMLInputElement>(null)
  const [focado, setFocado] = useState(false)
  const digitos = valor.padEnd(6, ' ').slice(0, 6).split('')
  // caixa "da vez": a próxima a preencher (ou a última, se cheio)
  const atual = Math.min(valor.length, 5)

  return (
    <div className="relative" onClick={() => ref.current?.focus()}>
      <div className="grid grid-cols-6 gap-2" aria-hidden>
        {digitos.map((d, i) => (
          <div
            key={i}
            className={cx(
              'flex h-14 items-center justify-center rounded-card border bg-campo font-mono text-2xl font-semibold text-texto transition-colors duration-150 ease-suave',
              erro ? 'border-perigo' : focado && i === atual ? 'border-acento' : d.trim() ? 'border-borda-forte' : 'border-borda',
            )}
          >
            {d.trim() ? <span className="animate-pop">{d}</span> : null}
          </div>
        ))}
      </div>
      <input
        ref={ref}
        aria-label={rotulo}
        type="text"
        inputMode="numeric"
        // faz iOS e Android sugerirem o código direto do teclado —
        // é o que derruba a fricção pra perto de zero.
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={6}
        required
        autoFocus={autoFocus}
        value={valor}
        onFocus={() => setFocado(true)}
        onBlur={() => setFocado(false)}
        onChange={(e) => aoMudar(e.target.value.replace(/\D/g, '').slice(0, 6))}
        className="absolute inset-0 h-full w-full cursor-text bg-transparent text-transparent caret-transparent outline-none selection:bg-transparent"
      />
    </div>
  )
}
