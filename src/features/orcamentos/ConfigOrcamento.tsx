import { useCallback, useEffect, useMemo, useState } from 'react'
import { CabecalhoTela } from '@/lib/ui'
import { ouvirOrcamento } from '@/lib/eventos'
import { nomeDoMembro } from '@/lib/membros'
import type { Categoria, ContextoOrcamento, Convite, Especie } from '@/lib/tipos'
import {
  arquivarCategoria,
  cancelarConvite,
  convitesPendentes,
  criarCategoria,
  criarConvite,
  editarCategoria,
  formatarCodigo,
  mudarMeuApelido,
  removerMembro,
  renomearOrcamento,
  reordenarCategorias,
  todasCategorias,
} from './orcamentos.queries'

export type Props = ContextoOrcamento & {
  /** nome/membros/categorias mudaram: o App relê tudo do orçamento */
  aoMudar: () => void
  /** você saiu (ou foi removido) deste orçamento: o App troca pra outro */
  aoSair: () => void
}

const campo =
  'w-full min-w-0 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-primaria dark:border-gray-800 dark:bg-gray-900 dark:text-white'
const botao = 'rounded-lg bg-primaria px-3 py-2 text-sm font-semibold text-white disabled:opacity-50'
const secao = 'mb-8'
const tituloSecao = 'mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500'
const cartao = 'rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900'

function msg(e: unknown, padrao: string) {
  return e instanceof Error ? e.message : padrao
}

// As props são fixadas pelo App.tsx (fundação): não mude a assinatura.
export function ConfigOrcamento({ orcamento, usuarioId, membros, aoMudar, aoSair }: Props) {
  const [erro, setErro] = useState<string | null>(null)

  /** Toda ação passa por aqui: erro na tela em vez de promessa solta. */
  const agir = useCallback(async (fn: () => Promise<unknown>, padrao = 'Não deu certo.') => {
    setErro(null)
    try {
      await fn()
      return true
    } catch (e) {
      setErro(msg(e, padrao))
      return false
    }
  }, [])

  return (
    <div className="mx-auto max-w-xl">
      <CabecalhoTela titulo="Configurações" subtitulo={orcamento.nome} />
      {erro && (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-saida dark:bg-red-950/40">
          {erro}
        </p>
      )}
      <SecaoNome key={orcamento.id + orcamento.nome} {...{ orcamento, usuarioId, membros, agir, aoMudar }} />
      <SecaoMembros {...{ orcamento, usuarioId, membros, agir, aoMudar, aoSair }} />
      <SecaoCategorias ledgerId={orcamento.id} agir={agir} aoMudar={aoMudar} />
    </div>
  )
}

type Agir = (fn: () => Promise<unknown>, padrao?: string) => Promise<boolean>

// --- nome + meu apelido --------------------------------------------------------

function SecaoNome({
  orcamento,
  usuarioId,
  membros,
  agir,
  aoMudar,
}: Pick<Props, 'orcamento' | 'usuarioId' | 'membros' | 'aoMudar'> & { agir: Agir }) {
  const eu = membros.find((m) => m.user_id === usuarioId)
  const [nome, setNome] = useState(orcamento.nome)
  const [apelido, setApelido] = useState(eu?.apelido ?? '')
  const [salvando, setSalvando] = useState(false)

  // Membros chegam depois do primeiro render em alguns casos; sincroniza o campo.
  useEffect(() => setApelido(eu?.apelido ?? ''), [eu?.apelido])

  const mudou = nome.trim() !== orcamento.nome || (apelido.trim() || null) !== (eu?.apelido ?? null)

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    const ok = await agir(async () => {
      if (nome.trim() !== orcamento.nome) await renomearOrcamento(orcamento.id, nome.trim())
      if ((apelido.trim() || null) !== (eu?.apelido ?? null)) await mudarMeuApelido(orcamento.id, apelido.trim() || null)
    })
    setSalvando(false)
    if (ok) aoMudar()
  }

  return (
    <form onSubmit={salvar} className={secao}>
      <h3 className={tituloSecao}>Orçamento</h3>
      <div className={`${cartao} flex flex-col gap-3 p-3`}>
        <label className="flex flex-col gap-1 text-xs text-gray-500 dark:text-gray-400">
          Nome
          <input required maxLength={80} value={nome} onChange={(e) => setNome(e.target.value)} className={campo} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-500 dark:text-gray-400">
          Como você aparece aqui (apelido)
          <input
            maxLength={40}
            value={apelido}
            onChange={(e) => setApelido(e.target.value)}
            placeholder={eu?.nome || eu?.email.split('@')[0] || ''}
            className={campo}
          />
        </label>
        <button type="submit" disabled={!mudou || salvando || !nome.trim()} className={`${botao} self-end`}>
          {salvando ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
    </form>
  )
}

