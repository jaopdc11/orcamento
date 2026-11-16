import { useCallback, useEffect, useMemo, useState } from 'react'
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  Aviso,
  Badge,
  BarraProgresso,
  Botao,
  BotaoIcone,
  CabecalhoTela,
  Campo,
  Cartao,
  Chip,
  CORES_GRAFICO,
  EsqueletoLista,
  FileiraChips,
  Icone,
  Lista,
  LinhaLista,
  Select,
  Selo,
  Sheet,
  Tabs,
  TecladoValor,
  TICK_GRAFICO,
  TituloSecao,
  TOOLTIP_GRAFICO,
  Valor,
  Vazio,
  cx,
  useToast,
  vibrar,
} from '@/design'
import { formatar } from '@/lib/dinheiro'
import { comAtraso, ouvirOrcamento } from '@/lib/eventos'
import { diaMes, hoje, mesDe, mesPorExtenso } from '@/lib/datas'
import { mapaDeMembros, nomeDoMembro } from '@/lib/membros'
import { uuidv7 } from '@/lib/uuidv7'
import type {
  Carteira,
  ContextoOrcamento,
  Indexador,
  Investimento,
  Membro,
  MetaAporte,
  Movimento,
  Pendencia,
  PontoCarteira,
  RecorrenteInvestimento,
  TipoInvestimento,
} from '@/lib/tipos'
import {
  apagarInvestimento,
  apagarMovimento,
  buscarCarteira,
  buscarEvolucao,
  buscarMetaAporte,
  confirmarPendencia,
  criarInvestimento,
  definirMetaAporte,
  editarInvestimento,
  listarMovimentos,
  recusarPendencia,
  registrarMovimento,
  type EdicaoDeInvestimento,
} from './investimentos.queries'

export type Props = ContextoOrcamento & { investimentoInicial?: string }

const msg = (e: unknown) => (e instanceof Error ? e.message : 'Não deu certo.')
const OCULTO = 'R$ ••••'

const TIPOS: { id: TipoInvestimento; rotulo: string; curto: string }[] = [
  { id: 'acao', rotulo: 'Ação', curto: 'AÇÃO' },
  { id: 'fii', rotulo: 'FII', curto: 'FII' },
  { id: 'etf', rotulo: 'ETF', curto: 'ETF' },
  { id: 'cripto', rotulo: 'Cripto', curto: 'CRIPTO' },
  { id: 'renda_fixa', rotulo: 'Renda fixa', curto: 'RF' },
  { id: 'outro', rotulo: 'Outro', curto: 'OUTRO' },
]
const rotuloTipo = (t: TipoInvestimento) => TIPOS.find((x) => x.id === t)!.rotulo
const ehMercado = (t: TipoInvestimento) => t === 'acao' || t === 'fii' || t === 'etf' || t === 'cripto'

const INDEXADORES: { id: Indexador; rotulo: string }[] = [
  { id: 'cdi', rotulo: 'CDI' },
  { id: 'selic', rotulo: 'Selic' },
  { id: 'ipca', rotulo: 'IPCA+' },
  { id: 'prefixado', rotulo: 'Prefixado' },
]

const PERIODOS = [
  { id: '30', rotulo: '30 dias' },
  { id: '90', rotulo: '3 meses' },
  { id: '365', rotulo: '1 ano' },
] as const
type Periodo = (typeof PERIODOS)[number]['id']

/** Classe de ativo: o filtro em abas e os grupos da lista. */
type Classe = 'renda_fixa' | 'variavel' | 'cripto' | 'outro'
type FiltroClasse = 'tudo' | Classe
const CLASSES: { id: Classe; rotulo: string }[] = [
  { id: 'renda_fixa', rotulo: 'Renda fixa' },
  { id: 'variavel', rotulo: 'Renda variável' },
  { id: 'cripto', rotulo: 'Cripto' },
  { id: 'outro', rotulo: 'Outros' },
]
function classeDe(t: TipoInvestimento): Classe {
  if (t === 'renda_fixa') return 'renda_fixa'
  if (t === 'cripto') return 'cripto'
  if (t === 'outro') return 'outro'
  return 'variavel'
}

const numero = (v: number, max = 8) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: max }).format(v)

