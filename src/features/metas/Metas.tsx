import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Aviso,
  Badge,
  BarraProgresso,
  Botao,
  BotaoIcone,
  CabecalhoTela,
  Cartao,
  Esqueleto,
  EsqueletoLista,
  Icone,
  IconeCategoria,
  Selo,
  Sheet,
  TituloSecao,
  Valor,
  Vazio,
  cx,
  useToast,
  vibrar, TecladoValor,
} from '@/design'
import { deslocarMes, mesDe, mesPorExtenso } from '@/lib/datas'
import { comAtraso, ouvirOrcamento } from '@/lib/eventos'
import type { Categoria, ContextoOrcamento, Economia, Meta } from '@/lib/tipos'
import {
  buscarEconomia,
  buscarMetas,
  copiarMetasDoMesAnterior,
  definirEconomia,
  definirMeta,
  gastoPorCategoria,
} from './metas.queries'

export type Props = ContextoOrcamento

// A partir daqui a barra fica âmbar: dá tempo de segurar antes de estourar.
// Mesmo limiar do aviso por push (F8), em %.
const ALERTA = 80

type Dados = { metas: Meta[]; gasto: Map<string, number>; economia: Economia }

// O que está aberto no Sheet de valor: limite de uma categoria ou a meta de economia.
type Edicao = { tipo: 'limite'; categoria: Categoria; atual: number | null } | { tipo: 'economia'; atual: number | null }

const msg = (e: unknown, padrao: string) => (e instanceof Error ? e.message : padrao)

