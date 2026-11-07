import type { ReactNode } from 'react'
import { cx } from './util'

/**
 * Lista dentro de um cartão: linhas separadas por fio. `cascata` escalona a
 * entrada das linhas (use na primeira carga, não em lista que muda a cada tecla).
 */
export function Lista({ children, cascata = false, semCartao = false, className }: { children: ReactNode; cascata?: boolean; semCartao?: boolean; className?: string }) {
  return (
    <ul
      className={cx(
        'divide-y divide-borda',
        !semCartao && 'overflow-hidden rounded-card border border-borda bg-superficie shadow-card',
        cascata && 'cascata',
        className,
      )}
    >
      {children}
    </ul>
  )
}

export type PropsLinha = {
  /** à esquerda: IconeCategoria, avatar, ícone */
  inicio?: ReactNode
  titulo: ReactNode
  /** linha de baixo, text-tenue (data curta em mono, quem pagou...) */
  subtitulo?: ReactNode
  /** à direita: <Valor/>, badge, chevron */
  fim?: ReactNode
  /** linha inteira tocável (abre edição). Vira <button> com active:scale. */
  aoTocar?: () => void
  /** ações SEMPRE visíveis (BotaoIcone) — nada de aparecer só no hover */
  acoes?: ReactNode
  /** esmaecida (pendente de rede, arquivada) */
  apagada?: boolean
  className?: string
}

/** Linha padrão de lista: início · título/subtítulo · fim · ações. Mín. 56px de altura. */
export function LinhaLista({ inicio, titulo, subtitulo, fim, aoTocar, acoes, apagada = false, className }: PropsLinha) {
  const miolo = (
    <>
      {inicio}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-texto">{titulo}</span>
        {subtitulo && <span className="mt-0.5 block truncate text-xs text-tenue">{subtitulo}</span>}
      </span>
      {fim && <span className="shrink-0 text-right">{fim}</span>}
    </>
  )
  const classeMiolo = 'flex min-h-14 min-w-0 flex-1 items-center gap-3 px-4 py-2.5 text-left'
  return (
    <li className={cx('flex items-center', apagada && 'opacity-55', className)}>
      {aoTocar ? (
        <button
          type="button"
          onClick={aoTocar}
          className={cx(classeMiolo, 'transition-[transform,background-color] duration-150 ease-suave hover:bg-superficie-alta/50 active:scale-[0.985] active:bg-superficie-alta')}
        >
          {miolo}
        </button>
      ) : (
        <div className={classeMiolo}>{miolo}</div>
      )}
      {acoes && <span className="flex shrink-0 items-center pr-1">{acoes}</span>}
    </li>
  )
}
