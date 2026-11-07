import { useMemo, useState } from 'react'
import { formatar, paraCentavos } from '@/lib/dinheiro'
import { deslocarMes, hoje, mesDe, mesPorExtenso } from '@/lib/datas'
import { uuidv7 } from '@/lib/uuidv7'
import { enfileirar } from '@/lib/fila'
import { arquivarLancamento } from '@/features/lancamentos/lancamentos.queries'
import { Icone } from '@/lib/icones'
import { nomeDoMembro } from '@/lib/membros'
import { EditarLancamento } from '@/features/lancamentos/EditarLancamento'
import { SeloRecorrente } from '@/features/recorrentes/SeloRecorrente'
import { useMes } from './useMes'
import type { Linha } from './useMes'
import type { Categoria, Especie, LancamentoNovo, Membro } from '@/lib/tipos'

// A home, na cara do cashly: "Orçamento Mensal", navegador de mês, uma fileira de
// cards de resumo e duas colunas (Receitas / Despesas) com "+ Adicionar" e estado
// vazio. Os dados vêm do useMes (o mesmo do resto do app); adicionar continua
// passando pela fila offline.

type Props = {
  ledgerId: string
  categorias: Categoria[]
  usuarioId: string
  ocultar: boolean
  /** user_id → membro; pra autoria nas linhas (F1 usa com nomeDoMembro) */
  membros: Map<string, Membro>
}

export function Dashboard({ ledgerId, categorias, usuarioId, ocultar, membros }: Props) {
  const [mes, setMes] = useState(mesDe())
  const { linhas, totais, porCategoria, metas, carregando, erro, recarregar } = useMes(
    ledgerId,
    mes,
    categorias,
  )

  const [editando, setEditando] = useState<Linha | null>(null)
  // filtro por kind dentro de useMemo: senão cada render recria e recompõe as colunas
  const receitas = useMemo(() => linhas.filter((l) => l.kind === 'income'), [linhas])
  const despesas = useMemo(() => linhas.filter((l) => l.kind === 'expense'), [linhas])
  const catReceita = useMemo(() => categorias.filter((c) => c.kind === 'income'), [categorias])
  const catDespesa = useMemo(() => categorias.filter((c) => c.kind === 'expense'), [categorias])

  const metaTotal = useMemo(() => metas.reduce((s, m) => s + m.limit_cents, 0), [metas])
  const porId = useMemo(() => new Map(categorias.map((c) => [c.id, c])), [categorias])

  const dinheiro = (c: number) => (ocultar ? 'R$ ••••' : formatar(c))

  return (
    <div>
      {/* cabeçalho + navegador de mês */}
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Orçamento Mensal</h2>
          <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
            {carregando ? 'carregando…' : `${linhas.length} lançamento${linhas.length === 1 ? '' : 's'} no mês`}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMes(deslocarMes(mes, -1))}
            className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            aria-label="Mês anterior"
          >
            <Icone n="chevronLeft" />
          </button>
          <span className="min-w-[9rem] text-center text-sm font-medium capitalize text-gray-700 dark:text-gray-200">
            {mesPorExtenso(mes)}
          </span>
          <button
            onClick={() => setMes(deslocarMes(mes, 1))}
            disabled={mes >= mesDe()}
            className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            aria-label="Próximo mês"
          >
            <Icone n="chevronRight" />
          </button>
        </div>
      </div>

      {erro && (
        <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
          {erro}
        </p>
      )}

      {/* cards de resumo */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <CardResumo icone="trendingUp" corIcone="text-emerald-500" rotulo="Receitas" valor={dinheiro(totais.entrou)} corValor="text-emerald-600 dark:text-emerald-400" />
        <CardResumo icone="trendingDown" corIcone="text-red-500" rotulo="Despesas" valor={dinheiro(totais.saiu)} corValor="text-red-500 dark:text-red-400" />
        <CardResumo
          icone="wallet"
          corIcone={totais.saldo < 0 ? 'text-red-500' : 'text-blue-500'}
          rotulo="Saldo"
          valor={dinheiro(totais.saldo)}
          corValor={totais.saldo < 0 ? 'text-red-500 dark:text-red-400' : 'text-gray-900 dark:text-white'}
        />
        <CardResumo icone="target" corIcone="text-blue-500" rotulo="Metas" valor={dinheiro(metaTotal)} corValor="text-blue-600 dark:text-blue-400" />
      </div>

      {/* colunas receitas / despesas */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Coluna
          especie="income"
          titulo="Receitas"
          cor="emerald"
          linhas={receitas}
          categorias={catReceita}
          porId={porId}
          ledgerId={ledgerId}
          usuarioId={usuarioId}
          ocultar={ocultar}
          membros={membros}
          aoMudar={recarregar}
          aoEditar={setEditando}
        />
        <Coluna
          especie="expense"
          titulo="Despesas"
          cor="red"
          linhas={despesas}
          categorias={catDespesa}
          porId={porId}
          ledgerId={ledgerId}
          usuarioId={usuarioId}
          ocultar={ocultar}
          membros={membros}
          aoMudar={recarregar}
          aoEditar={setEditando}
        />
      </div>

      {/* análise por meta */}
      <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900 sm:p-5">
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Metas do mês
        </h3>
        {porCategoria.filter((r) => r.meta !== null).length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-400 dark:text-gray-500">
            Defina metas nas categorias para ver o acompanhamento aqui.
          </p>
        ) : (
          <ul className="space-y-3">
            {porCategoria
              .filter((r) => r.meta !== null)
              .map((r) => {
                const fracao = r.meta && r.meta > 0 ? r.gasto / r.meta : 0
                const estourou = r.meta !== null && r.gasto > r.meta
                return (
                  <li key={r.categoria.id}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                        <span>{r.categoria.emoji ?? '•'}</span>
                        {r.categoria.nome}
                      </span>
                      <span className="tabular-nums text-gray-500 dark:text-gray-400">
                        {dinheiro(r.gasto)} / {dinheiro(r.meta ?? 0)}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
                      <div
                        className={`h-full rounded-full transition-[width] ${estourou ? 'bg-red-500' : 'bg-emerald-500'}`}
                        style={{ width: `${Math.min(100, fracao * 100)}%` }}
                      />
                    </div>
                  </li>
                )
              })}
          </ul>
        )}
      </div>

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
        />
      )}
    </div>
  )
}

