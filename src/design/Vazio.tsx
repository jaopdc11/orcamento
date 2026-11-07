import type { ReactNode } from 'react'
import { Icone, type NomeIcone } from '@/lib/icones'
import { cx } from './util'

export type PropsVazio = {
  icone?: NomeIcone
  /** UMA frase boa, que diz o que fazer — não "Nenhum item encontrado." */
  titulo: ReactNode
  descricao?: ReactNode
  /** botão que resolve o vazio (ex: "Criar meta") */
  acao?: ReactNode
  /** compacto: dentro de cartão/seção, menos respiro */
  compacto?: boolean
  className?: string
}

export function Vazio({ icone = 'inbox', titulo, descricao, acao, compacto = false, className }: PropsVazio) {
  return (
    <div className={cx('flex animate-subir flex-col items-center text-center', compacto ? 'py-6' : 'py-14', className)}>
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-card border border-borda bg-superficie-alta text-tenue">
        <Icone n={icone} className="h-5 w-5" />
      </div>
      <p className="max-w-xs text-sm font-medium text-texto">{titulo}</p>
      {descricao && <p className="mt-1 max-w-xs text-sm text-suave">{descricao}</p>}
      {acao && <div className="mt-4">{acao}</div>}
    </div>
  )
}

/** Faixa de erro/aviso dentro da tela, com "tentar de novo" opcional. */
export function Aviso({
  children,
  tom = 'perigo',
  aoTentarDeNovo,
  className,
}: {
  children: ReactNode
  tom?: 'perigo' | 'atencao' | 'acento'
  aoTentarDeNovo?: () => void
  className?: string
}) {
  const cores = { perigo: 'bg-tinta-perigo text-perigo', atencao: 'bg-tinta-atencao text-atencao', acento: 'bg-tinta-acento text-acento' }
  return (
    <div role={tom === 'perigo' ? 'alert' : 'status'} className={cx('flex items-center gap-3 rounded-card px-4 py-3 text-sm', cores[tom], className)}>
      <Icone n="alert" className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1">{children}</span>
      {aoTentarDeNovo && (
        <button type="button" onClick={aoTentarDeNovo} className="-my-2 min-h-11 shrink-0 font-semibold underline-offset-2 hover:underline">
          Tentar de novo
        </button>
      )}
    </div>
  )
}
