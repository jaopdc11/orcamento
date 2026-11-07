import { useState } from 'react'
import { formatar, formatarSeco, paraCentavos } from '@/lib/dinheiro'
import { deslocarMes, mesDe, mesPorExtenso, porExtenso } from '@/lib/datas'
import { arquivarLancamento } from '@/features/lancamentos/lancamentos.queries'
import { baixarCsv } from '@/lib/csv'
import { copiarMetasDoMesAnterior, definirMeta } from './mes.queries'
import { useMes } from './useMes'
import type { Linha, ResumoCategoria } from './useMes'
import type { Categoria, Membro, Orcamento } from '@/lib/tipos'

type Props = {
  orcamento: Orcamento
  categorias: Categoria[]
  membros: Membro[]
  aoFechar: () => void
}

export function Mes({ orcamento, categorias, membros, aoFechar }: Props) {
  const [mes, setMes] = useState(mesDe())
  const [aba, setAba] = useState<'lista' | 'metas'>('lista')
  const { porDia, totais, porCategoria, linhas, carregando, erro, recarregar } = useMes(
    orcamento.id,
    mes,
    categorias,
  )

  const porId = new Map(categorias.map((c) => [c.id, c]))
  const apelidoDe = new Map(membros.map((m) => [m.user_id, m.apelido]))

  return (
    <div className="flex min-h-[100dvh] flex-col pb-8">
      <header className="sticky top-0 z-10 bg-fundo px-4 pt-3 pb-2">
        <div className="mb-3 flex items-center justify-between">
          <button onClick={aoFechar} className="text-sm text-apagado">
            ← lançar
          </button>
          <button
            onClick={() => baixarCsv(linhas, porId, mes, orcamento.nome)}
            className="text-sm text-apagado underline"
          >
            exportar CSV
          </button>
        </div>

        <div className="flex items-center justify-between">
          <button onClick={() => setMes(deslocarMes(mes, -1))} className="px-3 py-1 text-xl">
            ‹
          </button>
          <span className="text-sm font-semibold">{mesPorExtenso(mes)}</span>
          <button
            onClick={() => setMes(deslocarMes(mes, 1))}
            disabled={mes >= mesDe()}
            className="px-3 py-1 text-xl disabled:opacity-20"
          >
            ›
          </button>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-px bg-borda">
        <Total rotulo="saiu" valor={totais.saiu} cor="text-saida" />
        <Total rotulo="entrou" valor={totais.entrou} cor="text-entrada" />
        <Total
          rotulo="saldo"
          valor={totais.saldo}
          cor={totais.saldo < 0 ? 'text-saida' : 'text-entrada'}
        />
      </div>

      <div className="px-4 py-3">
        <div className="flex gap-1 rounded-lg border border-borda bg-painel p-1">
          {(['lista', 'metas'] as const).map((a) => (
            <button
              key={a}
              onClick={() => setAba(a)}
              className={`flex-1 rounded-md py-2 text-sm font-semibold transition-colors ${
                aba === a ? 'bg-fundo text-texto shadow-sm' : 'text-apagado'
              }`}
            >
              {a === 'lista' ? 'Lançamentos' : 'Metas'}
            </button>
          ))}
        </div>
      </div>

      {erro && <p className="px-4 pb-2 text-xs text-saida">{erro}</p>}
      {carregando && <p className="px-4 text-sm text-apagado">carregando…</p>}

      {aba === 'lista' ? (
        porDia.length === 0 && !carregando ? (
          <p className="px-4 py-8 text-center text-sm text-apagado">
            Nada em {mesPorExtenso(mes)}.
          </p>
        ) : (
          <ul className="flex flex-col gap-4 px-4">
            {porDia.map(([dia, doDia]) => (
              <li key={dia}>
                <p className="mb-1 text-xs text-apagado">{porExtenso(dia)}</p>
                <ul className="flex flex-col gap-px overflow-hidden rounded-lg">
                  {doDia.map((l) => (
                    <ItemLinha
                      key={l.id}
                      linha={l}
                      categoria={l.category_id ? porId.get(l.category_id) : undefined}
                      apelido={l.paid_by ? (apelidoDe.get(l.paid_by) ?? null) : null}
                      aoApagar={async () => {
                        await arquivarLancamento(l.id)
                        await recarregar()
                      }}
                    />
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )
      ) : (
        <Metas
          resumos={porCategoria}
          todas={categorias}
          ledgerId={orcamento.id}
          mes={mes}
          aoMudar={recarregar}
        />
      )}
    </div>
  )
}

function Total({ rotulo, valor, cor }: { rotulo: string; valor: number; cor: string }) {
  return (
    <div className="bg-fundo px-2 py-3 text-center">
      <p className="text-[10px] uppercase tracking-wide text-apagado">{rotulo}</p>
      <p className={`font-mono text-sm tabular-nums ${cor}`}>{formatarSeco(Math.abs(valor))}</p>
    </div>
  )
}

function ItemLinha({
  linha,
  categoria,
  apelido,
  aoApagar,
}: {
  linha: Linha
  categoria: Categoria | undefined
  apelido: string | null
  aoApagar: () => Promise<void>
}) {
  const [confirmando, setConfirmando] = useState(false)

  return (
    <li className="flex items-center gap-3 bg-painel px-3 py-2">
      <span className="text-lg">{categoria?.emoji ?? '•'}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{linha.descricao || categoria?.nome || 'sem categoria'}</p>
        <p className="text-[11px] text-apagado">
          {linha.descricao && categoria ? `${categoria.nome} · ` : ''}
          {apelido ?? ''}
          {linha.pendente && <span className="text-atencao"> · aguardando rede</span>}
        </p>
      </div>
      <span
        className={`font-mono text-sm tabular-nums ${
          linha.kind === 'income' ? 'text-entrada' : 'text-saida'
        }`}
      >
        {linha.kind === 'income' ? '+' : '−'}
        {formatarSeco(linha.amount_cents)}
      </span>
      {/* pendente não dá pra apagar: ainda não existe no banco */}
      {!linha.pendente &&
        (confirmando ? (
          <button onClick={aoApagar} className="text-xs text-saida underline">
            apagar?
          </button>
        ) : (
          <button
            onClick={() => setConfirmando(true)}
            onBlur={() => setConfirmando(false)}
            className="px-1 text-xs text-apagado"
          >
            ⋯
          </button>
        ))}
    </li>
  )
}

function Metas({
  resumos,
  todas,
  ledgerId,
  mes,
  aoMudar,
}: {
  resumos: ResumoCategoria[]
  todas: Categoria[]
  ledgerId: string
  mes: string
  aoMudar: () => Promise<void>
}) {
  const [copiando, setCopiando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  // Categorias sem gasto e sem meta ficam fora do resumo; aqui elas voltam,
  // pra dar pra definir meta de algo que ainda não foi usado no mês.
  const semMovimento = todas.filter(
    (c) => c.kind === 'expense' && !resumos.some((r) => r.categoria.id === c.id),
  )

  async function copiar() {
    setCopiando(true)
    try {
      const n = await copiarMetasDoMesAnterior(ledgerId, mes)
      setAviso(n === 0 ? 'O mês anterior não tinha metas.' : `${n} metas copiadas.`)
      await aoMudar()
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'Não deu.')
    } finally {
      setCopiando(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 px-4">
      <button
        onClick={copiar}
        disabled={copiando}
        className="rounded-xl border border-borda py-2.5 text-sm font-semibold disabled:opacity-50"
      >
        {copiando ? 'copiando…' : 'copiar metas do mês anterior'}
      </button>
      {aviso && <p className="text-xs text-apagado">{aviso}</p>}

      <ul className="flex flex-col gap-2">
        {resumos.map((r) => (
          <CardMeta key={r.categoria.id} resumo={r} ledgerId={ledgerId} mes={mes} aoMudar={aoMudar} />
        ))}
        {semMovimento.map((c) => (
          <CardMeta
            key={c.id}
            resumo={{ categoria: c, gasto: 0, meta: null }}
            ledgerId={ledgerId}
            mes={mes}
            aoMudar={aoMudar}
          />
        ))}
      </ul>
    </div>
  )
}

function CardMeta({
  resumo,
  ledgerId,
  mes,
  aoMudar,
}: {
  resumo: ResumoCategoria
  ledgerId: string
  mes: string
  aoMudar: () => Promise<void>
}) {
  const { categoria, gasto, meta } = resumo
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState(meta ? formatarSeco(meta) : '')

  const fracao = meta && meta > 0 ? gasto / meta : 0
  const estourou = meta !== null && gasto > meta

  async function salvar() {
    setEditando(false)
    const centavos = paraCentavos(texto)
    if (centavos === null && texto.trim() !== '') return
    await definirMeta(ledgerId, categoria.id, mes, centavos ?? 0)
    await aoMudar()
  }

  return (
    <li className="rounded-lg bg-painel p-3">
      <div className="mb-2 flex items-center gap-2">
        <span>{categoria.emoji ?? '•'}</span>
        <span className="flex-1 text-sm">{categoria.nome}</span>
        {editando ? (
          <input
            autoFocus
            value={texto}
            inputMode="decimal"
            onChange={(e) => setTexto(e.target.value)}
            onBlur={salvar}
            onKeyDown={(e) => e.key === 'Enter' && void salvar()}
            placeholder="sem meta"
            className="w-24 rounded border border-borda bg-fundo px-2 py-1 text-right font-mono text-sm outline-none focus:border-primaria"
          />
        ) : (
          <button
            onClick={() => {
              setTexto(meta ? formatarSeco(meta) : '')
              setEditando(true)
            }}
            className="font-mono text-sm tabular-nums text-apagado"
          >
            {meta ? `${formatarSeco(gasto)} / ${formatarSeco(meta)}` : formatar(gasto)}
          </button>
        )}
      </div>

      {meta !== null && (
        <div className="h-1.5 overflow-hidden rounded-full bg-fundo">
          <div
            className={`h-full transition-[width] ${estourou ? 'bg-saida' : 'bg-entrada'}`}
            style={{ width: `${Math.min(100, fracao * 100)}%` }}
          />
        </div>
      )}
    </li>
  )
}
