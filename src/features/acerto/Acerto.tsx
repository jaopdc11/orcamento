import { useCallback, useEffect, useMemo, useState } from 'react'
import { CabecalhoTela } from '@/lib/ui'
import { formatar } from '@/lib/dinheiro'
import { deslocarMes, mesDe, mesPorExtenso } from '@/lib/datas'
import { ouvirOrcamento } from '@/lib/eventos'
import { mapaDeMembros, nomeDoMembro } from '@/lib/membros'
import type { Acerto as TipoAcerto, ContextoOrcamento } from '@/lib/tipos'
import { buscarAcerto, salvarProporcoes } from './acerto.queries'

export type Props = ContextoOrcamento & {
  /** proporções mudaram: o App relê os membros */
  aoMudar: () => void
}

export function Acerto({ orcamento, usuarioId, membros, ocultar, aoMudar }: Props) {
  const [mes, setMes] = useState(mesDe())
  const [dados, setDados] = useState<TipoAcerto | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const porId = useMemo(() => mapaDeMembros(membros), [membros])
  const din = (c: number) => (ocultar ? 'R$ ••••' : formatar(c))
  const nome = (id: string) => nomeDoMembro(porId.get(id), usuarioId)

  const carregar = useCallback(() => {
    buscarAcerto(orcamento.id, mes)
      .then((a) => {
        setDados(a)
        setErro(null)
      })
      .catch((e: Error) => setErro(e.message))
  }, [orcamento.id, mes])

  useEffect(carregar, [carregar])
  // membros entra porque a proporção mudada pelo outro chega como evento 'membros'
  useEffect(
    () => ouvirOrcamento(orcamento.id, (t) => (t === 'lancamentos' || t === 'membros') && carregar()),
    [orcamento.id, carregar],
  )

  return (
    <div>
      <CabecalhoTela titulo="Acerto de contas" subtitulo="Só despesas. Quem pagou vs. a parte de cada um." />

      <div className="mb-4 flex items-center justify-between rounded-lg border border-borda bg-painel px-2 py-1">
        <button onClick={() => setMes(deslocarMes(mes, -1))} className="px-3 py-1 text-xl" aria-label="mês anterior">
          ‹
        </button>
        <span className="text-sm font-semibold">{mesPorExtenso(mes)}</span>
        <button
          onClick={() => setMes(deslocarMes(mes, 1))}
          disabled={mes >= mesDe()}
          className="px-3 py-1 text-xl disabled:opacity-20"
          aria-label="próximo mês"
        >
          ›
        </button>
      </div>

      {erro && <p className="mb-4 text-sm text-saida">{erro}</p>}
      {!dados && !erro && <p className="text-sm text-apagado">carregando…</p>}

      {dados && (
        <>
          <section className="mb-4 rounded-lg border border-borda bg-painel p-4">
            <p className="text-xs text-apagado">Despesas do mês</p>
            <p className="text-2xl font-semibold tabular-nums">{din(dados.total_cents)}</p>
            <div className="mt-3 space-y-2">
              {dados.transferencias.length === 0 ? (
                <p className="text-sm text-apagado">
                  {dados.total_cents === 0 ? 'Nenhuma despesa neste mês.' : 'Tudo certo: ninguém deve nada.'}
                </p>
              ) : (
                dados.transferencias.map((t) => (
                  <p key={`${t.de}-${t.para}`} className="rounded-md bg-fundo px-3 py-2 text-sm">
                    <strong>{nome(t.de)}</strong> deve <strong className="tabular-nums">{din(t.valor_cents)}</strong> a{' '}
                    <strong>{nome(t.para)}</strong>
                  </p>
                ))
              )}
            </div>
          </section>

          <section className="mb-4 overflow-hidden rounded-lg border border-borda bg-painel">
            <div className="grid grid-cols-4 gap-2 border-b border-borda px-4 py-2 text-xs text-apagado">
              <span>Membro</span>
              <span className="text-right">Pagou</span>
              <span className="text-right">Parte</span>
              <span className="text-right">Saldo</span>
            </div>
            {dados.membros.map((m) => (
              <div key={m.user_id} className="grid grid-cols-4 gap-2 px-4 py-2 text-sm tabular-nums">
                <span className="truncate">{nome(m.user_id)}</span>
                <span className="text-right">{din(m.pagou_cents)}</span>
                <span className="text-right">{din(m.parte_cents)}</span>
                <span className={`text-right ${m.saldo_cents < 0 ? 'text-saida' : m.saldo_cents > 0 ? 'text-entrada' : ''}`}>
                  {m.saldo_cents > 0 ? '+' : ''}
                  {din(m.saldo_cents)}
                </span>
              </div>
            ))}
          </section>
        </>
      )}

      <EditorProporcoes
        key={membros.map((m) => `${m.user_id}:${m.proporcao}`).join()}
        ledgerId={orcamento.id}
        membros={membros}
        nome={nome}
        aoSalvar={() => {
          aoMudar()
          carregar()
        }}
      />
    </div>
  )
}

function EditorProporcoes({
  ledgerId,
  membros,
  nome,
  aoSalvar,
}: {
  ledgerId: string
  membros: ContextoOrcamento['membros']
  nome: (id: string) => string
  aoSalvar: () => void
}) {
  const [pesos, setPesos] = useState<Record<string, number>>(() =>
    Object.fromEntries(membros.map((m) => [m.user_id, m.proporcao])),
  )
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const soma = Object.values(pesos).reduce((a, b) => a + b, 0)
  const mudou = membros.some((m) => pesos[m.user_id] !== m.proporcao)

  async function salvar() {
    setSalvando(true)
    setErro(null)
    try {
      await salvarProporcoes(
        ledgerId,
        membros.map((m) => ({ user_id: m.user_id, proporcao: pesos[m.user_id] ?? 0 })),
      )
      aoSalvar()
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <section className="rounded-lg border border-borda bg-painel p-4">
      <h3 className="text-sm font-semibold">Proporções</h3>
      <p className="mb-3 text-xs text-apagado">Pesos: 1 e 1 é meio a meio; 2 e 1 divide em 2/3 e 1/3.</p>
      <div className="space-y-2">
        {membros.map((m) => {
          const p = pesos[m.user_id] ?? 0
          return (
            <label key={m.user_id} className="flex items-center gap-3 text-sm">
              <span className="flex-1 truncate">{nome(m.user_id)}</span>
              <span className="w-12 text-right text-xs text-apagado tabular-nums">
                {soma > 0 ? `${Math.round((p / soma) * 100)}%` : '—'}
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                value={p}
                onChange={(e) => {
                  const v = Math.max(0, Math.min(100, Math.trunc(Number(e.target.value) || 0)))
                  setPesos((at) => ({ ...at, [m.user_id]: v }))
                }}
                className="w-16 rounded-md border border-borda bg-fundo px-2 py-1 text-right"
              />
            </label>
          )
        })}
      </div>
      {soma === 0 && <p className="mt-2 text-xs text-saida">A soma precisa ser maior que zero.</p>}
      {erro && <p className="mt-2 text-xs text-saida">{erro}</p>}
      <button
        onClick={salvar}
        disabled={!mudou || soma === 0 || salvando}
        className="mt-3 w-full rounded-md bg-primaria px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
      >
        {salvando ? 'salvando…' : 'Salvar proporções'}
      </button>
    </section>
  )
}