/** Metas são do orçamento inteiro: não há seletor de escopo aqui de propósito. */
/** `mesInicial`: mês vindo de um aviso de meta tocado; sem ele, o mês corrente. */
export function Metas({ orcamento, categorias, ocultar, mesInicial }: Props & { mesInicial?: string }) {
  const ledgerId = orcamento.id
  const toast = useToast()
  const [mes, setMes] = useState(() => mesInicial ?? mesDe())
  const [dados, setDados] = useState<Dados | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [edicao, setEdicao] = useState<Edicao | null>(null)
  const [copiando, setCopiando] = useState(false)

  const recarregar = useCallback(async () => {
    try {
      const [metas, gasto, economia] = await Promise.all([
        buscarMetas(ledgerId, mes),
        gastoPorCategoria(ledgerId, mes),
        buscarEconomia(ledgerId, mes),
      ])
      setDados({ metas, gasto, economia })
      setErro(null)
    } catch (e) {
      setErro(msg(e, 'Não deu pra carregar.'))
    }
  }, [ledgerId, mes])

  useEffect(() => {
    setDados(null)
    void recarregar()
  }, [recarregar])

  // 'historico' chega junto de toda mudança; ouvir só os tipos que mexem aqui
  // evita reler em dobro.
  useEffect(() => {
    const releitura = comAtraso(() => void recarregar())
    const parar = ouvirOrcamento(ledgerId, (tipo) => {
      if (tipo === 'metas' || tipo === 'lancamentos' || tipo === 'economia') releitura.chamar()
    })
    return () => {
      parar()
      releitura.cancelar()
    }
  }, [ledgerId, recarregar])

  const linhas = useMemo(() => {
    if (!dados) return []
    const limite = new Map(dados.metas.map((m) => [m.category_id, m.limit_cents]))
    return categorias
      .filter((c) => c.kind === 'expense')
      .map((categoria) => ({
        categoria,
        gasto: dados.gasto.get(categoria.id) ?? 0,
        meta: limite.get(categoria.id) ?? null,
      }))
      // Com meta primeiro, mais perto de estourar no topo: é o que a pessoa
      // abre a tela pra ver. Sem meta vem depois, por gasto.
      .sort((a, b) => {
        if ((a.meta === null) !== (b.meta === null)) return a.meta === null ? 1 : -1
        if (a.meta !== null && b.meta !== null) return b.gasto / b.meta - a.gasto / a.meta
        return b.gasto - a.gasto
      })
  }, [dados, categorias])

  const comMeta = useMemo(() => linhas.filter((l) => l.meta !== null), [linhas])
  const semMeta = useMemo(() => linhas.filter((l) => l.meta === null), [linhas])

  const resumo = useMemo(
    () => ({
      estouradas: comMeta.filter((l) => l.gasto > l.meta!).length,
      limite: comMeta.reduce((s, l) => s + l.meta!, 0),
      gasto: comMeta.reduce((s, l) => s + l.gasto, 0),
    }),
    [comMeta],
  )

  async function copiar() {
    setCopiando(true)
    try {
      const n = await copiarMetasDoMesAnterior(ledgerId, mes)
      if (n === 0) toast.mostrar('O mês anterior não tinha limites.', { tom: 'info' })
      else {
        vibrar('sucesso')
        toast.mostrar(`${n} limite${n > 1 ? 's' : ''} copiado${n > 1 ? 's' : ''}`)
      }
      await recarregar()
    } catch (e) {
      toast.mostrar(msg(e, 'Não deu pra copiar.'), { tom: 'erro' })
    } finally {
      setCopiando(false)
    }
  }

  /** 0 remove: é o contrato da API pros dois tipos de meta. */
  async function salvar(e: Edicao, centavos: number) {
    if (centavos === (e.atual ?? 0)) return
    if (e.tipo === 'limite') await definirMeta(ledgerId, e.categoria.id, mes, centavos)
    else await definirEconomia(ledgerId, mes, centavos)
    const removeu = centavos === 0
    vibrar(removeu ? 'aviso' : 'sucesso')
    toast.mostrar(
      e.tipo === 'limite'
        ? `Limite de ${e.categoria.nome} ${removeu ? 'removido' : 'salvo'}`
        : `Meta de economia ${removeu ? 'removida' : 'salva'}`,
    )
    await recarregar()
  }

  const temMes = mesPorExtenso(mes)

  return (
    <div className="mx-auto max-w-2xl">
      <CabecalhoTela selo={temMes} titulo="Metas" descricao="Limites por categoria e quanto guardar no mês" />

      {/* seletor de mês: alvos de 44px nos dois lados */}
      <div className="mb-5 flex items-center justify-between rounded-card border border-borda bg-campo p-1">
        <BotaoIcone rotulo="mês anterior" onClick={() => setMes(deslocarMes(mes, -1))}>
          <Icone n="chevronLeft" className="h-5 w-5" />
        </BotaoIcone>
        <span className="text-sm font-semibold capitalize text-texto">{temMes}</span>
        <BotaoIcone rotulo="próximo mês" onClick={() => setMes(deslocarMes(mes, 1))}>
          <Icone n="chevronRight" className="h-5 w-5" />
        </BotaoIcone>
      </div>

      {erro && (
        <Aviso className="mb-4" aoTentarDeNovo={() => void recarregar()}>
          {erro}
        </Aviso>
      )}

      {!dados ? (
        !erro && (
          <div className="space-y-6">
            <Esqueleto className="h-40 w-full rounded-card" />
            <EsqueletoLista linhas={4} />
          </div>
        )
      ) : (
        <div key={mes} className="cascata space-y-6">
          <CartaoEconomia economia={dados.economia} ocultar={ocultar} aoEditar={() => setEdicao({ tipo: 'economia', atual: dados.economia.target_cents })} />

          <section>
            <TituloSecao
              selo={
                comMeta.length > 0 ? (
                  <span className="font-mono normal-case tracking-normal">
                    {comMeta.length} limite{comMeta.length > 1 ? 's' : ''}
                  </span>
                ) : (
                  'Gastos'
                )
              }
              titulo="Limite por categoria"
              acao={
                <Botao variante="secundario" tamanho="sm" carregando={copiando} onClick={() => void copiar()} icone={<Icone n="repeat" className="h-4 w-4" />}>
                  copiar do mês anterior
                </Botao>
              }
            />

            {comMeta.length > 0 && (
              <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-suave">
                <Valor centavos={resumo.gasto} tamanho="sm" ocultar={ocultar} />
                <span>de</span>
                <Valor centavos={resumo.limite} tamanho="sm" ocultar={ocultar} className="text-suave" />
                {resumo.estouradas > 0 && (
                  <Badge tom="saida" mono>
                    {resumo.estouradas} estourada{resumo.estouradas > 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
            )}

            {linhas.length === 0 ? (
              <Cartao>
                <Vazio compacto icone="target" titulo="Nenhuma categoria de gasto ainda." descricao="Crie categorias nas configurações do orçamento pra pôr limite nelas." />
              </Cartao>
            ) : (
              <div className="space-y-3">
                {comMeta.length > 0 && (
                  <ul className="cascata space-y-2">
                    {comMeta.map((l) => (
                      <CartaoLimite
                        key={l.categoria.id}
                        categoria={l.categoria}
                        gasto={l.gasto}
                        meta={l.meta!}
                        ocultar={ocultar}
                        aoTocar={() => setEdicao({ tipo: 'limite', categoria: l.categoria, atual: l.meta })}
                      />
                    ))}
                  </ul>
                )}

                {semMeta.length > 0 && (
                  <div>
                    {comMeta.length > 0 && <Selo className="mb-2 mt-4">Sem limite</Selo>}
                    {comMeta.length === 0 && (
                      <p className="mb-2 text-sm text-suave">Nenhum limite neste mês. Um por categoria já ajuda: toque numa pra definir.</p>
                    )}
                    <ul className="cascata overflow-hidden rounded-card border border-borda bg-superficie shadow-card divide-y divide-borda">
                      {semMeta.map((l) => (
                        <li key={l.categoria.id}>
                          <button
                            type="button"
                            onClick={() => setEdicao({ tipo: 'limite', categoria: l.categoria, atual: null })}
                            aria-label={`definir limite de ${l.categoria.nome}`}
                            className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left transition-[transform,background-color] duration-150 ease-suave hover:bg-superficie-alta/50 active:scale-[0.985] active:bg-superficie-alta"
                          >
                            <IconeCategoria categoria={l.categoria} tamanho="sm" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm text-texto">{l.categoria.nome}</span>
                              <span className="block text-xs text-tenue">
                                gastou <Valor centavos={l.gasto} tamanho="sm" ocultar={ocultar} className="text-xs text-tenue" />
                              </span>
                            </span>
                            <Badge tom="acento">
                              <Icone n="plus" className="h-3 w-3" /> limite
                            </Badge>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      )}

      <SheetValor edicao={edicao} aoFechar={() => setEdicao(null)} aoSalvar={salvar} />
    </div>
  )
}

function CartaoEconomia({ economia, ocultar, aoEditar }: { economia: Economia; ocultar: boolean; aoEditar: () => void }) {
  const { target_cents: alvo, guardado_cents: guardado, entrou_cents, saiu_cents } = economia
  const pct = alvo ? (Math.max(0, guardado) / alvo) * 100 : 0
  const bateu = alvo !== null && guardado >= alvo
  const negativo = guardado < 0

  return (
    <Cartao className="relative">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Selo tom="acento">Meta de economia</Selo>
          <p className="mt-1 text-xs text-suave">Guardado = entrou − saiu</p>
        </div>
        <Botao variante="fantasma" tamanho="sm" onClick={aoEditar} icone={<Icone n={alvo === null ? 'plus' : 'pencil'} className="h-4 w-4" />}>
          {alvo === null ? 'definir meta' : 'editar'}
        </Botao>
      </div>

      <div className="mt-3 flex flex-wrap items-baseline gap-x-2">
        <Valor centavos={guardado} tipo={negativo ? 'saida' : 'neutro'} sinal={negativo} tamanho="heroi" ocultar={ocultar} animar />
        {alvo !== null && (
          <span className="text-sm text-tenue">
            / <Valor centavos={alvo} tamanho="sm" ocultar={ocultar} className="text-tenue" />
          </span>
        )}
      </div>

      {alvo !== null ? (
        <div className="mt-4">
          <BarraProgresso alta percentual={pct} tom={bateu ? 'entrada' : negativo ? 'saida' : 'acento'} avisoEm={null} />
          <p className={cx('mt-2 text-xs', negativo ? 'text-saida' : bateu ? 'text-entrada' : 'text-suave')}>
            {negativo ? (
              'Saiu mais do que entrou neste mês.'
            ) : bateu ? (
              <span className="inline-flex animate-pop items-center gap-1">
                <Icone n="check" className="h-3.5 w-3.5" /> Meta batida!
              </span>
            ) : (
              <>
                Faltam <Valor centavos={alvo - guardado} tamanho="sm" ocultar={ocultar} className="text-xs" />{' '}
                <span className="font-mono">({Math.round(pct)}%)</span>
              </>
            )}
          </p>
        </div>
      ) : (
        <p className="mt-3 text-xs text-suave">Sem meta neste mês. Defina quanto quer guardar e acompanhe aqui.</p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-borda pt-3">
        <div>
          <Selo>Entrou</Selo>
          <Valor centavos={entrou_cents} tipo="entrada" tamanho="sm" ocultar={ocultar} />
        </div>
        <div>
          <Selo>Saiu</Selo>
          <Valor centavos={saiu_cents} tipo="saida" tamanho="sm" ocultar={ocultar} />
        </div>
      </div>
    </Cartao>
  )
}

function CartaoLimite({
  categoria,
  gasto,
  meta,
  ocultar,
  aoTocar,
}: {
  categoria: Categoria
  gasto: number
  meta: number
  ocultar: boolean
  aoTocar: () => void
}) {
  const pct = meta ? (gasto / meta) * 100 : 0
  const estourou = gasto > meta

  return (
    <li>
      <button
        type="button"
        onClick={aoTocar}
        aria-label={`editar limite de ${categoria.nome}`}
        className={cx(
          'block w-full rounded-card border bg-superficie p-4 text-left shadow-card transition-[transform,border-color] duration-150 ease-suave hover:border-borda-forte active:scale-[0.97]',
          estourou ? 'border-saida/50' : 'border-borda',
        )}
      >
        <div className="flex items-center gap-3">
          <IconeCategoria categoria={categoria} tamanho="sm" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-texto">{categoria.nome}</span>
          <span className="shrink-0 text-right text-sm">
            <Valor centavos={gasto} tamanho="sm" ocultar={ocultar} className={estourou ? 'text-saida' : 'text-texto'} />
            <span className="text-tenue"> / </span>
            <Valor centavos={meta} tamanho="sm" ocultar={ocultar} className="text-tenue" />
          </span>
        </div>
        <BarraProgresso percentual={pct} tom="entrada" avisoEm={ALERTA} className="mt-3" />
        <div className="mt-2 flex items-center justify-between gap-2 text-xs">
          {estourou ? (
            <span className="text-saida">
              Estourou em <Valor centavos={gasto - meta} tamanho="sm" ocultar={ocultar} className="text-xs" />
            </span>
          ) : (
            <span className="text-suave">
              Resta <Valor centavos={meta - gasto} tamanho="sm" ocultar={ocultar} className="text-xs" />
            </span>
          )}
          {estourou ? (
            <Badge tom="saida" mono>
              {Math.round(pct)}%
            </Badge>
          ) : (
            <span className={cx('font-mono', pct >= ALERTA ? 'text-atencao' : 'text-tenue')}>{Math.round(pct)}%</span>
          )}
        </div>
      </button>
    </li>
  )
}

/** Sheet com teclado de caixa registradora. Zerar = remover a meta. */
function SheetValor({
  edicao,
  aoFechar,
  aoSalvar,
}: {
  edicao: Edicao | null
  aoFechar: () => void
  aoSalvar: (e: Edicao, centavos: number) => Promise<void>
}) {
  const [centavos, setCentavos] = useState(0)
  const [salvando, setSalvando] = useState(false)
  const [falha, setFalha] = useState<string | null>(null)

  // reabre sempre com o valor atual de quem foi tocado
  useEffect(() => {
    if (!edicao) return
    setCentavos(edicao.atual ?? 0)
    setFalha(null)
    setSalvando(false)
  }, [edicao])

  async function enviar(valor: number) {
    if (!edicao) return
    setSalvando(true)
    try {
      await aoSalvar(edicao, valor)
      aoFechar()
    } catch (e) {
      vibrar('erro')
      setFalha(msg(e, 'Não deu pra salvar.'))
      setSalvando(false)
    }
  }

  const titulo = edicao?.tipo === 'limite' ? edicao.categoria.nome : 'Quanto guardar'
  const temAtual = edicao?.atual != null

  return (
    <Sheet
      aberto={!!edicao}
      aoFechar={aoFechar}
      selo={edicao?.tipo === 'limite' ? 'Limite do mês' : 'Meta de economia'}
      titulo={titulo}
      largura="sm"
      rodape={
        <>
          {temAtual && (
            <Botao variante="perigo" disabled={salvando} onClick={() => void enviar(0)}>
              Remover
            </Botao>
          )}
          <Botao variante="fantasma" className="flex-1" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao className="flex-1" carregando={salvando} onClick={() => void enviar(centavos)}>
            Salvar
          </Botao>
        </>
      }
    >
      {edicao?.tipo === 'limite' && (
        <div className="mb-4 flex justify-center">
          <IconeCategoria categoria={edicao.categoria} tamanho="lg" />
        </div>
      )}
      <TecladoValor
        centavos={centavos}
        aoMudar={setCentavos}
        rotulo={edicao?.tipo === 'limite' ? 'Gastar no máximo' : 'Guardar pelo menos'}
        vazio={temAtual ? 'remover' : 'R$ 0,00'}
      />
      {falha && <p className="mt-3 text-center text-xs text-perigo">{falha}</p>}
    </Sheet>
  )
}