/** taxa em centésimos → '110' / '12,5' (o que a pessoa digita). */
const taxaTexto = (t: number | null) => (t === null ? '' : numero(t / 100, 2))
/** '110' / '12,5' → centésimos; null se inválido. */
function taxaDe(texto: string): number | null {
  const n = Number(texto.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null
}

function rotuloTaxa(ix: Indexador): string {
  if (ix === 'prefixado') return 'Taxa ao ano (%)'
  if (ix === 'ipca') return 'Juro real ao ano (%), além do IPCA'
  return `Percentual do ${ix === 'cdi' ? 'CDI' : 'Selic'} (%)`
}

function descricaoTaxa(i: Pick<Investimento, 'indexador' | 'taxa'>): string {
  if (!i.indexador || i.taxa === null) return ''
  if (i.indexador === 'prefixado') return `${taxaTexto(i.taxa)}% a.a.`
  if (i.indexador === 'ipca') return `IPCA + ${taxaTexto(i.taxa)}% a.a.`
  return `${taxaTexto(i.taxa)}% do ${i.indexador === 'cdi' ? 'CDI' : 'Selic'}`
}

/** Variação em % do investido, em texto ('+12,4%'). null quando não há base. */
function percentual(rendimento: number, investido: number): string | null {
  if (investido <= 0) return null
  const p = (rendimento / investido) * 100
  return `${p > 0 ? '+' : p < 0 ? '−' : ''}${numero(Math.abs(p), 1)}%`
}

const unidade = (t: TipoInvestimento) => (t === 'cripto' ? 'un.' : 'cotas')

function rotuloPendencia(p: Pendencia): string {
  if (p.tipo === 'aporte_recorrente') return 'Aporte recorrente'
  const r = p.rotulo ?? ''
  if (/JCP|JUROS/.test(r)) return 'JCP'
  if (r.includes('RENDIMENTO')) return 'Rendimento'
  if (r.includes('DIVIDEND')) return 'Dividendo'
  return 'Provento'
}

export function Investimentos({ orcamento, usuarioId, membros, ocultar, investimentoInicial }: Props) {
  const ledgerId = orcamento.id
  const toast = useToast()
  const mes = mesDe()
  const [carteira, setCarteira] = useState<Carteira | null>(null)
  const [meta, setMeta] = useState<MetaAporte | null>(null)
  const [periodo, setPeriodo] = useState<Periodo>('90')
  const dias = Number(periodo)
  const [filtro, setFiltro] = useState<FiltroClasse>('tudo')
  const [evolucao, setEvolucao] = useState<PontoCarteira[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [criando, setCriando] = useState(false)
  const [editandoMeta, setEditandoMeta] = useState(false)
  const [ajustando, setAjustando] = useState<Pendencia | null>(null)
  const [abertoId, setAbertoId] = useState<string | null>(investimentoInicial ?? null)
  const [abertosPessoa, setAbertosPessoa] = useState<Set<string>>(new Set())

  // Escopo, igual ao Início: Eu / cada membro / Juntos. A parte de cada um vem da API
  // (dono do movimento = quem pagou, senão quem lançou).
  const compartilhado = membros.length > 1
  const [escopo, setEscopoBruto] = useState<string>(() => {
    try {
      return localStorage.getItem(CHAVE_ESCOPO(ledgerId)) ?? 'conjunto'
    } catch {
      return 'conjunto'
    }
  })
  const escopoValido =
    !compartilhado || (escopo !== 'conjunto' && !membros.some((m) => m.user_id === escopo)) ? 'conjunto' : escopo
  function setEscopo(e: string) {
    setEscopoBruto(e)
    try {
      localStorage.setItem(CHAVE_ESCOPO(ledgerId), e)
    } catch {
      /* só não lembra */
    }
  }
  const porMembroMapa = useMemo(() => mapaDeMembros(membros), [membros])
  const nomeEscopo = escopoValido === usuarioId ? 'seu' : nomeDoMembro(porMembroMapa.get(escopoValido), usuarioId)

  const recarregar = useCallback(async () => {
    try {
      const [c, m] = await Promise.all([buscarCarteira(ledgerId), buscarMetaAporte(ledgerId, mes)])
      setCarteira(c)
      setMeta(m)
      setErro(null)
    } catch (e) {
      setErro(msg(e))
    }
  }, [ledgerId, mes])

  const recarregarEvolucao = useCallback(async () => {
    try {
      const ev = await buscarEvolucao(ledgerId, dias)
      setEvolucao(Array.isArray(ev) ? ev : [])
    } catch {
      setEvolucao([])
    }
  }, [ledgerId, dias])

  useEffect(() => {
    setCarteira(null)
    void recarregar()
  }, [recarregar])

  // depois da carteira: é a leitura dela que grava a foto de hoje
  useEffect(() => {
    if (carteira) void recarregarEvolucao()
  }, [carteira, recarregarEvolucao])

  useEffect(() => {
    const releitura = comAtraso(() => void recarregar())
    const parar = ouvirOrcamento(ledgerId, (tipo) => {
      if (tipo === 'investimentos') releitura.chamar()
    })
    return () => {
      parar()
      releitura.cancelar()
    }
  }, [ledgerId, recarregar])

  const todos = useMemo(() => carteira?.itens ?? [], [carteira])
  // No escopo de uma pessoa, cada investimento aparece com a PARTE dela (e só os que ela tem).
  const itens = useMemo(
    () => (escopoValido === 'conjunto' ? todos : todos.flatMap((i) => (parteDe(i, escopoValido) ? [comParte(i, parteDe(i, escopoValido)!)] : []))),
    [todos, escopoValido],
  )
  const totais = useMemo(() => {
    if (!carteira) return { valor: 0, investido: 0, rendimento: 0 }
    if (escopoValido === 'conjunto') {
      return { valor: carteira.valor_atual_cents, investido: carteira.investido_cents, rendimento: carteira.rendimento_cents }
    }
    const p = (carteira.por_membro ?? []).find((x) => x.user_id === escopoValido)
    return { valor: p?.valor_cents ?? 0, investido: p?.investido_cents ?? 0, rendimento: (p?.valor_cents ?? 0) - (p?.investido_cents ?? 0) }
  }, [carteira, escopoValido])
  const evolucaoEscopo = useMemo(() => {
    if (!evolucao || escopoValido === 'conjunto') return evolucao
    // foto antiga sem a divisão por membro fica de fora do gráfico de uma pessoa
    return evolucao.flatMap((p) => {
      if (!p.por_membro) return []
      const m = p.por_membro.find((x) => x.user_id === escopoValido)
      return [{ ...p, valor_cents: m?.valor_cents ?? 0, investido_cents: m?.investido_cents ?? 0 }]
    })
  }, [evolucao, escopoValido])
  // Uma seção por membro, cada uma com os investimentos dele (expansível), como "Quem lançou o quê".
  const pessoas = useMemo(
    () =>
      membros.map((m) => {
        const t = (carteira?.por_membro ?? []).find((x) => x.user_id === m.user_id)
        const dele = todos.filter((i) => !i.encerrado).flatMap((i) => (parteDe(i, m.user_id) ? [comParte(i, parteDe(i, m.user_id)!)] : []))
        return { membro: m, itens: dele, valor: t?.valor_cents ?? 0, investido: t?.investido_cents ?? 0 }
      }),
    [membros, carteira, todos],
  )
  const pendencias = useMemo(() => carteira?.pendencias ?? [], [carteira])
  const ativos = useMemo(() => itens.filter((i) => !i.encerrado), [itens])
  const encerrados = useMemo(() => itens.filter((i) => i.encerrado), [itens])
  // abas só das classes que existem na carteira (Tudo sempre)
  const abasClasse = useMemo(
    () => [
      { id: 'tudo' as FiltroClasse, rotulo: 'Tudo' },
      ...CLASSES.filter((c) => ativos.some((i) => classeDe(i.tipo) === c.id)).map((c) => ({
        id: c.id as FiltroClasse,
        // curtos: no celular as abas dividem a largura e 'Renda fixa' quebrava em duas linhas
        rotulo: c.id === 'variavel' ? 'Variável' : c.id === 'renda_fixa' ? 'Fixa' : c.rotulo,
      })),
    ],
    [ativos],
  )
  // filtro que sumiu (último ativo da classe encerrado/apagado) volta pro Tudo
  useEffect(() => {
    if (!abasClasse.some((a) => a.id === filtro)) setFiltro('tudo')
  }, [abasClasse, filtro])
  const grupos = useMemo(
    () =>
      CLASSES.filter((c) => filtro === 'tudo' || c.id === filtro)
        .map((c) => ({ ...c, itens: ativos.filter((i) => classeDe(i.tipo) === c.id) }))
        .filter((g) => g.itens.length > 0),
    [ativos, filtro],
  )
  // a ficha mostra o investimento inteiro (e de quem é cada parte), não só a parte do escopo
  const aberto = useMemo(() => todos.find((i) => i.id === abertoId), [todos, abertoId])
  const algumDesatualizado = ativos.some((i) => i.desatualizado)

  async function resolverPendencia(p: Pendencia, acao: 'confirmar' | 'recusar') {
    try {
      if (acao === 'confirmar') {
        await confirmarPendencia(ledgerId, p.id)
        vibrar('sucesso')
        toast.mostrar(`${rotuloPendencia(p)} de ${p.investimento} lançado no mês`)
      } else {
        await recusarPendencia(ledgerId, p.id)
        vibrar('aviso')
        toast.mostrar(`${rotuloPendencia(p)} descartado`, { tom: 'info' })
      }
      await recarregar()
    } catch (e) {
      vibrar('erro')
      setErro(msg(e))
    }
  }

  const botaoNovo = (
    <Botao tamanho="sm" onClick={() => setCriando(true)} icone={<Icone n="plus" className="h-4 w-4" />}>
      Novo
    </Botao>
  )

  const linha = (i: Investimento) => (
    <LinhaLista
      key={i.id}
      apagada={i.encerrado}
      inicio={<MarcaTipo tipo={i.tipo} />}
      titulo={
        <span className="flex items-center gap-1.5">
          <span className="truncate">{i.nome}</span>
          {i.ticker && (
            <Badge mono className="uppercase">
              {i.ticker}
            </Badge>
          )}
          {i.recorrente && !i.encerrado && (
            <span title="Aporte recorrente" className="text-tenue">
              <Icone n="repeat" className="h-3 w-3" />
            </span>
          )}
        </span>
      }
      subtitulo={
        <span className="flex flex-wrap items-center gap-x-1">
          <span className="truncate">{i.encerrado ? 'encerrado' : resumoPosicao(i)}</span>
          {i.desatualizado && (
            <Badge tom="atencao" className="ml-1">
              sem cotação nova
            </Badge>
          )}
        </span>
      }
      fim={
        <span className="flex flex-col items-end">
          <Valor centavos={i.encerrado ? i.rendimento_cents : i.valor_atual_cents} tipo={i.encerrado ? 'auto' : 'neutro'} tamanho="sm" ocultar={ocultar} />
          {!i.encerrado && i.investido_cents > 0 && (
            <Valor centavos={i.rendimento_cents} tipo="auto" tamanho="sm" ocultar={ocultar} className="mt-0.5 text-xs" />
          )}
        </span>
      }
      aoTocar={() => setAbertoId(i.id)}
    />
  )

  const pct = percentual(totais.rendimento, totais.investido)
  const metaPct = meta?.alvo_cents ? (meta.aportado_cents / meta.alvo_cents) * 100 : null

  return (
    <div>
      <CabecalhoTela
        selo="Carteira"
        titulo="Investimentos"
        descricao="Aporte sai do saldo do mês; o valor de hoje vem da cotação"
        acao={todos.length > 0 ? botaoNovo : undefined}
      />

      {compartilhado && todos.length > 0 && (
        <Tabs
          className="mb-4 max-w-full overflow-x-auto"
          ativa={escopoValido}
          aoTrocar={setEscopo}
          abas={[
            { id: usuarioId, rotulo: 'Eu' },
            ...membros.filter((m) => m.user_id !== usuarioId).map((m) => ({ id: m.user_id, rotulo: nomeDoMembro(m, usuarioId) })),
            { id: 'conjunto', rotulo: 'Juntos' },
          ]}
        />
      )}

      {erro && (
        <Aviso className="mb-4" aoTentarDeNovo={() => void recarregar()}>
          {erro}
        </Aviso>
      )}

      {!carteira ? (
        !erro && <EsqueletoLista linhas={4} />
      ) : todos.length === 0 ? (
        <Cartao>
          <Vazio
            icone="trendingUp"
            titulo="Nenhum investimento ainda."
            descricao="Cadastre ações, FIIs, cripto ou renda fixa. Cada aporte entra no mês como saída, na categoria Investimentos."
            acao={
              <Botao onClick={() => setCriando(true)} icone={<Icone n="plus" className="h-4 w-4" />}>
                Novo investimento
              </Botao>
            }
          />
        </Cartao>
      ) : (
        <div className="space-y-6">
          <div className="cascata space-y-3">
            <Cartao>
              <Selo className="mb-2">{escopoValido === 'conjunto' ? 'Patrimônio hoje' : `Patrimônio hoje · ${nomeEscopo}`}</Selo>
              <Valor key={escopoValido} centavos={totais.valor} tamanho="heroi" ocultar={ocultar} animar />
              {metaPct !== null && escopoValido === 'conjunto' && (
                <BarraProgresso
                  className="mt-4"
                  // passar da meta de investir é bom: trava em 100% pra não pintar de "estourou"
                  percentual={Math.min(100, Math.max(0, metaPct))}
                  tom="entrada"
                  avisoEm={null}
                  rotulo="da meta de aporte do mês"
                  direita={<span className="font-mono">{ocultar ? '••' : `${numero(Math.max(0, metaPct), 0)}%`}</span>}
                />
              )}
            </Cartao>

            <div className="grid grid-cols-2 gap-3">
              <Cartao>
                <Selo className="mb-2">Investido</Selo>
                <Valor centavos={totais.investido} tamanho="lg" ocultar={ocultar} />
              </Cartao>
              <Cartao>
                <Selo className="mb-2">Rendimento</Selo>
                <Valor centavos={totais.rendimento} tipo="auto" tamanho="lg" ocultar={ocultar} />
                {pct && !ocultar && <span className="mt-0.5 block font-mono text-xs text-tenue">{pct}</span>}
              </Cartao>
            </div>
          </div>

          {pendencias.length > 0 && (
            <section>
              <TituloSecao selo="Pendências" titulo="Esperando confirmação" />
              <div className="cascata space-y-2">
                {pendencias.map((p) => (
                  <Cartao key={p.id} className="!p-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-tinta-atencao text-atencao">
                        <Icone n={p.tipo === 'provento' ? 'wallet' : 'repeat'} className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-texto">
                          {rotuloPendencia(p)} · {p.ticker && !/^[a-z]/.test(p.ticker) ? p.ticker : p.investimento}
                        </p>
                        <p className="truncate font-mono text-xs text-tenue">
                          {diaMes(p.dia)}
                          {p.quantidade
                            ? ` · ${numero(Number(p.quantidade))} ${p.ticker && /^[a-z]/.test(p.ticker) ? 'un.' : 'cotas'}`
                            : ' · falta a quantidade'}
                        </p>
                      </div>
                      <Valor centavos={p.amount_cents} tipo={p.tipo === 'provento' ? 'entrada' : 'saida'} tamanho="sm" ocultar={ocultar} />
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Botao variante="fantasma" tamanho="sm" className="flex-1" onClick={() => void resolverPendencia(p, 'recusar')}>
                        Descartar
                      </Botao>
                      <Botao variante="secundario" tamanho="sm" className="flex-1" onClick={() => setAjustando(p)}>
                        Ajustar
                      </Botao>
                      <Botao
                        tamanho="sm"
                        className="flex-1"
                        onClick={() => (p.quantidade || p.tipo === 'provento' ? void resolverPendencia(p, 'confirmar') : setAjustando(p))}
                      >
                        Confirmar
                      </Botao>
                    </div>
                  </Cartao>
                ))}
              </div>
              <p className="mt-2 text-xs text-tenue">Confirmando, entra no mês. O Argos também pergunta no grupo às 19h.</p>
            </section>
          )}

          {meta && (
            <section>
              <TituloSecao selo="Meta" titulo="Aporte do mês" />
              <CartaoMeta meta={meta} ocultar={ocultar} aoEditar={() => setEditandoMeta(true)} />
            </section>
          )}

          {compartilhado && (
            <section>
              <TituloSecao selo="Por pessoa" titulo="Quem investiu quanto" />
              <div className="cascata space-y-2">
                {pessoas.map(({ membro, itens: dele, valor, investido }) => {
                  const abertoP = abertosPessoa.has(membro.user_id)
                  return (
                    <Cartao key={membro.user_id} semPadding>
                      <button
                        type="button"
                        aria-expanded={abertoP}
                        onClick={() =>
                          setAbertosPessoa((a) => {
                            const n = new Set(a)
                            if (n.has(membro.user_id)) n.delete(membro.user_id)
                            else n.add(membro.user_id)
                            return n
                          })
                        }
                        className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-superficie-alta/50"
                      >
                        <Icone
                          n="chevronRight"
                          className={cx('h-4 w-4 shrink-0 text-tenue transition-transform duration-200 ease-suave', abertoP && 'rotate-90')}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-texto">{nomeDoMembro(membro, usuarioId)}</span>
                          <span className="text-xs text-tenue">
                            <span className="font-mono">{dele.length}</span> investimento{dele.length === 1 ? '' : 's'}
                          </span>
                        </span>
                        <span className="flex flex-col items-end gap-0.5">
                          <Valor centavos={valor} tamanho="sm" ocultar={ocultar} />
                          {investido > 0 && <Valor centavos={valor - investido} tipo="auto" tamanho="sm" ocultar={ocultar} />}
                        </span>
                      </button>
                      {abertoP && (
                        <div className="animate-subir border-t border-borda">
                          {dele.length === 0 ? (
                            <p className="px-4 py-4 text-sm text-tenue">Nenhum investimento no nome de {nomeDoMembro(membro, usuarioId)}.</p>
                          ) : (
                            <Lista semCartao>{dele.map(linha)}</Lista>
                          )}
                        </div>
                      )}
                    </Cartao>
                  )
                })}
              </div>
            </section>
          )}

          <section>
            <TituloSecao
              selo="Evolução"
              titulo="Carteira no tempo"
              acao={<AbasResponsivas lado><Tabs<Periodo> abas={[...PERIODOS]} ativa={periodo} aoTrocar={setPeriodo} /></AbasResponsivas>}
            />
            <AbasResponsivas>
              <Tabs<Periodo> cheio abas={[...PERIODOS]} ativa={periodo} aoTrocar={setPeriodo} />
            </AbasResponsivas>
            <Cartao>
              <GraficoEvolucao pontos={evolucaoEscopo} ocultar={ocultar} />
            </Cartao>
          </section>

          {algumDesatualizado && (
            <Aviso tom="atencao">
              Alguma fonte de cotação não respondeu agora. Os valores marcados usam a última cotação conhecida.
            </Aviso>
          )}

          {ativos.length > 0 && (
            <section>
              <TituloSecao
                selo={`${ativos.length} ativo${ativos.length === 1 ? '' : 's'}`}
                titulo="Carteira"
                acao={
                  abasClasse.length > 2 ? (
                    <AbasResponsivas lado>
                      <Tabs<FiltroClasse> abas={abasClasse} ativa={filtro} aoTrocar={setFiltro} />
                    </AbasResponsivas>
                  ) : undefined
                }
              />
              {abasClasse.length > 2 && (
                <AbasResponsivas>
                  <Tabs<FiltroClasse> abas={abasClasse} ativa={filtro} aoTrocar={setFiltro} />
                </AbasResponsivas>
              )}
              <div key={filtro} className="cascata space-y-4">
                {grupos.map((g) => (
                  <section key={g.id}>
                    <CabecaClasse rotulo={g.rotulo} itens={g.itens} ocultar={ocultar} />
                    <Lista>{g.itens.map(linha)}</Lista>
                  </section>
                ))}
              </div>
              {carteira.proventos_cents > 0 && (
                <p className="mt-2 text-xs text-tenue">
                  Proventos recebidos: <Valor centavos={carteira.proventos_cents} tamanho="sm" ocultar={ocultar} className="text-xs" />
                </p>
              )}
            </section>
          )}

          {encerrados.length > 0 && (
            <section>
              <TituloSecao selo="Histórico" titulo="Encerrados" />
              <Lista>{encerrados.map(linha)}</Lista>
              <p className="mt-2 text-xs text-tenue">Vendidos ou resgatados por inteiro. À direita, o resultado final.</p>
            </section>
          )}
        </div>
      )}

      <SheetNovo
        aberto={criando}
        {...{ ledgerId, membros, usuarioId }}
        aoFechar={() => setCriando(false)}
        aoCriar={async (inv) => {
          vibrar('sucesso')
          toast.mostrar(`${inv.nome} na carteira`)
          setCriando(false)
          await recarregar()
          setAbertoId(inv.id)
        }}
      />

      <SheetMeta
        aberto={editandoMeta}
        meta={meta}
        ledgerId={ledgerId}
        aoFechar={() => setEditandoMeta(false)}
        aoSalvar={async (texto) => {
          vibrar('sucesso')
          toast.mostrar(texto)
          setEditandoMeta(false)
          await recarregar()
        }}
      />

      <SheetAjuste
        pendencia={ajustando}
        ledgerId={ledgerId}
        aoFechar={() => setAjustando(null)}
        aoConfirmar={async (p) => {
          vibrar('sucesso')
          toast.mostrar(`${rotuloPendencia(p)} de ${p.investimento} lançado no mês`)
          setAjustando(null)
          await recarregar()
        }}
      />

      <SheetDetalhe
        investimento={aberto}
        aoFechar={() => setAbertoId(null)}
        {...{ ledgerId, membros, usuarioId, ocultar }}
        aoMudar={async (texto) => {
          if (texto) toast.mostrar(texto)
          await recarregar()
        }}
        aoRemover={async (texto) => {
          vibrar('aviso')
          toast.mostrar(texto)
          setAbertoId(null)
          await recarregar()
        }}
      />
    </div>
  )
}

/**
 * Abas ao lado do título no desktop (como no mês) e numa linha própria no
 * celular, onde não cabem junto do título. A linha rola de lado se faltar espaço.
 */
function AbasResponsivas({ lado = false, children }: { lado?: boolean; children: React.ReactNode }) {
  return lado ? (
    <div className="hidden sm:block">{children}</div>
  ) : (
    <div className="-mt-1 mb-3 overflow-x-auto sm:hidden">{children}</div>
  )
}

const CHAVE_ESCOPO = (ledgerId: string) => `orcamento:investimentos-escopo:${ledgerId}`

function parteDe(i: Investimento, userId: string) {
  return (i.partes ?? []).find((p) => p.user_id === userId && (p.investido_cents !== 0 || p.valor_cents !== 0)) ?? null
}

/** O investimento visto pela parte de uma pessoa (investido, valor e rendimento dela). */
function comParte(i: Investimento, p: { investido_cents: number; valor_cents: number }): Investimento {
  return { ...i, investido_cents: p.investido_cents, valor_atual_cents: p.valor_cents, rendimento_cents: p.valor_cents - p.investido_cents }
}

function CabecaClasse({ rotulo, itens, ocultar }: { rotulo: string; itens: Investimento[]; ocultar: boolean }) {
  const valor = useMemo(() => itens.reduce((s, i) => s + i.valor_atual_cents, 0), [itens])
  return (
    <div className="mb-2 flex items-baseline justify-between px-1">
      <span className="text-xs font-medium text-suave">{rotulo}</span>
      <Valor centavos={valor} tamanho="sm" ocultar={ocultar} className="text-xs" />
    </div>
  )
}

function resumoPosicao(i: Investimento): string {
  const partes: string[] = [rotuloTipo(i.tipo)]
  if (ehMercado(i.tipo) && i.quantidade !== null) partes.push(`${numero(Number(i.quantidade))} ${unidade(i.tipo)}`)
  if (i.tipo === 'renda_fixa') partes.push(descricaoTaxa(i))
  if (i.tipo === 'outro') partes.push('valor informado à mão')
  return partes.filter(Boolean).join(' · ')
}

/** Quadradinho com a sigla do tipo: âncora visual no início da linha. */
function MarcaTipo({ tipo }: { tipo: TipoInvestimento }) {
  const curto = TIPOS.find((t) => t.id === tipo)!.curto
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-borda bg-campo">
      <span className="font-mono text-[9px] font-semibold tracking-wider text-suave">{curto}</span>
    </span>
  )
}

// ---------------------------------------------------------------------------
// meta de aporte e gráfico
// ---------------------------------------------------------------------------

function CartaoMeta({ meta, ocultar, aoEditar }: { meta: MetaAporte; ocultar: boolean; aoEditar: () => void }) {
  const alvo = meta.alvo_cents
  const p = alvo ? (meta.aportado_cents / alvo) * 100 : 0
  return (
    <Cartao>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Selo className="capitalize">{mesPorExtenso(meta.mes)}</Selo>
          <p className="mt-1 text-sm text-suave">
            Investido no mês: <Valor centavos={meta.aportado_cents} tamanho="sm" ocultar={ocultar} />
            {alvo !== null && (
              <>
                {' '}
                de <Valor centavos={alvo} tamanho="sm" ocultar={ocultar} />
              </>
            )}
          </p>
        </div>
        <Botao variante="fantasma" tamanho="sm" onClick={aoEditar}>
          {alvo === null ? 'Definir' : 'Editar'}
        </Botao>
      </div>
      {alvo !== null && (
        <BarraProgresso
          className="mt-3"
          // passar da meta de investir é bom: trava em 100% pra não pintar de "estourou"
          percentual={Math.min(100, Math.max(0, p))}
          direita={<span className="font-mono">{ocultar ? '••' : `${numero(Math.max(0, p), 0)}%`}</span>}
          tom="entrada"
          avisoEm={null}
        />
      )}
    </Cartao>
  )
}

function GraficoEvolucao({ pontos, ocultar }: { pontos: PontoCarteira[] | null; ocultar: boolean }) {
  const dados = useMemo(
    () => (pontos ?? []).map((p) => ({ dia: diaMes(p.dia), valor: p.valor_cents, investido: p.investido_cents })),
    [pontos],
  )
  if (pontos === null) return <div className="h-48 animate-pulse rounded-card bg-superficie-alta" />
  if (dados.length < 2) {
    return (
      <p className="py-10 text-center text-sm text-tenue">
        O gráfico começa a partir do primeiro dia da carteira e ganha um ponto por dia.
      </p>
    )
  }
  const curto = (c: number) => (Math.abs(c) >= 100_000 ? `${Math.round(c / 100_000)}k` : String(Math.round(c / 100)))
  return (
    <div className="h-48">
      <ResponsiveContainer>
        <ComposedChart data={dados} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="valorCarteira" x1="0" y1="0" x2="0" y2="1">
              {/* style, não atributo: atributo de SVG não resolve var() do tema */}
              <stop offset="0%" style={{ stopColor: CORES_GRAFICO.acento, stopOpacity: 0.25 }} />
              <stop offset="100%" style={{ stopColor: CORES_GRAFICO.acento, stopOpacity: 0 }} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={CORES_GRAFICO.grade} strokeDasharray="3 3" />
          <XAxis dataKey="dia" tick={TICK_GRAFICO} axisLine={false} tickLine={false} minTickGap={24} />
          <YAxis
            tick={TICK_GRAFICO}
            axisLine={false}
            tickLine={false}
            width={ocultar ? 8 : 40}
            tickFormatter={(c: number) => (ocultar ? '' : curto(c))}
            domain={['auto', 'auto']}
          />
          <Tooltip {...TOOLTIP_GRAFICO} formatter={(v: unknown) => (ocultar ? OCULTO : formatar(Number(v)))} />
          <Area
            type="monotone"
            dataKey="valor"
            name="Valor"
            stroke={CORES_GRAFICO.acento}
            strokeWidth={2}
            fill="url(#valorCarteira)"
            animationDuration={600}
          />
          <Line
            type="stepAfter"
            dataKey="investido"
            name="Investido"
            stroke={CORES_GRAFICO.eixo}
            strokeDasharray="4 4"
            strokeWidth={1.5}
            dot={false}
            animationDuration={600}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

function SheetMeta({
  aberto,
  meta,
  ledgerId,
  aoFechar,
  aoSalvar,
}: {
  aberto: boolean
  meta: MetaAporte | null
  ledgerId: string
  aoFechar: () => void
  aoSalvar: (texto: string) => Promise<void>
}) {
  const [centavos, setCentavos] = useState(0)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!aberto) return
    setCentavos(meta?.alvo_cents ?? 0)
    setSalvando(false)
    setErro(null)
  }, [aberto, meta])

  async function salvar(valor: number) {
    if (!meta) return
    if (valor === 0 && meta.alvo_cents === null) return setErro('Digite o valor.')
    setSalvando(true)
    try {
      await definirMetaAporte(ledgerId, meta.mes, valor)
      await aoSalvar(valor === 0 ? 'Meta de aporte removida' : 'Meta de aporte salva')
    } catch (e) {
      setErro(msg(e))
      setSalvando(false)
    }
  }

  const rodape = (
    <>
      {meta?.alvo_cents !== null && meta?.alvo_cents !== undefined && (
        <BotaoIcone rotulo="remover meta" onClick={() => void salvar(0)} className="text-perigo">
          <Icone n="trash" className="h-5 w-5" />
        </BotaoIcone>
      )}
      <Botao variante="fantasma" className="flex-1" onClick={aoFechar}>
        Cancelar
      </Botao>
      <Botao className="flex-1" carregando={salvando} onClick={() => void salvar(centavos)}>
        Salvar
      </Botao>
    </>
  )

  return (
    <Sheet aberto={aberto} aoFechar={aoFechar} selo={meta ? mesPorExtenso(meta.mes) : undefined} titulo="Meta de aporte" rodape={rodape} alto>
      <div className="space-y-4">
        <TecladoValor centavos={centavos} aoMudar={setCentavos} tom="entrada" rotulo="Quanto investir no mês" />
        <p className="text-xs text-tenue">Conta aportes menos resgates do mês. Vale só para este mês.</p>
        {erro && <p className="text-sm text-perigo">{erro}</p>}
      </div>
    </Sheet>
  )
}