function CardResumo({
  icone,
  corIcone,
  rotulo,
  valor,
  corValor,
}: {
  icone: 'trendingUp' | 'trendingDown' | 'wallet' | 'target'
  corIcone: string
  rotulo: string
  valor: string
  corValor: string
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 transition-colors dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-2 flex items-center gap-1.5">
        <span className={corIcone}>
          <Icone n={icone} className="h-3.5 w-3.5" />
        </span>
        <span className="text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {rotulo}
        </span>
      </div>
      <p className={`text-lg font-semibold tabular-nums ${corValor}`}>{valor}</p>
    </div>
  )
}

const CORES = {
  emerald: {
    texto: 'text-emerald-600 dark:text-emerald-400',
    botao: 'text-emerald-600 hover:text-emerald-700 dark:text-emerald-400',
    valor: 'text-emerald-600 dark:text-emerald-400',
  },
  red: {
    texto: 'text-red-500 dark:text-red-400',
    botao: 'text-red-500 hover:text-red-600 dark:text-red-400',
    valor: 'text-red-500 dark:text-red-400',
  },
} as const

function Coluna({
  especie,
  titulo,
  cor,
  linhas,
  categorias,
  porId,
  ledgerId,
  usuarioId,
  ocultar,
  membros,
  aoMudar,
  aoEditar,
}: {
  especie: Especie
  titulo: string
  cor: keyof typeof CORES
  linhas: Linha[]
  categorias: Categoria[]
  porId: Map<string, Categoria>
  ledgerId: string
  usuarioId: string
  ocultar: boolean
  membros: Map<string, Membro>
  aoMudar: () => Promise<void>
  aoEditar: (l: Linha) => void
}) {
  const [adicionando, setAdicionando] = useState(false)
  const c = CORES[cor]
  const dinheiro = (n: number) => (ocultar ? 'R$ ••••' : formatar(n))

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {titulo}
        </h3>
        <button
          onClick={() => setAdicionando((v) => !v)}
          className={`flex items-center gap-1 text-sm font-medium transition-colors ${c.botao}`}
        >
          <Icone n={adicionando ? 'x' : 'plus'} className="h-4 w-4" />
          {adicionando ? 'Fechar' : 'Adicionar'}
        </button>
      </div>

      {adicionando && (
        <FormAdicionar
          especie={especie}
          categorias={categorias}
          ledgerId={ledgerId}
          usuarioId={usuarioId}
          cor={cor}
          aoConcluir={async () => {
            setAdicionando(false)
            await aoMudar()
          }}
        />
      )}

      {linhas.length === 0 ? (
        <div className="py-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
            <span className="text-gray-300 dark:text-gray-600">
              <Icone n={especie === 'income' ? 'trendingUp' : 'trendingDown'} className="h-5 w-5" />
            </span>
          </div>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Nenhuma {especie === 'income' ? 'receita' : 'despesa'} registrada
          </p>
          <p className="mt-1 text-xs text-gray-300 dark:text-gray-600">
            Clique em “Adicionar” para começar
          </p>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {linhas.map((l) => (
            <ItemLinha
              key={l.id}
              linha={l}
              categoria={l.category_id ? porId.get(l.category_id) : undefined}
              valorTexto={dinheiro(l.amount_cents)}
              corValor={c.valor}
              membros={membros}
              usuarioId={usuarioId}
              aoEditar={() => aoEditar(l)}
              aoApagar={async () => {
                await arquivarLancamento(l.id)
                await aoMudar()
              }}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function ItemLinha({
  linha,
  categoria,
  valorTexto,
  corValor,
  membros,
  usuarioId,
  aoEditar,
  aoApagar,
}: {
  linha: Linha
  categoria: Categoria | undefined
  valorTexto: string
  corValor: string
  /** autoria: quem pagou (senão quem lançou), e quem editou se foi outra pessoa */
  membros: Map<string, Membro>
  usuarioId: string
  aoEditar: () => void
  aoApagar: () => Promise<void>
}) {
  // "Gasto de um membro" é de quem pagou, senão de quem lançou: a linha mostra o mesmo dono.
  const dono = nomeDoMembro(membros.get(linha.paid_by ?? linha.created_by))
  const editor =
    linha.updated_by && linha.updated_by !== linha.created_by
      ? nomeDoMembro(membros.get(linha.updated_by), usuarioId)
      : null
  const subtitulo = [linha.descricao && categoria ? categoria.nome : null, dono, editor ? `editado por ${editor}` : null]
    .filter(Boolean)
    .join(' · ')
  const [confirmando, setConfirmando] = useState(false)
  return (
    <li className="group flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800">
      <span className="text-base">{categoria?.emoji ?? '•'}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-gray-800 dark:text-gray-200">
          {linha.descricao || categoria?.nome || 'sem categoria'}
          {linha.recurring_id && <SeloRecorrente className="ml-1" />}
        </p>
        <p className="text-[11px] text-gray-400 dark:text-gray-500">
          {subtitulo}
          {linha.pendente && (
            <span className="text-amber-500 dark:text-amber-400">
              {subtitulo ? ' · ' : ''}aguardando rede
            </span>
          )}
        </p>
      </div>
      <span className={`text-sm font-medium tabular-nums ${corValor}`}>{valorTexto}</span>
      {/* pendente ainda não existe no servidor, e editar é só online */}
      {!linha.pendente && !confirmando && (
        <button
          onClick={aoEditar}
          className="text-gray-300 transition-opacity hover:text-blue-500 sm:opacity-0 sm:group-hover:opacity-100 dark:text-gray-600"
          aria-label="Editar"
        >
          <Icone n="pencil" className="h-4 w-4" />
        </button>
      )}
      {!linha.pendente &&
        (confirmando ? (
          <button
            onClick={aoApagar}
            className="text-xs font-medium text-red-500 hover:text-red-600"
          >
            apagar?
          </button>
        ) : (
          <button
            onClick={() => setConfirmando(true)}
            onBlur={() => setConfirmando(false)}
            className="text-gray-300 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100 dark:text-gray-600"
            aria-label="Remover"
          >
            <Icone n="trash" className="h-4 w-4" />
          </button>
        ))}
    </li>
  )
}

function FormAdicionar({
  especie,
  categorias,
  ledgerId,
  usuarioId,
  cor,
  aoConcluir,
}: {
  especie: Especie
  categorias: Categoria[]
  ledgerId: string
  usuarioId: string
  cor: keyof typeof CORES
  aoConcluir: () => Promise<void>
}) {
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [categoriaId, setCategoriaId] = useState(categorias[0]?.id ?? '')
  const [salvando, setSalvando] = useState(false)

  const centavos = paraCentavos(valor)
  const pode = centavos !== null && centavos > 0 && categoriaId !== '' && !salvando
  const btn =
    cor === 'emerald'
      ? 'bg-emerald-600 hover:bg-emerald-700'
      : 'bg-red-600 hover:bg-red-700'

  async function salvar() {
    if (!pode || centavos === null) return
    setSalvando(true)
    const novo: LancamentoNovo = {
      id: uuidv7(),
      ledger_id: ledgerId,
      category_id: categoriaId,
      kind: especie,
      amount_cents: centavos,
      occurred_on: hoje(),
      descricao: descricao.trim() || null,
      paid_by: usuarioId,
      created_by: usuarioId,
      client_created_at: new Date().toISOString(),
    }
    await enfileirar(novo)
    setSalvando(false)
    await aoConcluir()
  }

  const inputCls =
    'w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 dark:border-gray-800 dark:bg-gray-950 dark:text-white dark:focus:border-blue-400'

  return (
    <div className="mb-4 space-y-2 rounded-md border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-950">
      <input
        autoFocus
        value={descricao}
        onChange={(e) => setDescricao(e.target.value)}
        placeholder="Descrição (opcional)"
        className={inputCls}
      />
      <div className="flex gap-2">
        <input
          value={valor}
          inputMode="decimal"
          onChange={(e) => setValor(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void salvar()}
          placeholder="0,00"
          className={`${inputCls} flex-1 text-right tabular-nums`}
        />
        <select
          value={categoriaId}
          onChange={(e) => setCategoriaId(e.target.value)}
          className={`${inputCls} flex-1`}
        >
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.emoji ? `${c.emoji} ` : ''}
              {c.nome}
            </option>
          ))}
        </select>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button
          onClick={() => void aoConcluir()}
          className="px-2 py-1 text-xs text-gray-500 transition-colors hover:text-gray-700 dark:hover:text-gray-300"
        >
          Cancelar
        </button>
        <button
          onClick={() => void salvar()}
          disabled={!pode}
          className={`rounded-md px-3 py-1 text-xs font-medium text-white transition-colors disabled:opacity-40 ${btn}`}
        >
          {salvando ? 'Salvando…' : 'Adicionar'}
        </button>
      </div>
    </div>
  )
}
