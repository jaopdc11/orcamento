import { useCallback, useEffect, useState } from 'react'
import { useSessao } from '@/features/auth/useSessao'
import { Login } from '@/features/auth/Login'
import { Dashboard } from '@/features/mes/Dashboard'
import { buscarCategorias } from '@/features/lancamentos/lancamentos.queries'
import { Comecar } from '@/features/orcamentos/Comecar'
import { Membros } from '@/features/orcamentos/Membros'
import { membrosDo, meusOrcamentos } from '@/features/orcamentos/orcamentos.queries'
import { aoMudarFila, ligarDrenagemAutomatica } from '@/lib/fila'
import { sair } from '@/lib/api'
import { alternarTema, temaAtual, type Tema } from '@/lib/tema'
import { Icone } from '@/lib/icones'
import type { Categoria, LancamentoNovo, Membro, Orcamento } from '@/lib/tipos'

// Qual orçamento estava aberto da última vez. Conveniência por aparelho:
// se sumir, o app cai no primeiro da lista. Nada aqui é fonte da verdade.
const ULTIMO = 'orcamento:ultimo'
const OCULTAR = 'orcamento:ocultar'

type Vista = 'dashboard' | 'membros' | 'entrar-em-outro'

export function App() {
  const { sessao, carregando, usuarioId } = useSessao()

  const [orcamentos, setOrcamentos] = useState<Orcamento[] | null>(null)
  const [atualId, setAtualId] = useState<string | null>(null)
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [, setMembros] = useState<Membro[]>([])
  const [pendentes, setPendentes] = useState<LancamentoNovo[]>([])
  const [vista, setVista] = useState<Vista>('dashboard')
  const [erro, setErro] = useState<string | null>(null)
  const [tema, setTema] = useState<Tema>(temaAtual())
  const [ocultar, setOcultar] = useState<boolean>(() => {
    try {
      return localStorage.getItem(OCULTAR) === '1'
    } catch {
      return false
    }
  })

  useEffect(() => ligarDrenagemAutomatica(), [])
  useEffect(() => aoMudarFila(setPendentes), [])

  const carregarOrcamentos = useCallback(async () => {
    try {
      const lista = await meusOrcamentos()
      setOrcamentos(lista)
      setAtualId((atual) => {
        if (atual && lista.some((o) => o.id === atual)) return atual
        const salvo = localStorage.getItem(ULTIMO)
        if (salvo && lista.some((o) => o.id === salvo)) return salvo
        return lista[0]?.id ?? null
      })
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falhou ao carregar seus orçamentos.')
    }
  }, [])

  useEffect(() => {
    if (!usuarioId) return
    void carregarOrcamentos()
  }, [usuarioId, carregarOrcamentos])

  useEffect(() => {
    if (!atualId) return
    localStorage.setItem(ULTIMO, atualId)
    buscarCategorias(atualId)
      .then(setCategorias)
      .catch((e: Error) => setErro(e.message))
    membrosDo(atualId).then(setMembros).catch(() => setMembros([]))
  }, [atualId])

  const entrouEm = useCallback(
    async (id: string) => {
      setAtualId(id)
      setVista('dashboard')
      await carregarOrcamentos()
    },
    [carregarOrcamentos],
  )

  function trocarTema() {
    setTema(alternarTema())
  }
  function trocarOcultar() {
    setOcultar((v) => {
      const novo = !v
      try {
        localStorage.setItem(OCULTAR, novo ? '1' : '0')
      } catch {
        /* segue na sessão */
      }
      return novo
    })
  }

  if (carregando) return <Tela>carregando…</Tela>
  if (!sessao || !usuarioId) return <Login />

  if (erro) {
    return (
      <Tela>
        <p className="mb-6 text-red-500 dark:text-red-400">{erro}</p>
        <button onClick={() => void sair()} className="text-sm underline">
          Sair
        </button>
      </Tela>
    )
  }

  if (orcamentos === null) return <Tela>carregando…</Tela>

  // Ninguém tem orçamento no primeiro acesso — nem quem foi convidado.
  if (orcamentos.length === 0 || vista === 'entrar-em-outro') {
    return (
      <Comecar
        aoEntrar={entrouEm}
        aoCancelar={orcamentos.length > 0 ? () => setVista('dashboard') : undefined}
      />
    )
  }

  const atual = orcamentos.find((o) => o.id === atualId) ?? orcamentos[0]

  const nav = (
    <>
      <ItemNav
        ativo={vista === 'dashboard'}
        icone="grid"
        rotulo="Orçamento"
        aoClicar={() => setVista('dashboard')}
      />
      <ItemNav
        ativo={vista === 'membros'}
        icone="users"
        rotulo="Membros"
        aoClicar={() => setVista('membros')}
      />
      <ItemNav
        ativo={false}
        icone="list"
        rotulo="Outro orçamento"
        aoClicar={() => setVista('entrar-em-outro')}
      />
    </>
  )

  const acoes = (
    <>
      <ItemNav
        ativo={false}
        icone={tema === 'escuro' ? 'sun' : 'moon'}
        rotulo={tema === 'escuro' ? 'Tema claro' : 'Tema escuro'}
        aoClicar={trocarTema}
      />
      <ItemNav
        ativo={false}
        icone={ocultar ? 'eye' : 'eyeOff'}
        rotulo={ocultar ? 'Mostrar valores' : 'Ocultar valores'}
        aoClicar={trocarOcultar}
      />
      <ItemNav
        ativo={false}
        icone="logOut"
        rotulo="Sair"
        aoClicar={() => void sair()}
      />
    </>
  )

  return (
    <div className="min-h-[100dvh] bg-white text-gray-900 dark:bg-gray-950 dark:text-white">
      {/* sidebar (desktop) */}
      <aside className="fixed bottom-0 left-0 top-0 z-40 hidden w-56 flex-col border-r border-gray-200 bg-gray-50/80 backdrop-blur dark:border-gray-800 dark:bg-gray-900/80 lg:flex">
        <div className="flex h-14 items-center justify-between gap-2 border-b border-gray-200 px-5 dark:border-gray-800">
          <span className="truncate text-base font-semibold tracking-tight text-gray-900 dark:text-white">
            {atual.nome}
          </span>
          {orcamentos.length > 1 && (
            <select
              value={atual.id}
              onChange={(e) => setAtualId(e.target.value)}
              className="max-w-[40%] shrink-0 bg-transparent text-xs text-gray-400 outline-none dark:text-gray-500"
              aria-label="Trocar de orçamento"
            >
              {orcamentos.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nome}
                </option>
              ))}
            </select>
          )}
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="mb-2 px-2 text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
            Menu
          </div>
          <ul className="space-y-1">{nav}</ul>
        </nav>
        <div className="border-t border-gray-200 px-3 py-3 dark:border-gray-800">
          <ul className="space-y-1">{acoes}</ul>
        </div>
      </aside>

      {/* top bar (mobile) */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-gray-200 bg-white/90 px-4 backdrop-blur dark:border-gray-800 dark:bg-gray-950/90 lg:hidden">
        {orcamentos.length > 1 ? (
          <select
            value={atual.id}
            onChange={(e) => setAtualId(e.target.value)}
            className="max-w-[50%] truncate bg-transparent text-base font-semibold outline-none"
          >
            {orcamentos.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nome}
              </option>
            ))}
          </select>
        ) : (
          <span className="truncate text-base font-semibold">{atual.nome}</span>
        )}
        <div className="flex items-center gap-1">
          <BotaoIcone icone="grid" ativo={vista === 'dashboard'} aoClicar={() => setVista('dashboard')} rotulo="Orçamento" />
          <BotaoIcone icone="users" ativo={vista === 'membros'} aoClicar={() => setVista('membros')} rotulo="Membros" />
          <BotaoIcone icone={tema === 'escuro' ? 'sun' : 'moon'} ativo={false} aoClicar={trocarTema} rotulo="Tema" />
          <BotaoIcone icone={ocultar ? 'eye' : 'eyeOff'} ativo={false} aoClicar={trocarOcultar} rotulo="Ocultar" />
          <BotaoIcone icone="logOut" ativo={false} aoClicar={() => void sair()} rotulo="Sair" />
        </div>
      </header>

      {/* conteúdo */}
      <main className="lg:pl-56">
        {pendentes.length > 0 && (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-center text-xs text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400">
            {pendentes.length} lançamento{pendentes.length > 1 ? 's' : ''} aguardando rede
          </div>
        )}
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          {vista === 'membros' ? (
            <Membros orcamento={atual} usuarioId={usuarioId} aoFechar={() => setVista('dashboard')} />
          ) : categorias.length === 0 ? (
            <p className="py-12 text-center text-sm text-gray-400 dark:text-gray-500">
              carregando categorias…
            </p>
          ) : (
            <Dashboard
              ledgerId={atual.id}
              categorias={categorias}
              usuarioId={usuarioId}
              ocultar={ocultar}
            />
          )}
        </div>
      </main>
    </div>
  )
}