/** Confirmar uma pendência corrigindo quantidade e valor (ou informando, quando faltou cotação). */
function SheetAjuste({
  pendencia: p,
  ledgerId,
  aoFechar,
  aoConfirmar,
}: {
  pendencia: Pendencia | null
  ledgerId: string
  aoFechar: () => void
  aoConfirmar: (p: Pendencia) => Promise<void>
}) {
  const [quantidade, setQuantidade] = useState('')
  const [centavos, setCentavos] = useState(0)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!p) return
    setQuantidade(p.quantidade ? numero(Number(p.quantidade)) : '')
    setCentavos(p.amount_cents)
    setSalvando(false)
    setErro(null)
  }, [p])

  if (!p) return <Sheet aberto={false} aoFechar={aoFechar}>{null}</Sheet>
  const pedeQuantidade = p.tipo === 'aporte_recorrente'

  async function confirmar() {
    if (!p) return
    const qtd = quantidade.trim().replace(/\./g, '').replace(',', '.')
    if (pedeQuantidade && !(Number(qtd) > 0)) return setErro('Informe a quantidade.')
    if (centavos <= 0) return setErro('Digite o valor.')
    setSalvando(true)
    try {
      const r = await confirmarPendencia(ledgerId, p.id, {
        quantidade: pedeQuantidade ? qtd : null,
        amount_cents: centavos,
      })
      await aoConfirmar(r)
    } catch (e) {
      vibrar('erro')
      setErro(msg(e))
      setSalvando(false)
    }
  }

  const rodape = (
    <>
      <Botao variante="fantasma" className="flex-1" onClick={aoFechar}>
        Cancelar
      </Botao>
      <Botao className="flex-1" carregando={salvando} onClick={() => void confirmar()}>
        Confirmar
      </Botao>
    </>
  )

  return (
    <Sheet aberto aoFechar={aoFechar} selo={p.ticker ?? p.investimento} titulo={rotuloPendencia(p)} rodape={rodape} alto>
      <div className="space-y-4">
        <TecladoValor
          centavos={centavos}
          aoMudar={setCentavos}
          tom={p.tipo === 'provento' ? 'entrada' : 'saida'}
          rotulo={p.tipo === 'provento' ? 'Quanto caiu na conta' : 'Quanto saiu do pote'}
        />
        {pedeQuantidade && (
          <Campo
            rotulo="Quantidade comprada"
            inputMode="decimal"
            autoComplete="off"
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value.replace(/[^\d,.]/g, ''))}
            ajuda={p.unitario ? `Cotação usada no cálculo: ${formatar(Math.round(p.unitario * 100))}` : 'Sem cotação no dia: informe o que comprou'}
            className="font-mono"
          />
        )}
        <p className="text-xs text-tenue">
          Entra no mês em <span className="font-mono">{diaMes(p.dia)}</span>, na categoria Investimentos.
        </p>
        {erro && <p className="text-sm text-perigo">{erro}</p>}
      </div>
    </Sheet>
  )
}

