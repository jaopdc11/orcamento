import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { api } from '@/lib/api'
import { deslocarMes, mesDe, mesPorExtenso } from '@/lib/datas'
import { formatar } from '@/lib/dinheiro'
import { comAtraso, ouvirOrcamento } from '@/lib/eventos'
import { nomeDoMembro } from '@/lib/membros'
import {
  Aviso,
  BotaoIcone,
  CabecalhoTela,
  Cartao,
  Chip,
  CORES_GRAFICO,
  Esqueleto,
  FileiraChips,
  Icone,
  Selo,
  Valor,
  Vazio,
  corDaCategoria, TOOLTIP_GRAFICO, TICK_GRAFICO, corDoMembro,
} from '@/design'
import type { AnaliseCategorias, AnaliseEvolucao, AnaliseMembros, ContextoOrcamento, Escopo } from '@/lib/tipos'

export type Props = ContextoOrcamento

// Até 7 fatias com cor própria; o resto vira "Outros" em vez de repetir cor da paleta.
const MAX_FATIAS = 7
const OCULTO = 'R$ ••••'
// "Outros" e "sem categoria" ficam neutros: cor de série é só pra coisa identificável.
const NEUTRO = 'rgb(var(--texto-tenue))'
const PERIODOS = [3, 6, 12, 24] as const


type Dados = { cats: AnaliseCategorias; evo: AnaliseEvolucao; membros: AnaliseMembros }

function useAnalises(ledgerId: string, mes: string, meses: number, escopo: Escopo) {
  const [dados, setDados] = useState<Dados | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [versao, setVersao] = useState(0)

  useEffect(() => {
    // Lançamento novo de outro membro muda tudo que está na tela.
    const reler = comAtraso(() => setVersao((v) => v + 1))
    const parar = ouvirOrcamento(ledgerId, (tipo) => {
      if (tipo === 'lancamentos' || tipo === 'membros' || tipo === 'categorias') reler.chamar()
    })
    return () => {
      parar()
      reler.cancelar()
    }
  }, [ledgerId])

  useEffect(() => {
    let vivo = true
    const base = `/orcamentos/${ledgerId}/analises`
    const e = encodeURIComponent(escopo)
    Promise.all([
      api.get<AnaliseCategorias>(`${base}/categorias?mes=${mes}&escopo=${e}`),
      api.get<AnaliseEvolucao>(`${base}/evolucao?ate=${mes}&meses=${meses}&escopo=${e}`),
      api.get<AnaliseMembros>(`${base}/membros?mes=${mes}&escopo=${e}`),
    ])
      .then(([cats, evo, membros]) => {
        if (!vivo) return
        // Resposta sem itens (API antiga, mock) vira vazio em vez de derrubar a tela.
        setDados({
          cats: { ...cats, total_cents: cats?.total_cents ?? 0, itens: cats?.itens ?? [] },
          evo: { ...evo, itens: evo?.itens ?? [] },
          membros: { ...membros, itens: membros?.itens ?? [] },
        })
        setErro(null)
      })
      .catch((err: Error) => vivo && setErro(err.message))
    return () => {
      vivo = false
    }
  }, [ledgerId, mes, meses, escopo, versao])

  return { dados, erro }
}

const mesCurto = (m: string) => mesPorExtenso(m).slice(0, 3) + '/' + m.slice(2, 4)
const reaisCurto = (c: number) =>
  Math.abs(c) >= 100_000 ? `${Math.round(c / 100_000)}k` : String(Math.round(c / 100))

/** Cartão de gráfico: selo + título + conteúdo, pra todos terem a mesma cara. */
function CartaoGrafico({ selo, titulo, extra, children }: { selo: string; titulo: ReactNode; extra?: ReactNode; children: ReactNode }) {
  return (
    <Cartao>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <Selo>{selo}</Selo>
          <h3 className="mt-1 font-display text-base font-semibold text-texto">{titulo}</h3>
        </div>
        {extra}
      </div>
      {children}
    </Cartao>
  )
}

function SemDados() {
  return <Vazio compacto icone="pieChart" titulo="Nada lançado nesse período. Lança um gasto e o gráfico aparece." />
}

