import { useMemo, useState } from 'react'
import { deslocarMes, diaMes, hoje, mesDe, mesPorExtenso, paraDataLocal } from '@/lib/datas'
import { arquivarLancamento } from '@/features/lancamentos/lancamentos.queries'
import { nomeDoMembro } from '@/lib/membros'
import { EditarLancamento } from '@/features/lancamentos/EditarLancamento'
import { SeloRecorrente } from '@/features/recorrentes/SeloRecorrente'
import {
  Aviso,
  Badge,
  BarraProgresso,
  BotaoIcone,
  CabecalhoTela,
  Cartao,
  EsqueletoLista,
  Esqueleto,
  Icone,
  IconeCategoria,
  LinhaLista,
  Lista,
  Selo,
  Tabs,
  TituloSecao,
  Valor,
  Vazio,
} from '@/design'
import { useMes } from './useMes'
import type { Linha } from './useMes'
import type { Categoria, Membro } from '@/lib/tipos'

// A vista "Mês": navegador de mês grande, totais, e a lista do mês agrupada por
// dia. Adicionar saiu daqui: o (+) da barra inferior abre o teclado de lançar,
// que é mais rápido que um formulário por coluna.

type Props = {
  ledgerId: string
  categorias: Categoria[]
  usuarioId: string
  ocultar: boolean
  /** user_id → membro; pra autoria nas linhas (F1 usa com nomeDoMembro) */
  membros: Map<string, Membro>
}

type Filtro = 'tudo' | 'expense' | 'income'

