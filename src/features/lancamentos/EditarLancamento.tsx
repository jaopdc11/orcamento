import { useEffect, useMemo, useState } from 'react'
import { formatarSeco, paraCentavos } from '@/lib/dinheiro'
import { nomeDoMembro } from '@/lib/membros'
import { Icone } from '@/lib/icones'
import { editarLancamento } from './lancamentos.queries'
import type { Categoria, EdicaoLancamento, Especie, Membro } from '@/lib/tipos'

/** O mínimo de um lançamento que dá pra editar (serve Lancamento e a Linha do mês). */
export type Editavel = {
  id: string
  category_id: string | null
  kind: Especie
  amount_cents: number
  occurred_on: string
  descricao: string | null
  paid_by: string | null
  created_by: string
  updated_by: string | null
}

type Props = {
  lancamento: Editavel
  categorias: Categoria[]
  membros: Map<string, Membro>
  usuarioId: string
  aoFechar: () => void
  aoSalvar: () => void | Promise<void>
}

/**
 * Modal de editar. Manda só o que mudou: o servidor registra antes/depois no
 * histórico, e campo intocado não deve aparecer lá como "editado".
 */
export function EditarLancamento({ lancamento: l, categorias, membros, usuarioId, aoFechar, aoSalvar }: Props) {
  const [kind, setKind] = useState<Especie>(l.kind)
  const [valor, setValor] = useState(formatarSeco(l.amount_cents))
  const [descricao, setDescricao] = useState(l.descricao ?? '')
  const [categoriaId, setCategoriaId] = useState(l.category_id ?? '')
  const [data, setData] = useState(l.occurred_on)
  const [pagou, setPagou] = useState(l.paid_by ?? '')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [aoFechar])

  const doTipo = useMemo(() => categorias.filter((c) => c.kind === kind), [categorias, kind])
  const listaMembros = useMemo(() => [...membros.values()], [membros])

  const centavos = paraCentavos(valor)

  const mudancas = useMemo((): EdicaoLancamento => {
    const m: EdicaoLancamento = {}
    const cat = categoriaId || null
    const desc = descricao.trim() || null
    if (kind !== l.kind) m.kind = kind
    if (centavos !== null && centavos !== l.amount_cents) m.amount_cents = centavos
    if (cat !== l.category_id) m.category_id = cat
    if (data !== l.occurred_on) m.occurred_on = data
    if (desc !== l.descricao) m.descricao = desc
    if ((pagou || null) !== l.paid_by) m.paid_by = pagou || null
    return m
  }, [kind, centavos, categoriaId, data, descricao, pagou, l])

  const valido = centavos !== null && centavos > 0 && /^\d{4}-\d{2}-\d{2}$/.test(data)
  const pode = valido && Object.keys(mudancas).length > 0 && !salvando

  function trocarKind(k: Especie) {
    setKind(k)
    // categoria de gasto numa entrada o servidor recusa; melhor limpar já
    if (categoriaId && !categorias.some((c) => c.id === categoriaId && c.kind === k)) setCategoriaId('')
  }

  async function salvar() {
    if (!pode) return
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setErro('Editar precisa de internet. Tente de novo quando voltar.')
      return
    }
    setSalvando(true)
    setErro(null)
    try {
      await editarLancamento(l.id, mudancas)
      await aoSalvar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu pra salvar.')
      setSalvando(false)
    }
  }

  const inputCls =
    'w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 dark:border-gray-800 dark:bg-gray-950 dark:text-white dark:focus:border-blue-400'
  const rotuloCls = 'mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400'

  const criador = nomeDoMembro(membros.get(l.created_by), usuarioId)
  const editor = l.updated_by ? nomeDoMembro(membros.get(l.updated_by), usuarioId) : null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      onClick={aoFechar}
      role="dialog"
      aria-modal="true"
      aria-label="Editar lançamento"
    >
      <div
        className="max-h-[90vh] w-full overflow-y-auto rounded-t-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 sm:max-w-md sm:rounded-xl sm:p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Editar lançamento</h3>
            <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
              lançado por {criador}
              {editor ? ` · editado por ${editor}` : ''}
            </p>
          </div>
          <button
            onClick={aoFechar}
            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            aria-label="Fechar"
          >
            <Icone n="x" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-1 rounded-md bg-gray-100 p-1 dark:bg-gray-800">
            {(['expense', 'income'] as const).map((k) => (
              <button
                key={k}
                onClick={() => trocarKind(k)}
                className={`rounded py-1.5 text-sm font-medium transition-colors ${
                  kind === k
                    ? k === 'expense'
                      ? 'bg-white text-red-500 shadow-sm dark:bg-gray-950 dark:text-red-400'
                      : 'bg-white text-emerald-600 shadow-sm dark:bg-gray-950 dark:text-emerald-400'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {k === 'expense' ? 'Despesa' : 'Receita'}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className={rotuloCls}>Valor</span>
              <input
                value={valor}
                inputMode="decimal"
                onChange={(e) => setValor(e.target.value)}
                className={`${inputCls} text-right tabular-nums`}
              />
            </label>
            <label>
              <span className={rotuloCls}>Data</span>
              <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={inputCls} />
            </label>
          </div>

          <label className="block">
            <span className={rotuloCls}>Descrição</span>
            <input
              value={descricao}
              maxLength={200}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="opcional"
              className={inputCls}
            />
          </label>

          <label className="block">
            <span className={rotuloCls}>Categoria</span>
            <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} className={inputCls}>
              <option value="">sem categoria</option>
              {doTipo.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji ? `${c.emoji} ` : ''}
                  {c.nome}
                </option>
              ))}
              {/* categoria arquivada não vem na lista: mantém a atual selecionável */}
              {l.category_id && categoriaId === l.category_id && !doTipo.some((c) => c.id === l.category_id) && (
                <option value={l.category_id}>(categoria arquivada)</option>
              )}
            </select>
          </label>

          <label className="block">
            <span className={rotuloCls}>Quem pagou</span>
            <select value={pagou} onChange={(e) => setPagou(e.target.value)} className={inputCls}>
              <option value="">quem lançou ({criador})</option>
              {listaMembros.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {nomeDoMembro(m, usuarioId)}
                </option>
              ))}
            </select>
          </label>

          {erro && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
              {erro}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={aoFechar}
              className="px-3 py-2 text-sm text-gray-500 transition-colors hover:text-gray-700 dark:hover:text-gray-300"
            >
              Cancelar
            </button>
            <button
              onClick={() => void salvar()}
              disabled={!pode}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-40"
            >
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
