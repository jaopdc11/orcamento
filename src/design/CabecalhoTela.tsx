import type { ReactNode } from 'react'
import { Selo } from './Selo'
import { cx } from './util'

export type PropsCabecalho = {
  /** microrrótulo acima ("NOSSA CASA", "NOVEMBRO") */
  selo?: ReactNode
  titulo: ReactNode
  /** uma linha de apoio abaixo, em text-suave */
  descricao?: ReactNode
  /** botão/ícone à direita (ex: <Botao tamanho="sm">Nova</Botao>) */
  acao?: ReactNode
  className?: string
}

/** Topo de toda tela: selo + título display + ação. Um por tela, sempre o primeiro filho. */
export function CabecalhoTela({ selo, titulo, descricao, acao, className }: PropsCabecalho) {
  return (
    <header className={cx('mb-5 flex items-end justify-between gap-3', className)}>
      <div className="min-w-0">
        {selo && <Selo className="mb-2">{selo}</Selo>}
        <h1 className="truncate font-display text-2xl font-semibold tracking-tight text-texto">{titulo}</h1>
        {descricao && <p className="mt-1 text-sm text-suave">{descricao}</p>}
      </div>
      {acao && <div className="flex shrink-0 items-center gap-1">{acao}</div>}
    </header>
  )
}
