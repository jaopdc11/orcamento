import { Icone, cx } from '@/design'
import { ABAS, abaDe, type Vista } from './navegacao'

type Props = { vista: Vista; aoIr: (v: Vista) => void; aoLancar: () => void }

/**
 * Barra inferior fixa (só celular): Início · Mês · (+) · Análises · Mais.
 * O (+) é elevado e abre o teclado de lançar — é a ação nº 1 do app, merece o
 * centro. Safe-area de baixo vai AQUI (elemento fixo), não no body.
 */
export function NavInferior({ vista, aoIr, aoLancar }: Props) {
  const ativa = abaDe(vista)
  const [a, b, c, d] = ABAS as [(typeof ABAS)[0], (typeof ABAS)[0], (typeof ABAS)[0], (typeof ABAS)[0]]
  const item = (i: typeof a) => {
    const on = ativa === i.id
    return (
      <button
        key={i.id}
        type="button"
        onClick={() => aoIr(i.id)}
        aria-current={on ? 'page' : undefined}
        className={cx(
          'flex h-nav flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors active:scale-[0.94]',
          on ? 'text-acento' : 'text-tenue hover:text-suave',
        )}
      >
        <Icone n={i.icone} className="h-[22px] w-[22px]" />
        {i.rotulo}
      </button>
    )
  }
  return (
    <nav
      aria-label="Navegação"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-borda bg-campo/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg lg:hidden"
    >
      <div className="mx-auto flex max-w-lg items-stretch px-2">
        {item(a)}
        {item(b)}
        <div className="flex flex-1 items-start justify-center">
          <button
            type="button"
            onClick={aoLancar}
            aria-label="Lançar"
            className="-mt-5 flex h-14 w-14 items-center justify-center rounded-[18px] bg-acento text-sobre-acento shadow-flutuante ring-4 ring-fundo transition-transform duration-150 ease-suave active:scale-[0.92]"
          >
            <Icone n="plus" className="h-7 w-7" />
          </button>
        </div>
        {item(c)}
        {item(d)}
      </div>
    </nav>
  )
}
