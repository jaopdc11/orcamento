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
import { Icone } from '@/lib/icones'
import { nomeDoMembro } from '@/lib/membros'
import { CabecalhoTela } from '@/lib/ui'
import type { AnaliseCategorias, AnaliseEvolucao, AnaliseMembros, ContextoOrcamento, Escopo } from '@/lib/tipos'

export type Props = ContextoOrcamento

// Paleta categórica da skill dataviz (validada em claro e escuro, ordem fixa:
// a ordem é o que garante separação pra daltônico entre vizinhos).
const SERIES = {
  claro: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'],
  escuro: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
}
const CINZA = { claro: '#9ca3af', escuro: '#6b7280' }
// Até 7 fatias com cor própria; o resto vira "Outros" em vez de inventar a 9ª cor.
const MAX_FATIAS = 7
const OCULTO = 'R$ ••••'

/** O tema é classe no <html>; recharts pinta via prop, então precisa saber qual é. */
function useEscuro(): boolean {
  const [escuro, setEscuro] = useState(() => document.documentElement.classList.contains('dark'))
  useEffect(() => {
    if (typeof MutationObserver === 'undefined') return
    const obs = new MutationObserver(() => setEscuro(document.documentElement.classList.contains('dark')))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])
  return escuro
}

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

function Cartao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <h3 className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-200">{titulo}</h3>
      {children}
    </section>
  )
}

function Vazio() {
  return <p className="py-10 text-center text-sm text-gray-400 dark:text-gray-500">nada lançado no período</p>
}

const mesCurto = (m: string) => mesPorExtenso(m).slice(0, 3) + '/' + m.slice(2, 4)
const reaisCurto = (c: number) =>
  Math.abs(c) >= 100_000 ? `${Math.round(c / 100_000)}k` : String(Math.round(c / 100))