export function Dashboard({ ledgerId, categorias, usuarioId, ocultar, membros }: Props) {
  const [mes, setMes] = useState(mesDe())
  const { linhas, totais, porCategoria, carregando, erro, recarregar } = useMes(ledgerId, mes, categorias)
  const [editando, setEditando] = useState<Linha | null>(null)
  const [filtro, setFiltro] = useState<Filtro>('tudo')

  const porId = useMemo(() => new Map(categorias.map((c) => [c.id, c])), [categorias])
  const comMeta = useMemo(() => porCategoria.filter((r) => r.meta !== null), [porCategoria])

  // Agrupa depois de filtrar: o useMes.porDia não sabe do filtro. As linhas já
  // vêm ordenadas por data desc, então a ordem dos grupos sai de graça.
  const grupos = useMemo(() => {
    const mapa = new Map<string, Linha[]>()
    for (const l of linhas) {
      if (filtro !== 'tudo' && l.kind !== filtro) continue
      const g = mapa.get(l.occurred_on)
      if (g) g.push(l)
      else mapa.set(l.occurred_on, [l])
    }
    return [...mapa.entries()]
  }, [linhas, filtro])

  const ehMesAtual = mes >= mesDe()
  const n = linhas.length

  return (
    <div>
      <CabecalhoTela
        selo={carregando ? 'carregando…' : `${n} lançamento${n === 1 ? '' : 's'}`}
        titulo="Orçamento Mensal"
      />

      {/* navegador de mês: alvo grande, o mês no meio é o que mais se toca */}
      <Cartao semPadding className="mb-4 flex items-center justify-between p-1">
        <BotaoIcone rotulo="Mês anterior" onClick={() => setMes(deslocarMes(mes, -1))}>
          <Icone n="chevronLeft" className="h-5 w-5" />
        </BotaoIcone>
        <button
          type="button"
          onClick={() => setMes(mesDe())}
          disabled={ehMesAtual}
          className="flex min-h-11 flex-1 flex-col items-center justify-center rounded-xl transition-transform active:scale-[0.97] disabled:active:scale-100"
          aria-label="Voltar pro mês atual"
        >
          <span className="font-display text-lg font-semibold capitalize text-texto">{mesPorExtenso(mes)}</span>
          {!ehMesAtual && <span className="text-[11px] text-acento">tocar pra voltar a hoje</span>}
        </button>
        <BotaoIcone rotulo="Próximo mês" onClick={() => setMes(deslocarMes(mes, 1))} disabled={ehMesAtual}>
          <Icone n="chevronRight" className="h-5 w-5" />
        </BotaoIcone>
      </Cartao>

      {erro && (
        <Aviso className="mb-4" aoTentarDeNovo={() => void recarregar()}>
          {erro}
        </Aviso>
      )}

      {/* totais */}
      <div key={mes} className="cascata mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Cartao>
          <Selo className="mb-2">Receitas</Selo>
          {carregando ? <Esqueleto className="h-7 w-24" /> : <Valor centavos={totais.entrou} tipo="entrada" tamanho="lg" ocultar={ocultar} />}
        </Cartao>
        <Cartao>
          <Selo className="mb-2">Despesas</Selo>
          {carregando ? <Esqueleto className="h-7 w-24" /> : <Valor centavos={totais.saiu} tipo="saida" tamanho="lg" ocultar={ocultar} />}
        </Cartao>
        <Cartao className="col-span-2 lg:col-span-1">
          <Selo className="mb-2">Saldo</Selo>
          {carregando ? <Esqueleto className="h-7 w-28" /> : <Valor centavos={totais.saldo} tipo="auto" tamanho="lg" ocultar={ocultar} />}
        </Cartao>
      </div>

      {/* lista do mês agrupada por dia */}
      <TituloSecao
        selo="Lançamentos"
        titulo="Dia a dia"
        className="mb-3"
        acao={
          <Tabs<Filtro>
            abas={[
              { id: 'tudo', rotulo: 'Tudo' },
              { id: 'expense', rotulo: 'Saiu' },
              { id: 'income', rotulo: 'Entrou' },
            ]}
            ativa={filtro}
            aoTrocar={setFiltro}
          />
        }
      />

      {carregando ? (
        <EsqueletoLista linhas={5} />
      ) : grupos.length === 0 ? (
        <Cartao>
          <Vazio
            compacto
            icone="calendar"
            titulo={
              filtro === 'tudo'
                ? `Nada lançado em ${mesPorExtenso(mes)}.`
                : `Nenhuma ${filtro === 'income' ? 'receita' : 'despesa'} neste mês.`
            }
            descricao="Toque no + lá embaixo pra lançar em três toques."
          />
        </Cartao>
      ) : (
        <div key={`${mes}-${filtro}`} className="cascata space-y-4">
          {grupos.map(([dia, doDia]) => (
            <section key={dia}>
              <CabecaDia dia={dia} linhas={doDia} ocultar={ocultar} />
              <Lista>
                {doDia.map((l) => (
                  <LinhaLancamento
                    key={l.id}
                    linha={l}
                    categoria={l.category_id ? porId.get(l.category_id) : undefined}
                    membros={membros}
                    usuarioId={usuarioId}
                    ocultar={ocultar}
                    // pendente ainda não existe no servidor, e editar é só online
                    aoTocar={l.pendente ? undefined : () => setEditando(l)}
                  />
                ))}
              </Lista>
            </section>
          ))}
        </div>
      )}

      {/* metas do mês */}
      <TituloSecao selo="Limites" titulo="Metas do mês" className="mb-3 mt-8" />
      <Cartao>
        {carregando ? (
          <div className="space-y-3">
            <Esqueleto className="h-4 w-full" />
            <Esqueleto className="h-4 w-3/4" />
          </div>
        ) : comMeta.length === 0 ? (
          <Vazio compacto icone="target" titulo="Sem metas neste mês." descricao="Uma meta por categoria já mostra pra onde o dinheiro está indo." />
        ) : (
          <ul className="cascata space-y-4">
            {comMeta.map((r) => {
              const pct = r.meta && r.meta > 0 ? (r.gasto / r.meta) * 100 : 0
              return (
                <li key={r.categoria.id} className="flex items-center gap-3">
                  <IconeCategoria categoria={r.categoria} tamanho="sm" />
                  <BarraProgresso
                    className="flex-1"
                    percentual={pct}
                    rotulo={r.categoria.nome}
                    direita={
                      <span className="flex items-baseline gap-1">
                        <Valor centavos={r.gasto} tamanho="sm" ocultar={ocultar} semMoeda />
                        <span className="text-tenue">/</span>
                        <Valor centavos={r.meta ?? 0} tamanho="sm" ocultar={ocultar} semMoeda className="text-tenue" />
                      </span>
                    }
                  />
                </li>
              )
            })}
          </ul>
        )}
      </Cartao>

      {editando && (
        <EditarLancamento
          lancamento={editando}
          categorias={categorias}
          membros={membros}
          usuarioId={usuarioId}
          aoFechar={() => setEditando(null)}
          aoSalvar={async () => {
            setEditando(null)
            await recarregar()
          }}
          aoApagar={async () => {
            await arquivarLancamento(editando.id)
            setEditando(null)
            await recarregar()
          }}
        />
      )}
    </div>
  )
}

