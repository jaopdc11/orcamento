import { Botao, Icone, Selo, cx, type NomeIcone } from '@/design'
import { ABAS, ITENS_MAIS, type Vista } from './navegacao'

type Props = {
  nome: string
  vista: Vista
  aoIr: (v: Vista) => void
  aoLancar: () => void
  aoAbrirSeletor: () => void
  ocultar: boolean
  aoTrocarOcultar: () => void
  tema: 'claro' | 'escuro'
  aoTrocarTema: () => void
  aoSair: () => void
}

/** Sidebar do desktop (lg+): substitui top bar + nav inferior. Mostra o Mais aberto. */
export function Sidebar(p: Props) {
  const principais = ABAS.filter((a) => a.id !== 'mais')
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-sidebar flex-col border-r border-borda bg-campo lg:flex">
      <button
        type="button"
        onClick={p.aoAbrirSeletor}
        className="mx-3 mt-4 flex items-center gap-3 rounded-card border border-borda bg-superficie px-3 py-2.5 text-left transition-colors hover:border-borda-forte"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-tinta-acento font-display font-semibold text-acento">
          {p.nome.slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <Selo className="mb-1">Orçamento</Selo>
          <span className="block truncate font-display text-sm font-semibold text-texto">{p.nome}</span>
        </span>
        <Icone n="chevronDown" className="h-4 w-4 shrink-0 text-tenue" />
      </button>

      <div className="px-3 pt-4">
        <Botao cheio icone={<Icone n="plus" />} onClick={p.aoLancar}>
          Lançar
        </Botao>
      </div>

      <nav className="rolagem-fina flex-1 overflow-y-auto px-3 py-4" aria-label="Navegação">
        <ul className="space-y-0.5">
          {principais.map((i) => (
            <Item key={i.id} {...i} ativo={p.vista === i.id} aoTocar={() => p.aoIr(i.id)} />
          ))}
        </ul>
        <Selo className="mb-2 mt-6 px-3">Mais</Selo>
        <ul className="space-y-0.5">
          {ITENS_MAIS.map((i) => (
            <Item key={i.id} {...i} ativo={p.vista === i.id} aoTocar={() => p.aoIr(i.id)} />
          ))}
        </ul>
      </nav>

      <ul className="space-y-0.5 border-t border-borda px-3 py-3">
        <Item icone={p.ocultar ? 'eyeOff' : 'eye'} rotulo={p.ocultar ? 'Mostrar valores' : 'Ocultar valores'} aoTocar={p.aoTrocarOcultar} />
        <Item icone={p.tema === 'escuro' ? 'sun' : 'moon'} rotulo={p.tema === 'escuro' ? 'Tema claro' : 'Tema escuro'} aoTocar={p.aoTrocarTema} />
        <Item icone="logOut" rotulo="Sair" aoTocar={p.aoSair} />
      </ul>
      {/* sidebar só existe no desktop, onde tem teclado: é o lugar da dica */}
      <p className="px-6 pb-4 text-xs text-tenue">
        <kbd className="rounded border border-borda px-1.5 py-px font-mono text-[11px] text-suave">?</kbd> atalhos de teclado
      </p>
    </aside>
  )
}

function Item({ icone, rotulo, ativo = false, aoTocar }: { icone: NomeIcone; rotulo: string; ativo?: boolean; aoTocar: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={aoTocar}
        aria-current={ativo ? 'page' : undefined}
        className={cx(
          'flex min-h-10 w-full items-center gap-3 rounded-[10px] px-3 text-sm transition-colors',
          ativo ? 'bg-tinta-acento font-medium text-acento' : 'text-suave hover:bg-superficie-alta hover:text-texto',
        )}
      >
        <Icone n={icone} className="h-[18px] w-[18px]" />
        {rotulo}
      </button>
    </li>
  )
}
