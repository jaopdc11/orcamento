import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CabecalhoTela } from '@/lib/ui'
import { Icone } from '@/lib/icones'
import { comAtraso, ouvirOrcamento } from '@/lib/eventos'
import { formatar } from '@/lib/dinheiro'
import { mapaDeMembros, nomeDoMembro } from '@/lib/membros'
import type { ContextoOrcamento, Especie, Lancamento } from '@/lib/tipos'
import { buscarLancamentos, type FiltroBusca } from './busca.queries'
import { ativarPush, desativarPush, estadoPush, type EstadoPush } from '../notificacoes/push'

export type Props = ContextoOrcamento

const POR_PAGINA = 50

const inputCls =
  'w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 dark:border-gray-800 dark:bg-gray-950 dark:text-white dark:focus:border-blue-400'
const rotuloCls = 'mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400'

/** Espera o usuário parar de digitar: cada tecla não vira uma requisição. */
function useAdiado<T>(valor: T, ms = 300): T {
  const [v, setV] = useState(valor)
  useEffect(() => {
    const t = setTimeout(() => setV(valor), ms)
    return () => clearTimeout(t)
  }, [valor, ms])
  return v
}

const ddmm = (dia: string) => {
  const [a, m, d] = dia.split('-')
  return `${d}/${m}/${a?.slice(2)}`
}

