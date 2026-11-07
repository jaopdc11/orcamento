import { apagarDigito, empurrarDigito, formatarSeco } from '@/lib/dinheiro'
import { Icone } from '@/lib/icones'
import { cx, vibrar } from './util'

// Teclado de caixa registradora pra valor (mesma ideia do Lancar): o dígito
// empurra pela direita, então o estado é sempre inteiro de centavos e nunca
// existe "12," meio digitado pra validar. Usado em Metas e Recorrentes.

const TECLAS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', '⌫'] as const

export function TecladoValor({
  centavos,
  aoMudar,
  tom = 'neutro',
  rotulo,
  vazio = 'R$ 0,00',
}: {
  centavos: number
  aoMudar: (c: number) => void
  tom?: 'neutro' | 'entrada' | 'saida'
  rotulo?: string
  /** texto quando o valor é zero (ex.: "sem limite") */
  vazio?: string
}) {
  function tecla(t: (typeof TECLAS)[number]) {
    vibrar('leve')
    if (t === '⌫') aoMudar(apagarDigito(centavos))
    else if (t === '00') aoMudar(empurrarDigito(empurrarDigito(centavos, '0'), '0'))
    else aoMudar(empurrarDigito(centavos, t))
  }

  const cor = centavos === 0 ? 'text-tenue' : tom === 'entrada' ? 'text-entrada' : tom === 'saida' ? 'text-saida' : 'text-texto'

  return (
    <div>
      <div className="mb-3 text-center" aria-live="polite">
        {rotulo && <p className="mb-1 text-xs text-suave">{rotulo}</p>}
        <p className={cx('font-mono text-4xl font-semibold tabular-nums tracking-tight', cor)}>
          {centavos === 0 ? vazio : `R$ ${formatarSeco(centavos)}`}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {TECLAS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => tecla(t)}
            aria-label={t === '⌫' ? 'Apagar' : t}
            className="flex h-14 items-center justify-center rounded-card bg-superficie-alta/60 font-mono text-2xl text-texto transition-[transform,background-color] duration-100 ease-suave active:scale-[0.95] active:bg-superficie-alta"
          >
            {t === '⌫' ? <Icone n="backspace" className="h-6 w-6 text-suave" /> : t}
          </button>
        ))}
      </div>
    </div>
  )
}