// ---------------------------------------------------------------------------
// aporte recorrente (dentro do novo e do editar)
// ---------------------------------------------------------------------------

function CamposRecorrente({
  valor,
  aoMudar,
  membros,
  usuarioId,
  mercado,
}: {
  valor: RecorrenteInvestimento | null
  aoMudar: (r: RecorrenteInvestimento | null) => void
  membros: Membro[]
  usuarioId: string
  mercado: boolean
}) {
  const [diaTexto, setDiaTexto] = useState(String(valor?.dia_do_mes ?? 5))
  return (
    <div className="space-y-3 rounded-card border border-borda p-3">
      <label className="flex items-center justify-between gap-3">
        <span>
          <span className="block text-sm font-medium text-texto">Aporte recorrente</span>
          <span className="block text-xs text-tenue">
            {mercado
              ? 'No dia, a quantidade é calculada pela cotação e você confirma.'
              : 'Entra sozinho todo mês, no dia escolhido.'}
          </span>
        </span>
        <Chip ativo={valor !== null} aoTocar={() => aoMudar(valor ? null : { amount_cents: 0, dia_do_mes: 5, paid_by: null })}>
          {valor ? 'ligado' : 'desligado'}
        </Chip>
      </label>
      {valor && (
        <>
          <TecladoValor centavos={valor.amount_cents} aoMudar={(c) => aoMudar({ ...valor, amount_cents: c })} tom="saida" rotulo="Valor todo mês" />
          <div className="grid grid-cols-2 gap-3">
            <Campo
              rotulo="Todo dia"
              inputMode="numeric"
              autoComplete="off"
              maxLength={2}
              value={diaTexto}
              onChange={(e) => {
                const so = e.target.value.replace(/\D/g, '').slice(0, 2)
                setDiaTexto(so)
                const n = Number(so)
                if (n >= 1 && n <= 28) aoMudar({ ...valor, dia_do_mes: n })
              }}
              onBlur={() => setDiaTexto(String(valor.dia_do_mes))}
              ajuda="de 1 a 28"
              className="font-mono"
            />
            <Select rotulo="Quem paga" value={valor.paid_by ?? ''} onChange={(e) => aoMudar({ ...valor, paid_by: e.target.value || null })}>
              <option value="">o pote</option>
              {membros.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {nomeDoMembro(m, usuarioId)}
                </option>
              ))}
            </Select>
          </div>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// novo investimento
// ---------------------------------------------------------------------------

function SheetNovo({
  aberto,
  ledgerId,
  membros,
  usuarioId,
  aoFechar,
  aoCriar,
}: {
  aberto: boolean
  ledgerId: string
  membros: Membro[]
  usuarioId: string
  aoFechar: () => void
  aoCriar: (inv: Investimento) => Promise<void>
}) {
  const [tipo, setTipo] = useState<TipoInvestimento>('acao')
  const [nome, setNome] = useState('')
  const [ticker, setTicker] = useState('')
  const [indexador, setIndexador] = useState<Indexador>('cdi')
  const [taxa, setTaxa] = useState('100')
  const [recorrente, setRecorrente] = useState<RecorrenteInvestimento | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!aberto) return
    setTipo('acao')
    setNome('')
    setTicker('')
    setIndexador('cdi')
    setTaxa('100')
    setRecorrente(null)
    setSalvando(false)
    setErro(null)
  }, [aberto])

  // a taxa padrão muda de sentido com o indexador (110% do CDI ≠ 6% ao ano)
  function trocarIndexador(ix: Indexador) {
    setIndexador(ix)
    setTaxa(ix === 'cdi' || ix === 'selic' ? '100' : '')
  }

  async function criar() {
    const mercado = ehMercado(tipo)
    if (mercado && !ticker.trim()) return setErro(tipo === 'cripto' ? 'Informe o id da moeda.' : 'Informe o código.')
    const t = tipo === 'renda_fixa' ? taxaDe(taxa) : null
    if (tipo === 'renda_fixa' && t === null) return setErro('Informe a taxa.')
    if (recorrente && recorrente.amount_cents <= 0) return setErro('Digite o valor do aporte recorrente.')
    const nomeFinal = nome.trim() || (mercado ? ticker.trim().toUpperCase() : '')
    if (!nomeFinal) return setErro('Dê um nome.')
    setSalvando(true)
    try {
      const inv = await criarInvestimento(ledgerId, {
        nome: nomeFinal,
        tipo,
        ticker: mercado ? ticker.trim() : null,
        indexador: tipo === 'renda_fixa' ? indexador : null,
        taxa: t,
        recorrente,
      })
      await aoCriar(inv)
    } catch (e) {
      vibrar('erro')
      setErro(msg(e))
      setSalvando(false)
    }
  }

  const rodape = (
    <>
      <Botao variante="fantasma" className="flex-1" onClick={aoFechar}>
        Cancelar
      </Botao>
      <Botao className="flex-1" carregando={salvando} onClick={() => void criar()}>
        Criar
      </Botao>
    </>
  )

  return (
    <Sheet aberto={aberto} aoFechar={aoFechar} selo="Investimentos" titulo="Novo investimento" rodape={rodape} alto>
      <div className="space-y-4">
        <div>
          <p className="mb-1.5 text-xs font-medium text-suave">Tipo</p>
          <FileiraChips>
            {TIPOS.map((t) => (
              <Chip key={t.id} ativo={tipo === t.id} aoTocar={() => setTipo(t.id)}>
                {t.rotulo}
              </Chip>
            ))}
          </FileiraChips>
        </div>

        {ehMercado(tipo) && (
          <Campo
            rotulo={tipo === 'cripto' ? 'Moeda (id da CoinGecko)' : 'Código na B3'}
            value={ticker}
            maxLength={40}
            autoCapitalize={tipo === 'cripto' ? 'none' : 'characters'}
            autoComplete="off"
            onChange={(e) => setTicker(e.target.value)}
            placeholder={tipo === 'cripto' ? 'bitcoin' : tipo === 'fii' ? 'HGLG11' : tipo === 'etf' ? 'BOVA11' : 'PETR4'}
            ajuda={tipo === 'cripto' ? 'Ex.: bitcoin, ethereum, solana' : 'A cotação e os proventos são buscados sozinhos'}
            className="font-mono"
          />
        )}

        <Campo
          rotulo="Nome"
          value={nome}
          maxLength={80}
          onChange={(e) => setNome(e.target.value)}
          placeholder={tipo === 'renda_fixa' ? 'CDB Banco X' : tipo === 'outro' ? 'Previdência' : 'opcional: usa o código'}
        />

        {tipo === 'renda_fixa' && (
          <>
            <Tabs cheio abas={INDEXADORES} ativa={indexador} aoTrocar={trocarIndexador} />
            <Campo
              rotulo={rotuloTaxa(indexador)}
              inputMode="decimal"
              value={taxa}
              onChange={(e) => setTaxa(e.target.value.replace(/[^\d,.]/g, ''))}
              ajuda={
                indexador === 'prefixado' ? 'Ex.: 12,5' : indexador === 'ipca' ? 'Ex.: 6,5 para IPCA + 6,5% ao ano' : 'Ex.: 110 para 110% do CDI'
              }
              className="font-mono"
            />
          </>
        )}

        {tipo === 'outro' && (
          <p className="text-xs text-tenue">Sem cotação automática: você informa o valor atual quando quiser.</p>
        )}

        <CamposRecorrente valor={recorrente} aoMudar={setRecorrente} membros={membros} usuarioId={usuarioId} mercado={ehMercado(tipo)} />
        {erro && <p className="text-sm text-perigo">{erro}</p>}
      </div>
    </Sheet>
  )
}

