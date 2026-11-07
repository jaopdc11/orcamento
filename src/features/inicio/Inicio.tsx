import { useMemo, useState } from 'react'
import { mesDe, mesPorExtenso } from '@/lib/datas'
import { mapaDeMembros, nomeDoMembro } from '@/lib/membros'
import { useMes } from '@/features/mes/useMes'
import type { Linha } from '@/features/mes/useMes'
import { LinhaLancamento } from '@/features/mes/Dashboard'
import { EditarLancamento } from '@/features/lancamentos/EditarLancamento'
import { arquivarLancamento } from '@/features/lancamentos/lancamentos.queries'
import {
  Aviso,
  BarraProgresso,
  CabecalhoTela,
  Cartao,
  Esqueleto,
  EsqueletoLista,
  Icone,
  IconeCategoria,
  Lista,
  Selo,
  Tabs,
  TituloSecao,
  cx,
  Valor,
  Vazio,
} from '@/design'
import type { ContextoOrcamento } from '@/lib/tipos'

// Escopo: num orçamento compartilhado cada um quer ver também só o seu lado.
// "De quem é" um lançamento = quem pagou; sem pagador, quem lançou (mesma regra
// das análises, lib/membros + core/escopo da API).
const donoDe = (l: Linha) => l.paid_by ?? l.created_by
const CHAVE_ESCOPO = (ledgerId: string) => `orcamento:inicio-escopo:${ledgerId}`

// Início: a tela de "como estamos este mês" em um olhar. Saldo grande, entrou e
// saiu, só as metas que pedem atenção (as tranquilas ficam no Mês) e os últimos
// lançamentos. Tudo do mesmo useMes do Mês, pra os números baterem.

export type Props = ContextoOrcamento

/** A partir daqui a meta aparece no Início: mesmo limiar do âmbar da BarraProgresso. */
const PERTO_DO_LIMITE = 0.85
const ULTIMOS = 5

