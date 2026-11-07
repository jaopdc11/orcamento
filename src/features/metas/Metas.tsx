import { useCallback, useEffect, useMemo, useState } from 'react'
import { CabecalhoTela } from '@/lib/ui'
import { formatar, formatarSeco, paraCentavos } from '@/lib/dinheiro'
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

// A partir daqui a barra fica amarela: dá tempo de segurar antes de estourar.
// Mesmo limiar do aviso por push (F8).
const ALERTA = 0.8

const OCULTO = 'R$ ••••'

type Dados = { metas: Meta[]; gasto: Map<string, number>; economia: Economia }

/** Metas são do orçamento inteiro: não há seletor de escopo aqui de propósito. */
export function Metas({ orcamento, categorias, ocultar }: Props) {
  const ledgerId = orcamento.id
  const [mes, setMes] = useState(mesDe())
  const [dados, setDados] = useState<Dados | null>(null)
  const [erro, setErro] = useState<string | null>(null)

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
      setErro(e instanceof Error ? e.message : 'Não deu pra carregar.')
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

  const resumo = useMemo(() => {
    const comMeta = linhas.filter((l) => l.meta !== null)
    return {
      quantas: comMeta.length,
      estouradas: comMeta.filter((l) => l.gasto > l.meta!).length,
      limite: comMeta.reduce((s, l) => s + l.meta!, 0),
      gasto: comMeta.reduce((s, l) => s + l.gasto, 0),
    }
  }, [linhas])

  const dinheiro = (c: number) => (ocultar ? OCULTO : formatar(c))

  return (
    <div className="mx-auto max-w-2xl">
      <CabecalhoTela titulo="Metas" subtitulo="Limites por categoria e quanto guardar no mês" />

      <div className="mb-4 flex items-center justify-between rounded-lg border border-borda bg-painel px-2 py-1">
        <button onClick={() => setMes(deslocarMes(mes, -1))} className="px-3 py-1 text-xl" aria-label="mês anterior">
          ‹
        </button>
        <span className="text-sm font-semibold capitalize">{mesPorExtenso(mes)}</span>
        <button onClick={() => setMes(deslocarMes(mes, 1))} className="px-3 py-1 text-xl" aria-label="próximo mês">
          ›
        </button>
      </div>

      {erro && (
        <div className="mb-4 rounded-lg border border-saida/40 p-3 text-sm text-saida">
          {erro}{' '}
          <button onClick={() => void recarregar()} className="underline">
            tentar de novo
          </button>
        </div>
      )}

      {!dados ? (
        !erro && <p className="py-8 text-center text-sm text-apagado">carregando…</p>
      ) : (
        <div className="flex flex-col gap-6">
          <SecaoEconomia
            key={`eco-${mes}`}
            ledgerId={ledgerId}
            mes={mes}
            economia={dados.economia}
            ocultar={ocultar}
            aoMudar={recarregar}
          />

          <section>
            <div className="mb-2 flex items-end justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold">Limite por categoria</h3>
                {resumo.quantas > 0 && (
                  <p className="text-xs text-apagado">
                    {dinheiro(resumo.gasto)} de {dinheiro(resumo.limite)}
                    {resumo.estouradas > 0 && (
                      <span className="text-saida">
                        {' '}
                        · {resumo.estouradas} estourada{resumo.estouradas > 1 ? 's' : ''}
                      </span>
                    )}
                  </p>
                )}
              </div>
              <BotaoCopiar ledgerId={ledgerId} mes={mes} aoMudar={recarregar} />
            </div>

            {linhas.length === 0 ? (
              <p className="rounded-lg border border-borda bg-painel p-4 text-sm text-apagado">
                Nenhuma categoria de gasto ainda.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {linhas.map((l) => (
                  <CardLimite
                    key={`${mes}-${l.categoria.id}`}
                    categoria={l.categoria}
                    gasto={l.gasto}
                    meta={l.meta}
                    ledgerId={ledgerId}
                    mes={mes}
                    ocultar={ocultar}
                    aoMudar={recarregar}
                  />
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  )
}

function Barra({ fracao, cor }: { fracao: number; cor: string }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-fundo">
      <div
        className={`h-full rounded-full transition-[width] ${cor}`}
        style={{ width: `${Math.max(0, Math.min(100, fracao * 100))}%` }}
      />
    </div>
  )
}

/** Campo de valor que salva no blur/Enter. Vazio ou 0 = remover. */
function CampoValor({
  inicial,
  aoSalvar,
  aoCancelar,
}: {
  inicial: number | null
  aoSalvar: (centavos: number) => Promise<void>
  aoCancelar: () => void
}) {
  const [texto, setTexto] = useState(inicial ? formatarSeco(inicial) : '')

  async function salvar() {
    const centavos = paraCentavos(texto)
    if (centavos === null && texto.trim() !== '') return aoCancelar()
    await aoSalvar(centavos ?? 0)
  }

  return (
    <input
      autoFocus
      value={texto}
      inputMode="decimal"
      onChange={(e) => setTexto(e.target.value)}
      onBlur={() => void salvar()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        if (e.key === 'Escape') aoCancelar()
      }}
      placeholder="sem meta"
      className="w-28 rounded border border-borda bg-fundo px-2 py-1 text-right font-mono text-sm outline-none focus:border-primaria"
    />
  )
}

function SecaoEconomia({
  ledgerId,
  mes,
  economia,
  ocultar,
  aoMudar,
}: {
  ledgerId: string
  mes: string
  economia: Economia
  ocultar: boolean
  aoMudar: () => Promise<void>
}) {
  const [editando, setEditando] = useState(false)
  const [falha, setFalha] = useState<string | null>(null)
  const { target_cents: alvo, guardado_cents: guardado, entrou_cents, saiu_cents } = economia
  const dinheiro = (c: number) => (ocultar ? OCULTO : formatar(c))

  const fracao = alvo ? guardado / alvo : 0
  const bateu = alvo !== null && guardado >= alvo
  const cor = guardado < 0 ? 'bg-saida' : bateu ? 'bg-entrada' : 'bg-primaria'

  async function salvar(centavos: number) {
    setEditando(false)
    try {
      await definirEconomia(ledgerId, mes, centavos)
      setFalha(null)
      await aoMudar()
    } catch (e) {
      setFalha(e instanceof Error ? e.message : 'Não deu pra salvar.')
    }
  }

  return (
    <section className="rounded-lg border border-borda bg-painel p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Meta de economia</h3>
          <p className="text-xs text-apagado">
            entrou {dinheiro(entrou_cents)} · saiu {dinheiro(saiu_cents)}
          </p>
        </div>
        {editando ? (
          <CampoValor inicial={alvo} aoSalvar={salvar} aoCancelar={() => setEditando(false)} />
        ) : (
          <button onClick={() => setEditando(true)} className="text-xs text-primaria underline">
            {alvo === null ? 'definir meta' : 'editar'}
          </button>
        )}
      </div>

      <p className="mb-2 font-mono text-2xl tabular-nums">
        <span className={guardado < 0 ? 'text-saida' : ''}>{dinheiro(guardado)}</span>
        {alvo !== null && <span className="text-sm text-apagado"> / {dinheiro(alvo)}</span>}
      </p>

      {alvo !== null ? (
        <>
          <Barra fracao={fracao} cor={cor} />
          <p className={`mt-2 text-xs ${guardado < 0 ? 'text-saida' : bateu ? 'text-entrada' : 'text-apagado'}`}>
            {guardado < 0
              ? 'Saiu mais do que entrou neste mês.'
              : bateu
                ? 'Meta batida!'
                : `Faltam ${dinheiro(alvo - guardado)} (${Math.round(fracao * 100)}%).`}
          </p>
        </>
      ) : (
        <p className="text-xs text-apagado">Sem meta neste mês. Guardado = entrou − saiu.</p>
      )}
      {falha && <p className="mt-2 text-xs text-saida">{falha}</p>}
    </section>
  )
}

function BotaoCopiar({ ledgerId, mes, aoMudar }: { ledgerId: string; mes: string; aoMudar: () => Promise<void> }) {
  const [copiando, setCopiando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  async function copiar() {
    setCopiando(true)
    try {
      const n = await copiarMetasDoMesAnterior(ledgerId, mes)
      setAviso(n === 0 ? 'O mês anterior não tinha limites.' : `${n} copiado${n > 1 ? 's' : ''}.`)
      await aoMudar()
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'Não deu.')
    } finally {
      setCopiando(false)
    }
  }

  return (
    <div className="flex flex-col items-end">
      <button
        onClick={() => void copiar()}
        disabled={copiando}
        className="rounded-lg border border-borda px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
      >
        {copiando ? 'copiando…' : 'copiar do mês anterior'}
      </button>
      {aviso && <span className="mt-1 text-xs text-apagado">{aviso}</span>}
    </div>
  )
}

function CardLimite({
  categoria,
  gasto,
  meta,
  ledgerId,
  mes,
  ocultar,
  aoMudar,
}: {
  categoria: Categoria
  gasto: number
  meta: number | null
  ledgerId: string
  mes: string
  ocultar: boolean
  aoMudar: () => Promise<void>
}) {
  const [editando, setEditando] = useState(false)
  const [falha, setFalha] = useState<string | null>(null)

  const fracao = meta ? gasto / meta : 0
  const estourou = meta !== null && gasto > meta
  const cor = estourou ? 'bg-saida' : fracao >= ALERTA ? 'bg-atencao' : 'bg-entrada'
  const seco = (c: number) => (ocultar ? '••••' : formatarSeco(c))

  async function salvar(centavos: number) {
    setEditando(false)
    if (centavos === (meta ?? 0)) return
    try {
      await definirMeta(ledgerId, categoria.id, mes, centavos)
      setFalha(null)
      await aoMudar()
    } catch (e) {
      setFalha(e instanceof Error ? e.message : 'Não deu pra salvar.')
    }
  }

  return (
    <li className={`rounded-lg border bg-painel p-3 ${estourou ? 'border-saida/50' : 'border-borda'}`}>
      <div className="flex items-center gap-2">
        <span>{categoria.emoji ?? '•'}</span>
        <span className="min-w-0 flex-1 truncate text-sm">{categoria.nome}</span>
        {editando ? (
          <CampoValor inicial={meta} aoSalvar={salvar} aoCancelar={() => setEditando(false)} />
        ) : (
          <button
            onClick={() => setEditando(true)}
            className="font-mono text-sm tabular-nums text-apagado"
            aria-label={`editar limite de ${categoria.nome}`}
          >
            {meta !== null ? (
              <>
                <span className={estourou ? 'text-saida' : ''}>{seco(gasto)}</span> / {seco(meta)}
              </>
            ) : (
              <>
                {seco(gasto)} <span className="text-xs text-primaria">+ limite</span>
              </>
            )}
          </button>
        )}
      </div>

      {meta !== null && (
        <div className="mt-2">
          <Barra fracao={fracao} cor={cor} />
          <p className={`mt-1 text-xs ${estourou ? 'text-saida' : 'text-apagado'}`}>
            {estourou
              ? `Estourou em ${ocultar ? OCULTO : formatar(gasto - meta)}`
              : `Resta ${ocultar ? OCULTO : formatar(meta - gasto)} · ${Math.round(fracao * 100)}%`}
          </p>
        </div>
      )}
      {falha && <p className="mt-1 text-xs text-saida">{falha}</p>}
    </li>
  )
}
