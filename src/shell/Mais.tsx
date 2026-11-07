import { CabecalhoTela, Icone, Lista, LinhaLista, TituloSecao } from '@/design'
import { ITENS_MAIS, type Vista } from './navegacao'

type Props = {
  aoIr: (v: Vista) => void
  tema: 'claro' | 'escuro'
  aoTrocarTema: () => void
  aoSair: () => void
}

/** Aba "Mais": as telas que não cabem na nav + as ações de conta. */
export function Mais({ aoIr, tema, aoTrocarTema, aoSair }: Props) {
  const icone = (n: Parameters<typeof Icone>[0]['n']) => (
    <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-superficie-alta text-suave">
      <Icone n={n} className="h-5 w-5" />
    </span>
  )
  const seta = <Icone n="chevronRight" className="h-4 w-4 text-tenue" />
  return (
    <div>
      <CabecalhoTela titulo="Mais" />
      <Lista cascata>
        {ITENS_MAIS.map((i) => (
          <LinhaLista key={i.id} inicio={icone(i.icone)} titulo={i.rotulo} subtitulo={i.descricao} fim={seta} aoTocar={() => aoIr(i.id)} />
        ))}
      </Lista>
      <TituloSecao className="mt-6" titulo="Aparelho" />
      <Lista>
        <LinhaLista
          inicio={icone(tema === 'escuro' ? 'sun' : 'moon')}
          titulo={tema === 'escuro' ? 'Usar tema claro' : 'Usar tema escuro'}
          aoTocar={aoTrocarTema}
        />
        <LinhaLista inicio={icone('logOut')} titulo="Sair da conta" aoTocar={aoSair} />
      </Lista>
    </div>
  )
}