export function Analises({ orcamento, usuarioId, membros, categorias, ocultar }: Props) {
  const [escopo, setEscopo] = useState<Escopo>('conjunto')
  const [mes, setMes] = useState(() => mesDe())
  const [meses, setMeses] = useState(6)
  const { dados, erro } = useAnalises(orcamento.id, mes, meses, escopo)
  const escuro = useEscuro()
  const tema = escuro ? 'escuro' : 'claro'
  const serie = SERIES[tema]
  const eixo = escuro ? '#9ca3af' : '#6b7280'
  const grade = escuro ? '#1f2937' : '#f3f4f6'
  const din = (c: number) => (ocultar ? OCULTO : formatar(c))

  // Se o membro escolhido saiu do orçamento, a API devolveria 400: volta pro conjunto.
  useEffect(() => {
    if (escopo !== 'eu' && escopo !== 'conjunto' && !membros.some((m) => m.user_id === escopo)) setEscopo('conjunto')
  }, [membros, escopo])

  // Cor segue a categoria (a cor que o usuário escolheu, senão a posição dela
  // na lista), não o ranking: trocar o escopo não repinta as fatias.
  const fatias = useMemo(() => {
    if (!dados) return []
    const posicao = new Map(categorias.map((c, i) => [c.id, i]))
    const itens = dados.cats.itens.map((f, i) => ({
      nome: `${f.emoji ? f.emoji + ' ' : ''}${f.nome}`,
      valor: f.total_cents,
      cor: f.cor ?? (f.category_id ? serie[(posicao.get(f.category_id) ?? i) % serie.length]! : CINZA[tema]),
    }))
    if (itens.length <= MAX_FATIAS + 1) return itens
    const resto = itens.slice(MAX_FATIAS).reduce((s, f) => s + f.valor, 0)
    return [...itens.slice(0, MAX_FATIAS), { nome: 'Outros', valor: resto, cor: CINZA[tema] }]
  }, [dados, categorias, serie, tema])

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
          cor: i === undefined ? CINZA[tema] : serie[i % serie.length]!,
        }
      })
      .filter((g) => g.saiu > 0)
  }, [dados, membros, usuarioId, serie, tema])

  const evolucao = useMemo(
    () =>
      dados?.evo.itens.map((p) => ({ mes: mesCurto(p.mes), entrou: p.entrou_cents, saiu: p.saiu_cents, saldo: p.saldo_cents })) ?? [],
    [dados],
  )
  const temEvolucao = evolucao.some((p) => p.entrou || p.saiu)

  const tooltip = {
    formatter: (v: unknown) => din(Number(v)),
    contentStyle: {
      background: escuro ? '#111827' : '#ffffff',
      border: `1px solid ${escuro ? '#1f2937' : '#e5e7eb'}`,
      borderRadius: 8,
      fontSize: 12,
      color: escuro ? '#f3f4f6' : '#111827',
    },
    itemStyle: { color: escuro ? '#e5e7eb' : '#374151' },
    labelStyle: { color: escuro ? '#9ca3af' : '#6b7280' },
    cursor: { fill: escuro ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' },
  }
  const eixoY = {
    tick: { fill: eixo, fontSize: 11 },
    tickFormatter: (c: number) => (ocultar ? '' : reaisCurto(c)),
    axisLine: false,
    tickLine: false,
    width: ocultar ? 8 : 40,
  }
  const eixoX = { tick: { fill: eixo, fontSize: 11 }, axisLine: false, tickLine: false }

  const botao =
    'rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-200'
  const select =
    'rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200'

  return (
    <div>
      <CabecalhoTela titulo="Análises" subtitulo="para onde vai o dinheiro" />

      {/* Filtros numa linha só, valendo pra todos os gráficos. */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <select aria-label="Escopo" className={select} value={escopo} onChange={(e) => setEscopo(e.target.value)}>
          <option value="conjunto">Conjunto</option>
          <option value="eu">Eu</option>
          {membros
            .filter((m) => m.user_id !== usuarioId)
            .map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {nomeDoMembro(m)}
              </option>
            ))}
        </select>
        <div className="flex items-center gap-1">
          <button aria-label="Mês anterior" className={botao} onClick={() => setMes((m) => deslocarMes(m, -1))}>
            <Icone n="chevronLeft" />
          </button>
          <span className="min-w-[9rem] text-center text-sm font-medium capitalize text-gray-700 dark:text-gray-200">
            {mesPorExtenso(mes)}
          </span>
          <button aria-label="Próximo mês" className={botao} onClick={() => setMes((m) => deslocarMes(m, 1))}>
            <Icone n="chevronRight" />
          </button>
        </div>
        <select aria-label="Período da evolução" className={select} value={meses} onChange={(e) => setMeses(Number(e.target.value))}>
          <option value={3}>3 meses</option>
          <option value={6}>6 meses</option>
          <option value={12}>12 meses</option>
          <option value={24}>24 meses</option>
        </select>
      </div>

      {erro && <p className="mb-4 text-sm text-saida">{erro}</p>}
      {!dados && !erro && <p className="text-sm text-gray-400">carregando…</p>}

      {dados && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Cartao titulo={`Gastos por categoria · ${din(dados.cats.total_cents)}`}>
            {fatias.length === 0 ? (
              <Vazio />
            ) : (
              <div className="flex flex-col items-center gap-4 sm:flex-row">
                <div className="h-48 w-48 shrink-0">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={fatias}
                        dataKey="valor"
                        nameKey="nome"
                        innerRadius="58%"
                        outerRadius="100%"
                        stroke={escuro ? '#111827' : '#ffffff'}
                        strokeWidth={2}
                        isAnimationActive={false}
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
                <ul className="w-full space-y-1.5 text-sm">
                  {fatias.map((f) => (
                    <li key={f.nome} className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: f.cor }} />
                      <span className="truncate text-gray-700 dark:text-gray-200">{f.nome}</span>
                      <span className="ml-auto tabular-nums text-gray-500 dark:text-gray-400">
                        {ocultar ? OCULTO : `${Math.round((f.valor / dados.cats.total_cents) * 100)}%`}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Cartao>

          <Cartao titulo="Quem gastou quanto">
            {porMembro.length === 0 ? (
              <Vazio />
            ) : (
              <div style={{ height: Math.max(96, porMembro.length * 44) }}>
                <ResponsiveContainer>
                  <BarChart data={porMembro} layout="vertical" margin={{ left: 0, right: 8 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="nome" {...eixoX} width={96} />
                    <Tooltip {...tooltip} />
                    <Bar dataKey="saiu" name="Gastou" radius={[0, 4, 4, 0]} barSize={18} isAnimationActive={false}>
                      {porMembro.map((g) => (
                        <Cell key={g.nome} fill={g.cor} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Cartao>

          <Cartao titulo="Entrou × saiu">
            {!temEvolucao ? (
              <Vazio />
            ) : (
              <>
                <Legenda itens={[['Entrou', serie[2]!], ['Saiu', serie[1]!]]} />
                <div className="h-56">
                  <ResponsiveContainer>
                    <BarChart data={evolucao} barGap={2}>
                      <CartesianGrid vertical={false} stroke={grade} />
                      <XAxis dataKey="mes" {...eixoX} />
                      <YAxis {...eixoY} />
                      <Tooltip {...tooltip} />
                      <Bar dataKey="entrou" name="Entrou" fill={serie[2]} radius={[4, 4, 0, 0]} maxBarSize={20} isAnimationActive={false} />
                      <Bar dataKey="saiu" name="Saiu" fill={serie[1]} radius={[4, 4, 0, 0]} maxBarSize={20} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </Cartao>

          <Cartao titulo="Evolução do saldo">
            {!temEvolucao ? (
              <Vazio />
            ) : (
              <div className="h-56">
                <ResponsiveContainer>
                  <LineChart data={evolucao}>
                    <CartesianGrid vertical={false} stroke={grade} />
                    <XAxis dataKey="mes" {...eixoX} />
                    <YAxis {...eixoY} />
                    <ReferenceLine y={0} stroke={eixo} strokeDasharray="3 3" />
                    <Tooltip {...tooltip} cursor={{ stroke: eixo }} />
                    <Line
                      dataKey="saldo"
                      name="Saldo"
                      stroke={serie[0]}
                      strokeWidth={2}
                      dot={{ r: 4, fill: serie[0], stroke: escuro ? '#111827' : '#ffffff', strokeWidth: 2 }}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </Cartao>
        </div>
      )}
    </div>
  )
}

function Legenda({ itens }: { itens: [string, string][] }) {
  return (
    <div className="mb-2 flex gap-4 text-xs text-gray-500 dark:text-gray-400">
      {itens.map(([nome, cor]) => (
        <span key={nome} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: cor }} />
          {nome}
        </span>
      ))}
    </div>
  )
}