// ---------------------------------------------------------------------------
// detalhe: posição, movimentações, aportar/resgatar, editar, apagar
// ---------------------------------------------------------------------------

type Modo = 'ver' | 'aporte' | 'resgate' | 'editar' | 'remover'

function SheetDetalhe({
  investimento: inv,
  ledgerId,
  membros,
  usuarioId,
  ocultar,
  aoFechar,
  aoMudar,
  aoRemover,
}: {
  investimento: Investimento | undefined
  ledgerId: string
  membros: Membro[]
  usuarioId: string
  ocultar: boolean
  aoFechar: () => void
  aoMudar: (texto?: string) => Promise<void>
  aoRemover: (texto: string) => Promise<void>
}) {
  const [modo, setModo] = useState<Modo>('ver')
  const [movs, setMovs] = useState<Movimento[] | null>(null)
  const [apagando, setApagando] = useState<string | null>(null)
  const [removendo, setRemovendo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const id = inv?.id

  const carregarMovs = useCallback(async () => {
    if (!id) return
    try {
      setMovs(await listarMovimentos(ledgerId, id))
    } catch (e) {
      setErro(msg(e))
    }
  }, [ledgerId, id])

  useEffect(() => {
    setModo('ver')
    setMovs(null)
    setApagando(null)
    setRemovendo(false)
    setErro(null)
    void carregarMovs()
  }, [carregarMovs])

  // o investimento muda quando a carteira relê (outra pessoa aportou): relê os movimentos junto
  const investido = inv?.investido_cents
  useEffect(() => {
    if (investido !== undefined) void carregarMovs()
  }, [investido, carregarMovs])

  const porMembro = useMemo(() => mapaDeMembros(membros), [membros])

  async function tirarMovimento(m: Movimento) {
    if (!inv) return
    try {
      await apagarMovimento(ledgerId, inv.id, m.id)
      vibrar('aviso')
      setApagando(null)
      await aoMudar(`${m.tipo === 'aporte' ? 'Aporte' : 'Resgate'} apagado`)
    } catch (e) {
      vibrar('erro')
      setErro(msg(e))
      setApagando(null)
    }
  }

  async function remover() {
    if (!inv) return
    setRemovendo(true)
    try {
      const r = await apagarInvestimento(ledgerId, inv.id)
      await aoRemover(
        r.lancamentos > 0
          ? `${inv.nome} apagado com ${r.lancamentos} lançamento${r.lancamentos > 1 ? 's' : ''}`
          : `${inv.nome} apagado`,
      )
    } catch (e) {
      setErro(msg(e))
      setRemovendo(false)
      setModo('ver')
    }
  }

  if (!inv) return <Sheet aberto={false} aoFechar={aoFechar}>{null}</Sheet>

  const voltar = () => {
    setModo('ver')
    setErro(null)
  }

  if (modo === 'aporte' || modo === 'resgate') {
    return (
      <FormMovimento
        inv={inv}
        tipo={modo}
        {...{ ledgerId, membros, usuarioId }}
        aoFechar={aoFechar}
        aoVoltar={voltar}
        aoSalvar={async (texto) => {
          vibrar('sucesso')
          setModo('ver')
          await aoMudar(texto)
        }}
      />
    )
  }

  if (modo === 'editar') {
    return (
      <FormEditar
        inv={inv}
        {...{ ledgerId, membros, usuarioId }}
        aoFechar={aoFechar}
        aoVoltar={voltar}
        aoSalvar={async (texto) => {
          vibrar('sucesso')
          setModo('ver')
          await aoMudar(texto)
        }}
      />
    )
  }

  const nMovs = movs?.length ?? 0
  const pct = percentual(inv.rendimento_cents, inv.investido_cents)
  const pagadorRecorrente = inv.recorrente?.paid_by ? nomeDoMembro(porMembro.get(inv.recorrente.paid_by), usuarioId) : 'o pote'

  const rodape =
    modo === 'remover' ? (
      <>
        <Botao variante="fantasma" className="flex-1" onClick={voltar}>
          Voltar
        </Botao>
        <Botao variante="perigo" className="flex-1" carregando={removendo} onClick={() => void remover()}>
          Apagar tudo
        </Botao>
      </>
    ) : (
      <>
        <Botao variante="secundario" className="flex-1" disabled={nMovs === 0 || inv.encerrado} onClick={() => setModo('resgate')}>
          Resgatar
        </Botao>
        <Botao className="flex-1" onClick={() => setModo('aporte')} icone={<Icone n="plus" className="h-4 w-4" />}>
          Aportar
        </Botao>
      </>
    )

  return (
    <Sheet aberto aoFechar={aoFechar} selo={rotuloTipo(inv.tipo)} titulo={inv.nome} rodape={rodape} alto largura="md">
      {modo === 'remover' ? (
        <div className="animate-fade py-6 text-center">
          <p className="text-sm font-medium text-texto">Apagar “{inv.nome}”?</p>
          <p className="mt-1 text-sm text-suave">
            {nMovs > 0
              ? `Leva junto ${nMovs} movimentaç${nMovs > 1 ? 'ões' : 'ão'} e os lançamentos dela${nMovs > 1 ? 's' : ''} no mês, além dos proventos lançados.`
              : 'Ele não tem movimentações; nada sai do mês.'}
          </p>
          <p className="mt-1 text-xs text-tenue">Use só para cadastro errado. Quem vendeu tudo fica como encerrado.</p>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Selo>{inv.encerrado ? 'Resultado final' : 'Valor hoje'}</Selo>
              <Valor
                centavos={inv.encerrado ? inv.rendimento_cents : inv.valor_atual_cents}
                tipo={inv.encerrado ? 'auto' : 'neutro'}
                tamanho="lg"
                ocultar={ocultar}
                className="mt-1 block"
              />
            </div>
            {!inv.encerrado && (
              <div>
                <Selo>Rendimento</Selo>
                <Valor centavos={inv.rendimento_cents} tipo="auto" tamanho="lg" ocultar={ocultar} className="mt-1 block" />
                {pct && !ocultar && <span className="block font-mono text-xs text-tenue">{pct}</span>}
              </div>
            )}
          </div>

          <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
            <Info rotulo="Investido">
              <Valor centavos={inv.investido_cents} tamanho="sm" ocultar={ocultar} />
            </Info>
            {inv.proventos_cents > 0 && (
              <Info rotulo="Proventos recebidos">
                <Valor centavos={inv.proventos_cents} tipo="entrada" tamanho="sm" ocultar={ocultar} />
              </Info>
            )}
            {ehMercado(inv.tipo) && (
              <>
                <Info rotulo="Quantidade">
                  <span className="font-mono">{numero(Number(inv.quantidade ?? 0))}</span>
                </Info>
                <Info rotulo="Cotação">
                  {inv.cotacao !== null ? (
                    <Valor centavos={Math.round(inv.cotacao * 100)} tamanho="sm" ocultar={ocultar} />
                  ) : (
                    <span className="text-tenue">sem cotação</span>
                  )}
                </Info>
                <Info rotulo="Atualizada">
                  <span className="font-mono">{inv.cotacao_em ? quando(inv.cotacao_em) : '—'}</span>
                </Info>
              </>
            )}
            {inv.tipo === 'renda_fixa' && <Info rotulo="Rende">{descricaoTaxa(inv)}</Info>}
            {membros.length > 1 &&
              (inv.partes ?? [])
                .filter((p) => p.investido_cents !== 0 || p.valor_cents !== 0)
                .map((p) => (
                  <Info key={p.user_id} rotulo={`Parte de ${nomeDoMembro(porMembro.get(p.user_id), usuarioId)}`}>
                    <Valor centavos={p.valor_cents} tamanho="sm" ocultar={ocultar} />
                  </Info>
                ))}
            {inv.recorrente && (
              <Info rotulo="Aporte recorrente">
                <Valor centavos={inv.recorrente.amount_cents} tamanho="sm" ocultar={ocultar} />{' '}
                <span className="text-suave">
                  dia <span className="font-mono">{inv.recorrente.dia_do_mes}</span> · {pagadorRecorrente}
                </span>
              </Info>
            )}
          </dl>

          {inv.desatualizado && (
            <Aviso tom="atencao">A fonte de cotação não respondeu agora; o valor usa a última cotação conhecida.</Aviso>
          )}
          {erro && <Aviso>{erro}</Aviso>}

          <section>
            <TituloSecao titulo="Movimentações" />
            {!movs ? (
              <EsqueletoLista linhas={2} />
            ) : movs.length === 0 ? (
              <p className="text-sm text-tenue">Nenhum aporte ainda. O aporte entra no mês como saída, na categoria Investimentos.</p>
            ) : (
              <Lista>
                {movs.map((m) => {
                  const quem = m.paid_by ? nomeDoMembro(porMembro.get(m.paid_by), usuarioId) : 'o pote'
                  return (
                    <LinhaLista
                      key={m.id}
                      inicio={
                        <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-superficie-alta text-suave">
                          <Icone n={m.tipo === 'aporte' ? 'trendingUp' : 'trendingDown'} className="h-4 w-4" />
                        </span>
                      }
                      titulo={m.tipo === 'aporte' ? 'Aporte' : 'Resgate'}
                      subtitulo={
                        <>
                          <span className="font-mono">{diaMes(m.occurred_on)}</span>
                          {m.quantidade && <span className="font-mono"> · {numero(Number(m.quantidade))}</span>} · {quem}
                        </>
                      }
                      fim={<Valor centavos={m.amount_cents} tipo={m.tipo === 'aporte' ? 'saida' : 'entrada'} tamanho="sm" ocultar={ocultar} />}
                      acoes={
                        apagando === m.id ? (
                          <Botao variante="perigo" tamanho="sm" className="mx-1" onClick={() => void tirarMovimento(m)}>
                            Apagar
                          </Botao>
                        ) : (
                          <BotaoIcone rotulo="apagar movimentação" onClick={() => setApagando(m.id)} className="text-tenue">
                            <Icone n="trash" className="h-4 w-4" />
                          </BotaoIcone>
                        )
                      }
                    />
                  )
                })}
              </Lista>
            )}
            <p className="mt-2 text-xs text-tenue">Apagar uma movimentação tira o lançamento dela do mês.</p>
          </section>

          <div className="flex flex-wrap gap-2">
            <Botao variante="fantasma" tamanho="sm" icone={<Icone n="pencil" className="h-4 w-4" />} onClick={() => setModo('editar')}>
              Editar
            </Botao>
            {movs && (
              <Botao
                variante="fantasma"
                tamanho="sm"
                className="text-perigo"
                icone={<Icone n="trash" className="h-4 w-4" />}
                onClick={() => setModo('remover')}
              >
                Apagar
              </Botao>
            )}
          </div>
        </div>
      )}
    </Sheet>
  )
}

function Info({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-tenue">{rotulo}</dt>
      <dd className="truncate text-texto">{children}</dd>
    </div>
  )
}

function quando(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function FormMovimento({
  inv,
  tipo,
  ledgerId,
  membros,
  usuarioId,
  aoFechar,
  aoVoltar,
  aoSalvar,
}: {
  inv: Investimento
  tipo: 'aporte' | 'resgate'
  ledgerId: string
  membros: Membro[]
  usuarioId: string
  aoFechar: () => void
  aoVoltar: () => void
  aoSalvar: (texto: string) => Promise<void>
}) {
  const [centavos, setCentavos] = useState(0)
  const [quantidade, setQuantidade] = useState('')
  const [dia, setDia] = useState(hoje())
  const [pagador, setPagador] = useState(usuarioId)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  // um id por abertura do formulário: tocar "Salvar" duas vezes não duplica
  const [id] = useState(uuidv7)
  const mercado = ehMercado(inv.tipo)
  const qtdNumero = Number(quantidade.trim().replace(/\./g, '').replace(',', '.'))

  async function salvar() {
    if (centavos <= 0) return setErro('Digite o valor.')
    if (mercado && !(qtdNumero > 0)) return setErro('Informe a quantidade.')
    if (!dia) return setErro('Informe a data.')
    setSalvando(true)
    try {
      await registrarMovimento(ledgerId, inv.id, {
        id,
        tipo,
        amount_cents: centavos,
        quantidade: mercado ? quantidade.trim().replace(/\./g, '').replace(',', '.') : null,
        occurred_on: dia,
        paid_by: pagador || null,
      })
      await aoSalvar(tipo === 'aporte' ? `Aporte em ${inv.nome} lançado no mês` : `Resgate de ${inv.nome} lançado no mês`)
    } catch (e) {
      vibrar('erro')
      setErro(msg(e))
      setSalvando(false)
    }
  }

  const rodape = (
    <>
      <Botao variante="fantasma" className="flex-1" onClick={aoVoltar}>
        Voltar
      </Botao>
      <Botao className="flex-1" carregando={salvando} onClick={() => void salvar()}>
        {tipo === 'aporte' ? 'Aportar' : 'Resgatar'}
      </Botao>
    </>
  )

  const precoUnitario = mercado && centavos > 0 && qtdNumero > 0 ? centavos / qtdNumero : null

  return (
    <Sheet aberto aoFechar={aoFechar} selo={inv.nome} titulo={tipo === 'aporte' ? 'Aporte' : 'Resgate'} rodape={rodape} alto>
      <div className="space-y-4">
        <TecladoValor
          centavos={centavos}
          aoMudar={setCentavos}
          tom={tipo === 'aporte' ? 'saida' : 'entrada'}
          rotulo={tipo === 'aporte' ? 'Quanto saiu do pote' : 'Quanto voltou pro pote'}
        />
        {mercado && (
          <Campo
            rotulo={`Quantidade (${unidade(inv.tipo)})`}
            inputMode="decimal"
            autoComplete="off"
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value.replace(/[^\d,.]/g, ''))}
            placeholder={inv.tipo === 'cripto' ? '0,0015' : '10'}
            ajuda={
              tipo === 'resgate' && inv.quantidade
                ? `Vocês têm ${numero(Number(inv.quantidade))}`
                : precoUnitario
                  ? `Preço por unidade: ${formatar(Math.round(precoUnitario))}`
                  : undefined
            }
            className="font-mono"
          />
        )}
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Data" type="date" value={dia} max={hoje()} onChange={(e) => setDia(e.target.value)} className="font-mono" />
          <Select rotulo={tipo === 'aporte' ? 'Quem pagou' : 'Quem recebeu'} value={pagador} onChange={(e) => setPagador(e.target.value)}>
            <option value="">o pote</option>
            {membros.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {nomeDoMembro(m, usuarioId)}
              </option>
            ))}
          </Select>
        </div>
        <p className="text-xs text-tenue">
          Entra no mês como {tipo === 'aporte' ? 'saída' : 'entrada'} na categoria Investimentos, na data escolhida.
        </p>
        {erro && <p className="text-sm text-perigo">{erro}</p>}
      </div>
    </Sheet>
  )
}