export function Analises({ orcamento, usuarioId, membros, ocultar }: Props) {
  const [escopo, setEscopo] = useState<Escopo>('conjunto')
  const [mes, setMes] = useState(() => mesDe())
  const [meses, setMeses] = useState(6)
  const { dados, erro } = useAnalises(orcamento.id, mes, meses, escopo)
  const din = (c: number) => (ocultar ? OCULTO : formatar(c))

  // Se o membro escolhido saiu do orçamento, a API devolveria 400: volta pro conjunto.
  useEffect(() => {
    if (escopo !== 'eu' && escopo !== 'conjunto' && !membros.some((m) => m.user_id === escopo)) setEscopo('conjunto')
  }, [membros, escopo])

  // Cor segue a categoria (hash estável ou cor escolhida), não o ranking:
  // trocar o escopo/mês não repinta as fatias.
  const fatias = useMemo(() => {
    if (!dados) return []
    const itens = dados.cats.itens.map((f) => ({
      nome: `${f.emoji ? f.emoji + ' ' : ''}${f.nome}`,
      valor: f.total_cents,
      cor: f.category_id ? corDaCategoria(f.category_id, f.cor).cor : NEUTRO,
    }))
    if (itens.length <= MAX_FATIAS + 1) return itens
    const resto = itens.slice(MAX_FATIAS).reduce((s, f) => s + f.valor, 0)
    return [...itens.slice(0, MAX_FATIAS), { nome: 'Outros', valor: resto, cor: NEUTRO }]
  }, [dados])

  // Ordem dos membros fixa (a do orçamento), pra cor de cada pessoa não mudar.
  const porMembro = useMemo(() => {
    if (!dados) return []
    const ordem = new Map(membros.map((m, i) => [m.user_id, i]))
    return dados.membros.itens
      .map((g) => {
        const i = ordem.get(g.user_id)
        return {
          nome: nomeDoMembro(membros.find((m) => m.user_id === g.user_id), usuarioId),
          saiu: g.saiu_cents,
          entrou: g.entrou_cents,
          cor: i === undefined ? NEUTRO : corDoMembro(i),
        }
      })
      .filter((g) => g.saiu > 0)
  }, [dados, membros, usuarioId])

  const evolucao = useMemo(
    () =>
      dados?.evo.itens.map((p) => ({ mes: mesCurto(p.mes), entrou: p.entrou_cents, saiu: p.saiu_cents, saldo: p.saldo_cents })) ?? [],
    [dados],
  )
  const temEvolucao = evolucao.some((p) => p.entrou || p.saiu)
  const totalMembros = porMembro.reduce((s, g) => s + g.saiu, 0)

  const tooltip = { ...TOOLTIP_GRAFICO, formatter: (v: unknown) => din(Number(v)) }
  const eixoY = {
    tick: TICK_GRAFICO,
    tickFormatter: (c: number) => (ocultar ? '' : reaisCurto(c)),
    axisLine: false,
    tickLine: false,
    width: ocultar ? 8 : 40,
  }
  const eixoX = { tick: TICK_GRAFICO, axisLine: false, tickLine: false }
  const outros = useMemo(() => membros.filter((m) => m.user_id !== usuarioId), [membros, usuarioId])

  return (
    <div>
      <CabecalhoTela selo={mesPorExtenso(mes)} titulo="Análises" descricao="Para onde vai o dinheiro." />

      {/* Filtros no topo, valendo pra todos os gráficos. */}
      <div className="mb-6 space-y-3">
        <FileiraChips>
          <Chip ativo={escopo === 'conjunto'} aoTocar={() => setEscopo('conjunto')}>
            Conjunto
          </Chip>
          <Chip ativo={escopo === 'eu'} aoTocar={() => setEscopo('eu')}>
            Eu
          </Chip>
          {outros.map((m) => (
            <Chip key={m.user_id} ativo={escopo === m.user_id} aoTocar={() => setEscopo(m.user_id)}>
              {nomeDoMembro(m)}
            </Chip>
          ))}
        </FileiraChips>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center">
            <BotaoIcone rotulo="Mês anterior" onClick={() => setMes((m) => deslocarMes(m, -1))}>
              <Icone n="chevronLeft" />
            </BotaoIcone>
            <span className="min-w-[8.5rem] text-center text-sm font-medium capitalize text-texto">{mesPorExtenso(mes)}</span>
            <BotaoIcone rotulo="Próximo mês" onClick={() => setMes((m) => deslocarMes(m, 1))}>
              <Icone n="chevronRight" />
            </BotaoIcone>
          </div>
          <FileiraChips>
            {PERIODOS.map((p) => (
              <Chip key={p} ativo={meses === p} aoTocar={() => setMeses(p)}>
                <span className="font-mono">{p}m</span>
              </Chip>
            ))}
          </FileiraChips>
        </div>
      </div>

      {erro && <Aviso className="mb-4">{erro}</Aviso>}
      {!dados && !erro && (
        <div className="grid gap-3 lg:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Esqueleto key={i} className="h-64 rounded-card" />
          ))}
        </div>
      )}

      {dados && (
        <div className="cascata grid gap-3 lg:grid-cols-2">
          <CartaoGrafico
            selo="Categorias"
            titulo="Gastos por categoria"
            extra={<Valor centavos={dados.cats.total_cents} tipo="saida" tamanho="lg" ocultar={ocultar} />}
          >
            {fatias.length === 0 ? (
              <SemDados />
            ) : (
              <div className="flex flex-col items-center gap-4 sm:flex-row">
                <div className="h-44 w-44 shrink-0">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={fatias}
                        dataKey="valor"
                        nameKey="nome"
                        innerRadius="62%"
                        outerRadius="100%"
                        stroke="rgb(var(--superficie))"
                        strokeWidth={2}
                        animationDuration={600}
                      >
                        {fatias.map((f) => (
                          <Cell key={f.nome} fill={f.cor} />
                        ))}
                      </Pie>
                      <Tooltip {...tooltip} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {/* Legenda em lista com valor: identidade nunca só por cor, e serve de tabela. */}
                <ul className="w-full space-y-1 text-sm">
                  {fatias.map((f) => (
                    <li key={f.nome} className="flex min-h-8 items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: f.cor }} />
                      <span className="truncate text-texto">{f.nome}</span>
                      <span className="ml-auto flex shrink-0 items-baseline gap-2">
                        <Valor centavos={f.valor} tamanho="sm" ocultar={ocultar} className="text-suave" />
                        <span className="w-9 text-right font-mono text-xs text-tenue">
                          {dados.cats.total_cents > 0 ? `${Math.round((f.valor / dados.cats.total_cents) * 100)}%` : '—'}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CartaoGrafico>

          <CartaoGrafico selo="Membros" titulo="Quem gastou quanto">
            {porMembro.length === 0 ? (
              <SemDados />
            ) : (
              <ul className="space-y-3">
                {porMembro.map((g) => (
                  <li key={g.nome}>
                    <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: g.cor }} />
                        <span className="truncate text-texto">{g.nome}</span>
                      </span>
                      <Valor centavos={g.saiu} tamanho="sm" ocultar={ocultar} />
                    </div>
                    {/* Barra simples em vez de BarChart: dá pra ler o nome inteiro no celular. */}
                    <div className="h-2 overflow-hidden rounded-full bg-superficie-alta">
                      <div
                        className="h-full rounded-full transition-[width] duration-700 ease-suave"
                        style={{ width: `${totalMembros > 0 ? (g.saiu / totalMembros) * 100 : 0}%`, background: g.cor }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CartaoGrafico>

          <CartaoGrafico
            selo={`Últimos ${meses} meses`}
            titulo="Entrou × saiu"
            extra={
              temEvolucao && (
                <Legenda
                  itens={[
                    ['Entrou', CORES_GRAFICO.entrada],
                    ['Saiu', CORES_GRAFICO.saida],
                  ]}
                />
              )
            }
          >
            {!temEvolucao ? (
              <SemDados />
            ) : (
              <div className="h-56">
                <ResponsiveContainer>
                  <BarChart data={evolucao} barGap={2}>
                    <CartesianGrid vertical={false} stroke={CORES_GRAFICO.grade} strokeDasharray="3 3" />
                    <XAxis dataKey="mes" {...eixoX} />
                    <YAxis {...eixoY} />
                    <Tooltip {...tooltip} />
                    <Bar dataKey="entrou" name="Entrou" fill={CORES_GRAFICO.entrada} radius={[6, 6, 0, 0]} maxBarSize={18} animationDuration={600} />
                    <Bar dataKey="saiu" name="Saiu" fill={CORES_GRAFICO.saida} radius={[6, 6, 0, 0]} maxBarSize={18} animationDuration={600} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CartaoGrafico>

          <CartaoGrafico selo={`Últimos ${meses} meses`} titulo="Evolução do saldo">
            {!temEvolucao ? (
              <SemDados />
            ) : (
              <div className="h-56">
                <ResponsiveContainer>
                  <LineChart data={evolucao}>
                    <CartesianGrid vertical={false} stroke={CORES_GRAFICO.grade} strokeDasharray="3 3" />
                    <XAxis dataKey="mes" {...eixoX} />
                    <YAxis {...eixoY} />
                    <ReferenceLine y={0} stroke={CORES_GRAFICO.eixo} strokeDasharray="3 3" />
                    <Tooltip {...tooltip} cursor={{ stroke: CORES_GRAFICO.eixo }} />
                    <Line
                      dataKey="saldo"
                      name="Saldo"
                      stroke={CORES_GRAFICO.acento}
                      strokeWidth={2}
                      dot={{ r: 3.5, fill: CORES_GRAFICO.acento, stroke: 'rgb(var(--superficie))', strokeWidth: 2 }}
                      animationDuration={600}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CartaoGrafico>
        </div>
      )}
    </div>
  )
}

function Legenda({ itens }: { itens: [string, string][] }) {
  return (
    <div className="flex shrink-0 gap-3 text-xs text-suave">
      {itens.map(([nome, cor]) => (
        <span key={nome} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: cor }} />
          {nome}
        </span>
      ))}
    </div>
  )
}