/** "Hoje", "Ontem" ou "sex · 12/11", com o saldo do dia à direita. */
function CabecaDia({ dia, linhas, ocultar }: { dia: string; linhas: Linha[]; ocultar: boolean }) {
  const saldo = useMemo(() => linhas.reduce((s, l) => s + l.signed_cents, 0), [linhas])
  return (
    <div className="mb-2 flex items-baseline justify-between px-1">
      <span className="text-xs font-medium text-suave">
        <RotuloDia dia={dia} />
      </span>
      <Valor centavos={saldo} tipo="auto" tamanho="sm" ocultar={ocultar} className="text-xs" />
    </div>
  )
}

export function RotuloDia({ dia }: { dia: string }) {
  const h = hoje()
  const ontem = useMemo(() => {
    const d = paraDataLocal(h)
    d.setDate(d.getDate() - 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }, [h])
  if (dia === h) return <>Hoje</>
  if (dia === ontem) return <>Ontem</>
  const semana = paraDataLocal(dia).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
  return (
    <>
      <span className="capitalize">{semana}</span> · <span className="font-mono">{diaMes(dia)}</span>
    </>
  )
}

/** Linha de lançamento no padrão do DESIGN.md (reusada pelo Início). */
export function LinhaLancamento({
  linha,
  categoria,
  membros,
  usuarioId,
  ocultar,
  aoTocar,
  mostrarData = false,
}: {
  linha: Linha
  categoria: Categoria | undefined
  membros: Map<string, Membro>
  usuarioId: string
  ocultar: boolean
  aoTocar?: () => void
  mostrarData?: boolean
}) {
  // "Gasto de um membro" é de quem pagou, senão de quem lançou: a linha mostra o mesmo dono.
  const dono = nomeDoMembro(membros.get(linha.paid_by ?? linha.created_by))
  const editor =
    linha.updated_by && linha.updated_by !== linha.created_by ? nomeDoMembro(membros.get(linha.updated_by), usuarioId) : null
  const partes = [linha.descricao && categoria ? categoria.nome : null, dono, editor ? `editado por ${editor}` : null].filter(Boolean)

  return (
    <LinhaLista
      inicio={<IconeCategoria categoria={categoria} />}
      titulo={
        <span className="flex items-center gap-1.5">
          <span className="truncate">{linha.descricao || categoria?.nome || 'Sem categoria'}</span>
          {linha.recurring_id && <SeloRecorrente />}
        </span>
      }
      subtitulo={
        <span className="flex flex-wrap items-center gap-x-1">
          {mostrarData && (
            <>
              <span className="font-mono">{diaMes(linha.occurred_on)}</span>
              <span>·</span>
            </>
          )}
          <span className="truncate">{partes.join(' · ')}</span>
          {linha.pendente && (
            <Badge tom="atencao" className="ml-1">
              pendente
            </Badge>
          )}
        </span>
      }
      fim={<Valor centavos={linha.amount_cents} tipo={linha.kind === 'income' ? 'entrada' : 'saida'} ocultar={ocultar} />}
      aoTocar={aoTocar}
      apagada={linha.pendente}
    />
  )
}