function FormEditar({
  inv,
  ledgerId,
  membros,
  usuarioId,
  aoFechar,
  aoVoltar,
  aoSalvar,
}: {
  inv: Investimento
  ledgerId: string
  membros: Membro[]
  usuarioId: string
  aoFechar: () => void
  aoVoltar: () => void
  aoSalvar: (texto: string) => Promise<void>
}) {
  const [nome, setNome] = useState(inv.nome)
  const [ticker, setTicker] = useState(inv.ticker ?? '')
  const [indexador, setIndexador] = useState<Indexador>(inv.indexador ?? 'cdi')
  const [taxa, setTaxa] = useState(taxaTexto(inv.taxa))
  const [valor, setValor] = useState(inv.valor_atual_cents)
  const [recorrente, setRecorrente] = useState<RecorrenteInvestimento | null>(inv.recorrente)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const mesmoRecorrente = (a: RecorrenteInvestimento | null, b: RecorrenteInvestimento | null) =>
    a === b || (!!a && !!b && a.amount_cents === b.amount_cents && a.dia_do_mes === b.dia_do_mes && a.paid_by === b.paid_by)

  async function salvar() {
    if (!nome.trim()) return setErro('Dê um nome.')
    const mudancas: EdicaoDeInvestimento = {}
    if (nome.trim() !== inv.nome) mudancas.nome = nome.trim()
    if (ehMercado(inv.tipo) && ticker.trim() && ticker.trim().toLowerCase() !== (inv.ticker ?? '').toLowerCase()) {
      mudancas.ticker = ticker.trim()
    }
    if (inv.tipo === 'renda_fixa') {
      const t = taxaDe(taxa)
      if (t === null) return setErro('Informe a taxa.')
      if (t !== inv.taxa) mudancas.taxa = t
      if (indexador !== inv.indexador) mudancas.indexador = indexador
    }
    if (inv.tipo === 'outro' && valor !== inv.valor_atual_cents) mudancas.valor_atual_cents = valor
    if (recorrente && recorrente.amount_cents <= 0) return setErro('Digite o valor do aporte recorrente.')
    if (!mesmoRecorrente(recorrente, inv.recorrente)) mudancas.recorrente = recorrente
    if (Object.keys(mudancas).length === 0) return aoVoltar()
    setSalvando(true)
    try {
      await editarInvestimento(ledgerId, inv.id, mudancas)
      await aoSalvar(mudancas.valor_atual_cents !== undefined ? 'Valor atualizado' : 'Investimento salvo')
    } catch (e) {
      vibrar('erro')
      setErro(msg(e))
      setSalvando(false)
    }
  }

  const rodape = (
    <>
      <Botao variante="fantasma" className="flex-1" onClick={aoVoltar}>
        Voltar
      </Botao>
      <Botao className="flex-1" carregando={salvando} onClick={() => void salvar()}>
        Salvar
      </Botao>
    </>
  )

  return (
    <Sheet aberto aoFechar={aoFechar} selo={rotuloTipo(inv.tipo)} titulo="Editar investimento" rodape={rodape} alto>
      <div className="space-y-4">
        <Campo rotulo="Nome" value={nome} maxLength={80} onChange={(e) => setNome(e.target.value)} />
        {ehMercado(inv.tipo) && (
          <Campo
            rotulo={inv.tipo === 'cripto' ? 'Moeda (id da CoinGecko)' : 'Código na B3'}
            value={ticker}
            maxLength={40}
            autoComplete="off"
            onChange={(e) => setTicker(e.target.value)}
            className="font-mono"
          />
        )}
        {inv.tipo === 'renda_fixa' && (
          <>
            <Tabs cheio abas={INDEXADORES} ativa={indexador} aoTrocar={setIndexador} />
            <Campo
              rotulo={rotuloTaxa(indexador)}
              inputMode="decimal"
              value={taxa}
              onChange={(e) => setTaxa(e.target.value.replace(/[^\d,.]/g, ''))}
              className="font-mono"
            />
          </>
        )}
        {inv.tipo === 'outro' && <TecladoValor centavos={valor} aoMudar={setValor} rotulo="Quanto vale hoje" />}
        {!inv.encerrado && (
          <CamposRecorrente valor={recorrente} aoMudar={setRecorrente} membros={membros} usuarioId={usuarioId} mercado={ehMercado(inv.tipo)} />
        )}
        {erro && <p className="text-sm text-perigo">{erro}</p>}
      </div>
    </Sheet>
  )
}
