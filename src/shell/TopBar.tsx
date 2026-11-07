import { BotaoIcone, Icone } from '@/design'

type Props = {
  nome: string
  aoAbrirSeletor: () => void
  ocultar: boolean
  aoTrocarOcultar: () => void
  tema: 'claro' | 'escuro'
  aoTrocarTema: () => void
  /** em subtela do "Mais": seta de voltar à esquerda */
  aoVoltar?: () => void
}

/**
 * Topo sticky do celular: orçamento atual (abre o seletor) à esquerda, ocultar
 * valores e tema à direita. Safe-area de cima mora aqui. No desktop some (sidebar).
 */
export function TopBar({ nome, aoAbrirSeletor, ocultar, aoTrocarOcultar, tema, aoTrocarTema, aoVoltar }: Props) {
  return (
    <header className="sticky top-0 z-30 border-b border-borda bg-fundo/85 pt-[env(safe-area-inset-top)] backdrop-blur-lg lg:hidden">
      <div className="flex h-topo items-center gap-1 px-2">
        {aoVoltar && (
          <BotaoIcone rotulo="Voltar" onClick={aoVoltar}>
            <Icone n="chevronLeft" className="h-5 w-5" />
          </BotaoIcone>
        )}
        <button
          type="button"
          onClick={aoAbrirSeletor}
          aria-label="Trocar de orçamento"
          className="flex min-h-11 min-w-0 flex-1 items-center gap-1.5 rounded-card px-2 text-left active:scale-[0.98]"
        >
          <span className="truncate font-display text-base font-semibold text-texto">{nome}</span>
          <Icone n="chevronDown" className="h-4 w-4 shrink-0 text-tenue" />
        </button>
        <BotaoIcone rotulo={ocultar ? 'Mostrar valores' : 'Ocultar valores'} onClick={aoTrocarOcultar} ativo={ocultar}>
          <Icone n={ocultar ? 'eyeOff' : 'eye'} className="h-5 w-5" />
        </BotaoIcone>
        <BotaoIcone rotulo={tema === 'escuro' ? 'Tema claro' : 'Tema escuro'} onClick={aoTrocarTema}>
          <Icone n={tema === 'escuro' ? 'sun' : 'moon'} className="h-5 w-5" />
        </BotaoIcone>
      </div>
    </header>
  )
}