export function Busca({ orcamento, usuarioId, membros, categorias, ocultar }: Props) {
  const ledgerId = orcamento.id
  const [texto, setTexto] = useState('')
  const [categoria, setCategoria] = useState('')
  const [membro, setMembro] = useState('')
  const [kind, setKind] = useState<'' | Especie>('')
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [abertos, setAbertos] = useState(false)

  const q = useAdiado(texto.trim())
  const filtro = useMemo<FiltroBusca>(
    () => ({
      q: q || undefined,
      category_id: categoria || undefined,
      membro: membro || undefined,
      kind: kind || undefined,
      de: de || undefined,
      ate: ate || undefined,
      limite: POR_PAGINA,
    }),
    [q, categoria, membro, kind, de, ate],
  )

  const [itens, setItens] = useState<Lancamento[]>([])
  const [proximo, setProximo] = useState<string | null>(null)
  const [totais, setTotais] = useState({ entrou: 0, saiu: 0 })
  const [carregando, setCarregando] = useState(true)
  const [carregandoMais, setCarregandoMais] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  // descarta resposta de um filtro velho que chegou depois da do novo
  const geracao = useRef(0)

  const recarregar = useCallback(async () => {
    const minha = ++geracao.current
    try {
      const r = await buscarLancamentos(ledgerId, filtro)
      if (minha !== geracao.current) return
      setItens(Array.isArray(r?.itens) ? r.itens : [])
      setProximo(r?.proximo ?? null)
      setTotais({ entrou: r?.entrou_cents ?? 0, saiu: r?.saiu_cents ?? 0 })
      setErro(null)
    } catch (e) {
      if (minha === geracao.current) setErro(e instanceof Error ? e.message : 'Falhou ao buscar.')
    } finally {
      if (minha === geracao.current) setCarregando(false)
    }
  }, [ledgerId, filtro])

  useEffect(() => {
    setCarregando(true)
    void recarregar()
  }, [recarregar])

  useEffect(() => {
    const releitura = comAtraso(() => void recarregar())
    const parar = ouvirOrcamento(ledgerId, (tipo) => {
      if (tipo === 'lancamentos') releitura.chamar()
    })
    return () => {
      parar()
      releitura.cancelar()
    }
  }, [ledgerId, recarregar])

  async function carregarMais() {
    if (!proximo || carregandoMais) return
    setCarregandoMais(true)
    const minha = geracao.current
    try {
      const r = await buscarLancamentos(ledgerId, { ...filtro, cursor: proximo })
      if (minha !== geracao.current) return
      setItens((atual) => {
        const vistos = new Set(atual.map((e) => e.id))
        return [...atual, ...(r.itens ?? []).filter((e) => !vistos.has(e.id))]
      })
      setProximo(r.proximo ?? null)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falhou ao carregar mais.')
    } finally {
      setCarregandoMais(false)
    }
  }

  const porMembro = useMemo(() => mapaDeMembros(membros), [membros])
  const porCategoria = useMemo(() => new Map(categorias.map((c) => [c.id, c])), [categorias])
  const categoriasDoTipo = useMemo(
    () => (kind ? categorias.filter((c) => c.kind === kind) : categorias),
    [categorias, kind],
  )
  const dinheiro = (c: number) => (ocultar ? 'R$ ••••' : formatar(c))
  const qtdFiltros = [categoria, membro, kind, de, ate].filter(Boolean).length

  function limpar() {
    setTexto('')
    setCategoria('')
    setMembro('')
    setKind('')
    setDe('')
    setAte('')
  }

  return (
    <div>
      <CabecalhoTela titulo="Busca" subtitulo="Ache qualquer lançamento do orçamento" />

      <div className="mb-3 flex gap-2">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            <Icone n="search" className="h-4 w-4" />
          </span>
          <input
            type="search"
            value={texto}
            maxLength={100}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Buscar na descrição"
            aria-label="Buscar na descrição"
            className={`${inputCls} pl-9`}
          />
        </div>
        <button
          onClick={() => setAbertos((a) => !a)}
          aria-expanded={abertos}
          className="shrink-0 rounded-md border border-gray-200 px-3 text-sm text-gray-600 transition-colors hover:bg-gray-100 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          Filtros{qtdFiltros ? ` (${qtdFiltros})` : ''}
        </button>
      </div>

      {abertos && (
        <div className="mb-3 grid grid-cols-2 gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900 sm:grid-cols-3">
          <label>
            <span className={rotuloCls}>Tipo</span>
            <select
              value={kind}
              onChange={(e) => {
                setKind(e.target.value as '' | Especie)
                setCategoria('')
              }}
              className={inputCls}
            >
              <option value="">todos</option>
              <option value="expense">saídas</option>
              <option value="income">entradas</option>
            </select>
          </label>
          <label>
            <span className={rotuloCls}>Categoria</span>
            <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className={inputCls}>
              <option value="">todas</option>
              {categoriasDoTipo.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji ? `${c.emoji} ` : ''}
                  {c.nome}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={rotuloCls}>De quem</span>
            <select value={membro} onChange={(e) => setMembro(e.target.value)} className={inputCls}>
              <option value="">todos</option>
              <option value="eu">eu</option>
              {membros
                .filter((m) => m.user_id !== usuarioId)
                .map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {nomeDoMembro(m)}
                  </option>
                ))}
            </select>
          </label>
          <label>
            <span className={rotuloCls}>De</span>
            <input type="date" value={de} onChange={(e) => setDe(e.target.value)} className={inputCls} />
          </label>
          <label>
            <span className={rotuloCls}>Até</span>
            <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className={inputCls} />
          </label>
          <div className="flex items-end">
            <button
              onClick={limpar}
              className="w-full rounded-md py-2 text-sm font-medium text-blue-600 transition-colors hover:bg-gray-100 dark:text-blue-400 dark:hover:bg-gray-800"
            >
              Limpar
            </button>
          </div>
        </div>
      )}

      {erro && (
        <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
          {erro}
        </p>
      )}

      <div className="mb-3 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Entrou</p>
          <p className="font-semibold text-emerald-600 dark:text-emerald-400">{dinheiro(totais.entrou)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Saiu</p>
          <p className="font-semibold text-red-600 dark:text-red-400">{dinheiro(totais.saiu)}</p>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-2 dark:border-gray-800 dark:bg-gray-900 sm:p-3">
        {carregando ? (
          <p className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">carregando…</p>
        ) : itens.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-400 dark:text-gray-500">Nenhum lançamento encontrado</p>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-gray-800">
            {itens.map((e) => {
              const cat = e.category_id ? porCategoria.get(e.category_id) : undefined
              const dono = nomeDoMembro(porMembro.get(e.paid_by ?? e.created_by), usuarioId)
              return (
                <li key={e.id} className="flex items-center gap-3 px-2 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-gray-800 dark:text-gray-200">
                      {e.descricao || cat?.nome || (e.kind === 'income' ? 'Entrada' : 'Saída')}
                    </p>
                    <p className="truncate text-[11px] text-gray-400 dark:text-gray-500">
                      {ddmm(e.occurred_on)}
                      {cat ? ` · ${cat.emoji ? `${cat.emoji} ` : ''}${cat.nome}` : ''} · {dono}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-sm font-medium tabular-nums ${
                      e.kind === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-900 dark:text-white'
                    }`}
                  >
                    {e.kind === 'income' ? '+' : '−'}
                    {dinheiro(e.amount_cents)}
                  </span>
                </li>
              )
            })}
          </ul>
        )}

        {proximo && !carregando && (
          <button
            onClick={() => void carregarMais()}
            disabled={carregandoMais}
            className="mt-2 w-full rounded-md py-2 text-sm font-medium text-blue-600 transition-colors hover:bg-gray-100 disabled:opacity-50 dark:text-blue-400 dark:hover:bg-gray-800"
          >
            {carregandoMais ? 'Carregando…' : 'Carregar mais'}
          </button>
        )}
      </div>

      <AvisosDeMeta />
    </div>
  )
}

const TEXTO_ESTADO: Record<EstadoPush, string> = {
  'sem-suporte': 'Este navegador não recebe avisos (no iPhone, instale o app na tela inicial).',
  'desligado-servidor': 'Avisos indisponíveis no servidor.',
  bloqueado: 'Notificações bloqueadas nas configurações do navegador.',
  inativo: 'Receba um aviso quando uma categoria chegar a 80% ou estourar a meta.',
  ativo: 'Avisos de meta ligados neste aparelho.',
}

/** Liga/desliga o push de meta. Exportado porque o Perfil mostra o mesmo cartão. */
export function AvisosDeMeta() {
  const [estado, setEstado] = useState<EstadoPush | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    estadoPush()
      .then((s) => vivo && setEstado(s))
      .catch(() => vivo && setEstado('desligado-servidor'))
    return () => {
      vivo = false
    }
  }, [])

  async function alternar() {
    setOcupado(true)
    setErro(null)
    try {
      setEstado(estado === 'ativo' ? await desativarPush() : await ativarPush())
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu pra mudar os avisos.')
    } finally {
      setOcupado(false)
    }
  }

  if (!estado) return null
  const podeAlternar = estado === 'ativo' || estado === 'inativo'
  return (
    <div className="mt-4 flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 dark:border-gray-800 dark:bg-gray-900">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
        <Icone n="bell" className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Avisos de meta</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{erro ?? TEXTO_ESTADO[estado]}</p>
      </div>
      {podeAlternar && (
        <button
          onClick={() => void alternar()}
          disabled={ocupado}
          className="shrink-0 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {estado === 'ativo' ? 'Desligar' : 'Ativar avisos'}
        </button>
      )}
    </div>
  )
}
