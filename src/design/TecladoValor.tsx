import { useEffect, useRef } from 'react'
import { formatarSeco } from '@/lib/dinheiro'
import { cx } from './util'

// Campo de valor "caixa registradora": cada dígito empurra pela direita, então o
// estado é sempre inteiro de centavos e nunca existe "12," meio digitado pra
// validar. É um <input> de verdade: teclado físico no PC, teclado numérico
// nativo no celular (inputMode="numeric"). Usado em Metas e Recorrentes.
//
// O nome ficou TecladoValor por compatibilidade; o teclado de botões na tela
// saiu — duplicava o teclado do celular e não aceitava digitação no PC.

const MAX_DIGITOS = 10 // R$ 99.999.999,99

export function TecladoValor({
  centavos,
  aoMudar,
  tom = 'neutro',
  rotulo,
  vazio = 'R$ 0,00',
  autoFocus = true,
}: {
  centavos: number
  aoMudar: (c: number) => void
  tom?: 'neutro' | 'entrada' | 'saida'
  rotulo?: string
  /** texto quando o valor é zero (ex.: "remover") */
  vazio?: string
  autoFocus?: boolean
}) {
  const ref = useRef<HTMLInputElement>(null)
  const texto = centavos === 0 ? '' : `R$ ${formatarSeco(centavos)}`

  // cursor sempre no fim: o dígito novo entra pela direita
  useEffect(() => {
    const el = ref.current
    if (el && document.activeElement === el) el.setSelectionRange(el.value.length, el.value.length)
  }, [texto])

  function aoDigitar(valor: string) {
    // Lê só os dígitos do que ficou no campo. Digitar acrescenta um no fim;
    // apagar remove o último. Funciona igual com teclado físico, virtual e colar.
    const digitos = valor.replace(/\D/g, '').replace(/^0+/, '').slice(0, MAX_DIGITOS)
    aoMudar(digitos ? Number(digitos) : 0)
  }

  const cor = centavos === 0 ? 'text-tenue' : tom === 'entrada' ? 'text-entrada' : tom === 'saida' ? 'text-saida' : 'text-texto'

  return (
    <label className="block text-center">
      {rotulo && <span className="mb-2 block text-xs text-suave">{rotulo}</span>}
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        autoFocus={autoFocus}
        value={texto}
        placeholder={vazio}
        onChange={(e) => aoDigitar(e.target.value)}
        onFocus={(e) => e.target.setSelectionRange(e.target.value.length, e.target.value.length)}
        className={cx(
          'w-full rounded-card border border-borda bg-campo px-4 py-4 text-center font-mono text-4xl font-semibold tabular-nums tracking-tight outline-none transition-colors duration-150 ease-suave placeholder:text-tenue focus:border-acento',
          cor,
        )}
      />
    </label>
  )
}