export function Inicio({ orcamento, categorias, membros, usuarioId, ocultar }: Props) {
  const mes = useMemo(() => mesDe(), [])
  const { linhas, totais, porCategoria, carregando, erro, recarregar } = useMes(orcamento.id, mes, categorias)
  const [editando, setEditando] = useState<Linha | null>(null)
  const compartilhado = membros.length > 1
  const [escopo, setEscopoBruto] = useState<string>(() => {
    try {
      return localStorage.getItem(CHAVE_ESCOPO(orcamento.id)) ?? 'conjunto'
    } catch {
      return 'conjunto'
    }
  })
  // membro que saiu do orçamento não pode ficar preso como escopo salvo
  const escopoValido = !compartilhado || (escopo !== 'conjunto' && !membros.some((m) => m.user_id === escopo)) ? 'conjunto' : escopo
  function setEscopo(e: string) {
    setEscopoBruto(e)
    try {
      localStorage.setItem(CHAVE_ESCOPO(orcamento.id), e)
    } catch {
      /* só não lembra */
    }
  }
  const [abertos, setAbertos] = useState<Set<string>>(new Set())
  function alternar(uid: string) {
    setAbertos((a) => {
      const n = new Set(a)
      if (n.has(uid)) n.delete(uid)
      else n.add(uid)
      return n
    })
  }

  const mapaMembros = useMemo(() => mapaDeMembros(membros), [membros])
  const porId = useMemo(() => new Map(categorias.map((c) => [c.id, c])), [categorias])
  const doEscopo = useMemo(
    () => (escopoValido === 'conjunto' ? linhas : linhas.filter((l) => donoDe(l) === escopoValido)),
    [linhas, escopoValido],
  )
  const totaisEscopo = useMemo(() => {
    if (escopoValido === 'conjunto') return totais
    let entrou = 0
    let saiu = 0
    for (const l of doEscopo) {
      if (l.kind === 'income') entrou += l.amount_cents
      else saiu += l.amount_cents
    }
    return { entrou, saiu, saldo: entrou - saiu }
  }, [doEscopo, totais, escopoValido])
  // Uma seção por membro, cada uma com os lançamentos dele no mês (expansível).
  const porMembro = useMemo(
    () =>
      membros.map((m) => {
        const dele = linhas.filter((l) => donoDe(l) === m.user_id)
        let entrou = 0
        let saiu = 0
        for (const l of dele) {
          if (l.kind === 'income') entrou += l.amount_cents
          else saiu += l.amount_cents
        }
        return { membro: m, linhas: dele, entrou, saiu }
      }),
    [membros, linhas],
  )
  const ultimos = useMemo(() => doEscopo.slice(0, ULTIMOS), [doEscopo])
  const apertadas = useMemo(
    () =>
      porCategoria
        .filter((r) => r.meta !== null && r.meta > 0 && r.gasto / r.meta >= PERTO_DO_LIMITE)
        .sort((a, b) => b.gasto / (b.meta ?? 1) - a.gasto / (a.meta ?? 1)),
    [porCategoria],
  )
  const gastoPct = totaisEscopo.entrou > 0 ? (totaisEscopo.saiu / totaisEscopo.entrou) * 100 : 0

  return (
    <div>
      <CabecalhoTela selo={orcamento.nome} titulo="Início" descricao={<span className="capitalize">{mesPorExtenso(mes)}</span>} />
      {erro && (
        <Aviso className="mb-4" aoTentarDeNovo={() => void recarregar()}>
          {erro}
        </Aviso>
      )}

      {compartilhado && (
        <Tabs
          className="mb-4 max-w-full overflow-x-auto"
          ativa={escopoValido}
          aoTrocar={setEscopo}
          abas={[
            { id: usuarioId, rotulo: 'Eu' },
            ...membros
              .filter((m) => m.user_id !== usuarioId)
              .map((m) => ({ id: m.user_id, rotulo: nomeDoMembro(m, usuarioId) })),
            { id: 'conjunto', rotulo: 'Juntos' },
          ]}
        />
      )}

      <div className="cascata space-y-3">
        <Cartao>
          <Selo className="mb-2">{escopoValido === 'conjunto' ? 'Saldo do mês' : `Saldo do mês · ${escopoValido === usuarioId ? 'seu' : nomeDoMembro(mapaMembros.get(escopoValido), usuarioId)}`}</Selo>
          {carregando ? (
            <Esqueleto className="h-10 w-48" />
          ) : (
            <Valor centavos={totaisEscopo.saldo} tipo="auto" tamanho="heroi" ocultar={ocultar} animar />
          )}
          {totaisEscopo.entrou > 0 && (
            <BarraProgresso className="mt-4" percentual={gastoPct} tom="acento" rotulo="das entradas já saiu" />
          )}
        </Cartao>

        <div className="grid grid-cols-2 gap-3">
          <Cartao>
            <Selo className="mb-2">Entrou</Selo>
            {carregando ? <Esqueleto className="h-7 w-24" /> : <Valor centavos={totaisEscopo.entrou} tipo="entrada" tamanho="lg" ocultar={ocultar} />}
          </Cartao>
          <Cartao>
            <Selo className="mb-2">Saiu</Selo>
            {carregando ? <Esqueleto className="h-7 w-24" /> : <Valor centavos={totaisEscopo.saiu} tipo="saida" tamanho="lg" ocultar={ocultar} />}
          </Cartao>
        </div>
      </div>

      {apertadas.length > 0 && (
        <section className="mt-6">
          <TituloSecao selo="Atenção" titulo="Metas perto do limite" className="mb-3" />
          <Cartao>
            <ul className="cascata space-y-4">
              {apertadas.map((r) => (
                <li key={r.categoria.id} className="flex items-center gap-3">
                  <IconeCategoria categoria={r.categoria} tamanho="sm" />
                  <BarraProgresso
                    className="flex-1"
                    percentual={((r.gasto / (r.meta ?? 1)) * 100)}
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
              ))}
            </ul>
          </Cartao>
        </section>
      )}

      {compartilhado && !carregando && (
        <section className="mt-6">
          <TituloSecao selo="Por pessoa" titulo="Quem lançou o quê" className="mb-3" />
          <div className="cascata space-y-2">
            {porMembro.map(({ membro, linhas: dele, entrou, saiu }) => {
              const aberto = abertos.has(membro.user_id)
              return (
                <Cartao key={membro.user_id} semPadding>
                  <button
                    type="button"
                    aria-expanded={aberto}
                    onClick={() => alternar(membro.user_id)}
                    className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-superficie-alta/50"
                  >
                    <Icone
                      n="chevronRight"
                      className={cx('h-4 w-4 shrink-0 text-tenue transition-transform duration-200 ease-suave', aberto && 'rotate-90')}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-texto">{nomeDoMembro(membro, usuarioId)}</span>
                      <span className="text-xs text-tenue">
                        <span className="font-mono">{dele.length}</span> lançamento{dele.length === 1 ? '' : 's'}
                      </span>
                    </span>
                    <span className="flex flex-col items-end gap-0.5">
                      <Valor centavos={saiu} tipo="saida" tamanho="sm" ocultar={ocultar} />
                      {entrou > 0 && <Valor centavos={entrou} tipo="entrada" tamanho="sm" ocultar={ocultar} />}
                    </span>
                  </button>
                  {aberto && (
                    <div className="animate-subir border-t border-borda">
                      {dele.length === 0 ? (
                        <p className="px-4 py-4 text-sm text-tenue">Nada lançado este mês.</p>
                      ) : (
                        <Lista semCartao>
                          {dele.map((l) => (
                            <LinhaLancamento
                              key={l.id}
                              linha={l}
                              categoria={l.category_id ? porId.get(l.category_id) : undefined}
                              membros={mapaMembros}
                              usuarioId={usuarioId}
                              ocultar={ocultar}
                              mostrarData
                              aoTocar={l.pendente ? undefined : () => setEditando(l)}
                            />
                          ))}
                        </Lista>
                      )}
                    </div>
                  )}
                </Cartao>
              )
            })}
          </div>
        </section>
      )}

      <section className="mt-6">
        <TituloSecao selo="Recentes" titulo="Últimos lançamentos" className="mb-3" />
        {carregando ? (
          <EsqueletoLista linhas={3} />
        ) : ultimos.length === 0 ? (
          <Cartao>
            <Vazio
              compacto
              icone="wallet"
              titulo="O mês está em branco."
              descricao={
                <span className="inline-flex items-center gap-1">
                  Toque no <Icone n="plus" className="h-3.5 w-3.5 text-acento" /> pra lançar o primeiro gasto.
                </span>
              }
            />
          </Cartao>
        ) : (
          <Lista cascata>
            {ultimos.map((l) => (
              <LinhaLancamento
                key={l.id}
                linha={l}
                categoria={l.category_id ? porId.get(l.category_id) : undefined}
                membros={mapaMembros}
                usuarioId={usuarioId}
                ocultar={ocultar}
                mostrarData
                aoTocar={l.pendente ? undefined : () => setEditando(l)}
              />
            ))}
          </Lista>
        )}
      </section>

      {editando && (
        <EditarLancamento
          lancamento={editando}
          categorias={categorias}
          membros={mapaMembros}
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