function ItemNav({
  ativo,
  icone,
  rotulo,
  aoClicar,
}: {
  ativo: boolean
  icone: Parameters<typeof Icone>[0]['n']
  rotulo: string
  aoClicar: () => void
}) {
  return (
    <li>
      <button
        onClick={aoClicar}
        className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-all ${
          ativo
            ? 'bg-white font-medium text-gray-900 shadow-sm dark:bg-gray-800 dark:text-white'
            : 'text-gray-600 hover:bg-white/60 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800/60 dark:hover:text-white'
        }`}
      >
        <Icone n={icone} />
        {rotulo}
      </button>
    </li>
  )
}

function BotaoIcone({
  icone,
  ativo,
  rotulo,
  aoClicar,
}: {
  icone: Parameters<typeof Icone>[0]['n']
  ativo: boolean
  rotulo: string
  aoClicar: () => void
}) {
  return (
    <button
      onClick={aoClicar}
      aria-label={rotulo}
      title={rotulo}
      className={`rounded-md p-2 transition-colors ${
        ativo
          ? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white'
          : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white'
      }`}
    >
      <Icone n={icone} className="h-5 w-5" />
    </button>
  )
}

function Tela({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-white px-8 text-center text-gray-500 dark:bg-gray-950 dark:text-gray-400">
      {children}
    </div>
  )
}