// --- membros + convites --------------------------------------------------------

function SecaoMembros({
  orcamento,
  usuarioId,
  membros,
  agir,
  aoMudar,
  aoSair,
}: Pick<Props, 'orcamento' | 'usuarioId' | 'membros' | 'aoMudar' | 'aoSair'> & { agir: Agir }) {
  const [convites, setConvites] = useState<Convite[]>([])
  const [confirmando, setConfirmando] = useState<string | null>(null)
  const [gerando, setGerando] = useState(false)
  const [copiado, setCopiado] = useState<string | null>(null)

  const recarregar = useCallback(async () => {
    try {
      setConvites(await convitesPendentes(orcamento.id))
    } catch {
      // lista de convite é acessória: sem ela a tela continua útil
    }
  }, [orcamento.id])

  useEffect(() => {
    void recarregar()
  }, [recarregar])

  // Convite aceito em outro aparelho some da lista de pendentes sem F5.
  useEffect(
    () =>
      ouvirOrcamento(orcamento.id, (tipo) => {
        if (tipo === 'membros') void recarregar()
      }),
    [orcamento.id, recarregar],
  )

  async function remover(userId: string) {
    setConfirmando(null)
    const ok = await agir(() => removerMembro(orcamento.id, userId), 'Não consegui remover.')
    if (!ok) return
    if (userId === usuarioId) aoSair()
    else aoMudar()
  }

  async function gerar() {
    setGerando(true)
    await agir(async () => {
      await criarConvite(orcamento.id)
      await recarregar()
    }, 'Não consegui gerar o código.')
    setGerando(false)
  }

  async function copiar(code: string) {
    try {
      await navigator.clipboard.writeText(formatarCodigo(code))
      setCopiado(code)
      setTimeout(() => setCopiado(null), 2000)
    } catch {
      // clipboard bloqueada: o código está na tela, dá pra ler.
    }
  }

  return (
    <section className={secao}>
      <h3 className={tituloSecao}>Membros</h3>
      <ul className={`${cartao} mb-3 divide-y divide-gray-100 dark:divide-gray-800`}>
        {membros.map((m) => {
          const souEu = m.user_id === usuarioId
          return (
            <li key={m.user_id} className="flex items-center gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-gray-900 dark:text-white">{nomeDoMembro(m, usuarioId)}</p>
                <p className="truncate text-xs text-gray-400 dark:text-gray-500">{m.email}</p>
              </div>
              {confirmando === m.user_id ? (
                <span className="flex shrink-0 gap-2 text-xs">
                  <button onClick={() => void remover(m.user_id)} className="font-semibold text-saida">
                    {souEu ? 'sair mesmo' : 'remover'}
                  </button>
                  <button onClick={() => setConfirmando(null)} className="text-gray-400">
                    cancelar
                  </button>
                </span>
              ) : (
                <button onClick={() => setConfirmando(m.user_id)} className="shrink-0 text-xs text-gray-400 hover:text-saida">
                  {souEu ? 'sair' : 'remover'}
                </button>
              )}
            </li>
          )
        })}
      </ul>

      {convites.length > 0 && (
        <ul className="mb-3 flex flex-col gap-2">
          {convites.map((c) => (
            <li key={c.code} className={`${cartao} p-3`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <code className="text-lg tracking-[0.2em] text-gray-900 dark:text-white">{formatarCodigo(c.code)}</code>
                <div className="flex gap-3 text-xs">
                  <button onClick={() => void copiar(c.code)} className="text-gray-500 underline">
                    {copiado === c.code ? 'copiado' : 'copiar'}
                  </button>
                  <button
                    onClick={() =>
                      void agir(async () => {
                        await cancelarConvite(c.code)
                        await recarregar()
                      })
                    }
                    className="text-saida underline"
                  >
                    cancelar
                  </button>
                </div>
              </div>
              <p className="mt-1 text-xs text-gray-400">
                vence em {new Date(c.expires_at).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}
              </p>
            </li>
          ))}
        </ul>
      )}
      <button onClick={() => void gerar()} disabled={gerando} className={`${botao} w-full`}>
        {gerando ? 'Gerando…' : 'Convidar alguém'}
      </button>
      <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
        A pessoa entra no app, escolhe “Tenho um código” e cola. Vale 7 dias e serve uma vez só.
      </p>
    </section>
  )
}

// --- categorias ----------------------------------------------------------------

function SecaoCategorias({ ledgerId, agir, aoMudar }: { ledgerId: string; agir: Agir; aoMudar: () => void }) {
  const [lista, setLista] = useState<Categoria[] | null>(null)
  const [kind, setKind] = useState<Especie>('expense')
  const [editando, setEditando] = useState<string | 'nova' | null>(null)
  const [verArquivadas, setVerArquivadas] = useState(false)

  const recarregar = useCallback(async () => {
    try {
      setLista(await todasCategorias(ledgerId))
    } catch {
      setLista((l) => l ?? [])
    }
  }, [ledgerId])

  useEffect(() => {
    void recarregar()
  }, [recarregar])

  useEffect(
    () =>
      ouvirOrcamento(ledgerId, (tipo) => {
        if (tipo === 'categorias') void recarregar()
      }),
    [ledgerId, recarregar],
  )

  const ativas = useMemo(
    () => (lista ?? []).filter((c) => c.kind === kind && !c.archived_at).sort((a, b) => a.ordem - b.ordem),
    [lista, kind],
  )
  const arquivadas = useMemo(() => (lista ?? []).filter((c) => c.kind === kind && c.archived_at), [lista, kind])

  async function depois(fn: () => Promise<unknown>) {
    const ok = await agir(fn)
    if (ok) {
      await recarregar()
      aoMudar()
    }
    return ok
  }

  function mover(i: number, delta: -1 | 1) {
    const ids = ativas.map((c) => c.id)
    const j = i + delta
    if (j < 0 || j >= ids.length) return
    ;[ids[i], ids[j]] = [ids[j]!, ids[i]!]
    // Otimista: a seta responde na hora; o servidor confirma em seguida.
    setLista((l) => l && l.map((c) => (ids.includes(c.id) ? { ...c, ordem: (ids.indexOf(c.id) + 1) * 10 } : c)))
    void depois(() => reordenarCategorias(ledgerId, ids))
  }

  return (
    <section className={secao}>
      <h3 className={tituloSecao}>Categorias</h3>
      <div className="mb-3 flex gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-800 dark:bg-gray-900">
        {(['expense', 'income'] as const).map((k) => (
          <button
            key={k}
            onClick={() => {
              setKind(k)
              setEditando(null)
            }}
            className={`flex-1 rounded-md py-1.5 text-sm font-semibold ${
              kind === k ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-white' : 'text-gray-400'
            }`}
          >
            {k === 'expense' ? 'Saídas' : 'Entradas'}
          </button>
        ))}
      </div>

      {lista === null ? (
        <p className="py-6 text-center text-sm text-gray-400">carregando…</p>
      ) : (
        <ul className={`${cartao} mb-3 divide-y divide-gray-100 dark:divide-gray-800`}>
          {ativas.map((c, i) =>
            editando === c.id ? (
              <li key={c.id} className="p-3">
                <FormCategoria
                  inicial={c}
                  aoCancelar={() => setEditando(null)}
                  aoSalvar={async (d) => {
                    if (await depois(() => editarCategoria(ledgerId, c.id, d))) setEditando(null)
                  }}
                />
              </li>
            ) : (
              <li key={c.id} className="flex items-center gap-2 px-3 py-2">
                <Bolinha c={c} />
                <span className="min-w-0 flex-1 truncate text-sm text-gray-900 dark:text-white">{c.nome}</span>
                <span className="flex shrink-0 items-center gap-1 text-xs text-gray-400">
                  <button aria-label={`subir ${c.nome}`} disabled={i === 0} onClick={() => mover(i, -1)} className="px-1.5 py-1 disabled:opacity-30">
                    ↑
                  </button>
                  <button
                    aria-label={`descer ${c.nome}`}
                    disabled={i === ativas.length - 1}
                    onClick={() => mover(i, 1)}
                    className="px-1.5 py-1 disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button onClick={() => setEditando(c.id)} className="px-1.5 py-1 hover:text-gray-700 dark:hover:text-gray-200">
                    editar
                  </button>
                  <button
                    onClick={() => void depois(() => arquivarCategoria(ledgerId, c.id, true))}
                    className="px-1.5 py-1 hover:text-saida"
                  >
                    arquivar
                  </button>
                </span>
              </li>
            ),
          )}
          {ativas.length === 0 && <li className="px-3 py-4 text-center text-sm text-gray-400">nenhuma categoria ativa</li>}
        </ul>
      )}

      {editando === 'nova' ? (
        <div className={`${cartao} mb-3 p-3`}>
          <FormCategoria
            aoCancelar={() => setEditando(null)}
            aoSalvar={async (d) => {
              if (await depois(() => criarCategoria(ledgerId, { ...d, kind }))) setEditando(null)
            }}
          />
        </div>
      ) : (
        <button onClick={() => setEditando('nova')} className={`${botao} mb-3 w-full`}>
          Nova categoria de {kind === 'expense' ? 'saída' : 'entrada'}
        </button>
      )}

      {arquivadas.length > 0 && (
        <div>
          <button onClick={() => setVerArquivadas((v) => !v)} className="text-xs text-gray-400 underline">
            {verArquivadas ? 'esconder' : 'ver'} arquivadas ({arquivadas.length})
          </button>
          {verArquivadas && (
            <ul className={`${cartao} mt-2 divide-y divide-gray-100 dark:divide-gray-800`}>
              {arquivadas.map((c) => (
                <li key={c.id} className="flex items-center gap-2 px-3 py-2 opacity-70">
                  <Bolinha c={c} />
                  <span className="min-w-0 flex-1 truncate text-sm text-gray-500">{c.nome}</span>
                  <button
                    onClick={() => void depois(() => arquivarCategoria(ledgerId, c.id, false))}
                    className="shrink-0 text-xs text-primaria"
                  >
                    desarquivar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}

function Bolinha({ c }: { c: Pick<Categoria, 'emoji' | 'cor'> }) {
  return (
    <span
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm dark:bg-gray-800"
      style={c.cor ? { backgroundColor: c.cor + '33', boxShadow: `inset 0 0 0 1.5px ${c.cor}` } : undefined}
    >
      {c.emoji || '•'}
    </span>
  )
}

type Dados = { nome: string; emoji: string | null; cor: string | null }

function FormCategoria({
  inicial,
  aoSalvar,
  aoCancelar,
}: {
  inicial?: Categoria
  aoSalvar: (d: Dados) => Promise<void>
  aoCancelar: () => void
}) {
  const [nome, setNome] = useState(inicial?.nome ?? '')
  const [emoji, setEmoji] = useState(inicial?.emoji ?? '')
  const [cor, setCor] = useState(inicial?.cor ?? '')
  const [ocupado, setOcupado] = useState(false)

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setOcupado(true)
    await aoSalvar({ nome: nome.trim(), emoji: emoji.trim() || null, cor: cor || null })
    setOcupado(false)
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          value={emoji}
          onChange={(e) => setEmoji(e.target.value)}
          maxLength={8}
          placeholder="🙂"
          aria-label="Emoji"
          className={`${campo} w-14 flex-none text-center`}
        />
        <input
          required
          autoFocus
          maxLength={40}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nome"
          aria-label="Nome da categoria"
          className={campo}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
        <label className="flex items-center gap-2">
          Cor
          <input
            type="color"
            value={cor || '#888888'}
            onChange={(e) => setCor(e.target.value)}
            className="h-7 w-10 cursor-pointer rounded border border-gray-200 bg-transparent dark:border-gray-700"
          />
        </label>
        {cor && (
          <button type="button" onClick={() => setCor('')} className="underline">
            sem cor
          </button>
        )}
        <span className="flex-1" />
        <button type="button" onClick={aoCancelar} className="px-2 py-2 text-gray-400">
          cancelar
        </button>
        <button type="submit" disabled={ocupado || !nome.trim()} className={botao}>
          {ocupado ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
    </form>
  )
}
