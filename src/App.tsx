import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSessao } from '@/features/auth/useSessao'
import { Login } from '@/features/auth/Login'
import { Dashboard } from '@/features/mes/Dashboard'
import { buscarCategorias } from '@/features/lancamentos/lancamentos.queries'
import { Comecar } from '@/features/orcamentos/Comecar'
import { ConfigOrcamento } from '@/features/orcamentos/ConfigOrcamento'
import { Seletor } from '@/features/orcamentos/Seletor'
import { membrosDo, meusOrcamentos } from '@/features/orcamentos/orcamentos.queries'
import { Historico } from '@/features/historico/Historico'
import { Metas } from '@/features/metas/Metas'
import { Analises } from '@/features/analises/Analises'
import { Perfil } from '@/features/perfil/Perfil'
import { Acerto } from '@/features/acerto/Acerto'
import { Recorrentes } from '@/features/recorrentes/Recorrentes'
import { Busca } from '@/features/busca/Busca'
import { aoMudarFila, ligarDrenagemAutomatica } from '@/lib/fila'
import { api, avisarSessao, sair, type Usuario } from '@/lib/api'
import { ouvirOrcamento } from '@/lib/eventos'
import { mapaDeMembros } from '@/lib/membros'
import { alternarTema, temaAtual, type Tema } from '@/lib/tema'
import { Icone, type NomeIcone } from '@/lib/icones'
import type { Categoria, ContextoOrcamento, LancamentoNovo, Membro, Orcamento } from '@/lib/tipos'

// Qual orçamento estava aberto da última vez. Conveniência por aparelho:
// se sumir, o app cai no primeiro da lista. Nada aqui é fonte da verdade.
const ULTIMO = 'orcamento:ultimo'
const OCULTAR = 'orcamento:ocultar'

type Vista =
  | 'dashboard'
  | 'historico'
  | 'busca'
  | 'metas'
  | 'analises'
  | 'acerto'
  | 'recorrentes'
  | 'config'
  | 'perfil'

// Ordem do menu. Cada vista é uma tela num arquivo próprio (dono em
// orcamento-api/docs/CONTRATO.md); o App só escolhe qual montar.
const MENU: { id: Vista; rotulo: string; icone: NomeIcone }[] = [
  { id: 'dashboard', rotulo: 'Orçamento', icone: 'grid' },
  { id: 'historico', rotulo: 'Histórico', icone: 'history' },
  { id: 'busca', rotulo: 'Busca', icone: 'search' },
  { id: 'metas', rotulo: 'Metas', icone: 'target' },
  { id: 'analises', rotulo: 'Análises', icone: 'pieChart' },
  { id: 'acerto', rotulo: 'Acerto de contas', icone: 'scale' },
  { id: 'recorrentes', rotulo: 'Recorrentes', icone: 'repeat' },
  { id: 'config', rotulo: 'Configurações', icone: 'settings' },
  { id: 'perfil', rotulo: 'Perfil', icone: 'user' },
]

function lerLocal(chave: string): string | null {
  try {
    return localStorage.getItem(chave)
  } catch {
    return null
  }
}
function gravarLocal(chave: string, valor: string): void {
  try {
    localStorage.setItem(chave, valor)
  } catch {
    /* segue na sessão */
  }
}

export function App() {
  const { sessao, carregando, usuarioId } = useSessao()

  const [orcamentos, setOrcamentos] = useState<Orcamento[] | null>(null)
  const [atualId, setAtualId] = useState<string | null>(null)
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [membros, setMembros] = useState<Membro[]>([])
  const [pendentes, setPendentes] = useState<LancamentoNovo[]>([])
  const [vista, setVista] = useState<Vista>('dashboard')
  const [menuAberto, setMenuAberto] = useState(false)
  const [erroLista, setErroLista] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [tema, setTema] = useState<Tema>(temaAtual())
  const [ocultar, setOcultar] = useState<boolean>(() => lerLocal(OCULTAR) === '1')

  useEffect(() => ligarDrenagemAutomatica(), [])
  useEffect(() => aoMudarFila(setPendentes), [])

  const carregarOrcamentos = useCallback(async () => {
    try {
      const lista = await meusOrcamentos()
      setOrcamentos(lista)
      setErroLista(null)
      setAtualId((atual) => {
        if (atual && lista.some((o) => o.id === atual)) return atual
        const salvo = lerLocal(ULTIMO)
        if (salvo && lista.some((o) => o.id === salvo)) return salvo
        return lista[0]?.id ?? null
      })
    } catch (e) {
      setErroLista(e instanceof Error ? e.message : 'Falhou ao carregar seus orçamentos.')
    }
  }, [])

  useEffect(() => {
    if (!usuarioId) return
    void carregarOrcamentos()
  }, [usuarioId, carregarOrcamentos])

  // Resposta atrasada de um orçamento que já foi trocado é descartada.
  const atualRef = useRef(atualId)
  atualRef.current = atualId

  const carregarCategorias = useCallback((id: string) => {
    return buscarCategorias(id)
      .then((c) => {
        if (atualRef.current === id) setCategorias(c)
      })
      .catch((e: Error) => {
        if (atualRef.current === id) setErro(e.message)
      })
  }, [])

  const carregarMembros = useCallback((id: string) => {
    return membrosDo(id)
      .then((m) => {
        if (atualRef.current === id) setMembros(m)
      })
      .catch(() => {
        /* offline: fica a lista que já tinha */
      })
  }, [])

  // Trocar de orçamento é só estado: limpa o que era do anterior e relê.
  useEffect(() => {
    if (!atualId) return
    gravarLocal(ULTIMO, atualId)
    setCategorias([])
    setMembros([])
    setErro(null)
    void carregarCategorias(atualId)
    void carregarMembros(atualId)
  }, [atualId, carregarCategorias, carregarMembros])

  // Tempo real do que o App guarda (as telas ouvem o resto por conta própria).
  useEffect(() => {
    if (!atualId) return
    return ouvirOrcamento(atualId, (tipo) => {
      if (tipo === 'membros') void carregarMembros(atualId)
      else if (tipo === 'categorias') void carregarCategorias(atualId)
      else if (tipo === 'orcamento') void carregarOrcamentos()
    })
  }, [atualId, carregarCategorias, carregarMembros, carregarOrcamentos])

  const recarregarOrcamentoAtual = useCallback(() => {
    void carregarOrcamentos()
    if (atualId) {
      void carregarCategorias(atualId)
      void carregarMembros(atualId)
    }
  }, [atualId, carregarCategorias, carregarMembros, carregarOrcamentos])

  const trocarOrcamento = useCallback((id: string) => {
    setAtualId(id)
    setMenuAberto(false)
  }, [])

  const entrouEm = useCallback(
    async (id: string) => {
      setAtualId(id)
      setVista('dashboard')
      await carregarOrcamentos()
    },
    [carregarOrcamentos],
  )

  const saiuDoAtual = useCallback(() => {
    setAtualId(null)
    setVista('dashboard')
    void carregarOrcamentos()
  }, [carregarOrcamentos])

  const atualizarUsuario = useCallback(() => {
    api
      .get<Usuario>('/auth/eu')
      .then(avisarSessao)
      .catch(() => {})
    if (atualId) void carregarMembros(atualId)
  }, [atualId, carregarMembros])

  const mapaMembros = useMemo(() => mapaDeMembros(membros), [membros])

  function trocarTema() {
    setTema(alternarTema())
  }
  function mudarTema(t: Tema) {
    if (t !== temaAtual()) setTema(alternarTema())
  }
  function trocarOcultar() {
    setOcultar((v) => {
      gravarLocal(OCULTAR, v ? '0' : '1')
      return !v
    })
  }
  function irPara(v: Vista) {
    setVista(v)
    setMenuAberto(false)
  }

  if (carregando) return <Tela>carregando…</Tela>
  if (!sessao || !usuarioId) return <Login />

  if (orcamentos === null) {
    return erroLista ? (
      <Tela>
        <p className="mb-6 text-red-500 dark:text-red-400">{erroLista}</p>
        <button onClick={() => void carregarOrcamentos()} className="mb-3 text-sm font-medium underline">
          Tentar de novo
        </button>
        <button onClick={() => void sair()} className="text-sm text-gray-400 underline">
          Sair
        </button>
      </Tela>
    ) : (
      <Tela>carregando…</Tela>
    )
  }

  // Ninguém tem orçamento no primeiro acesso — nem quem foi convidado.
  if (orcamentos.length === 0) return <Comecar aoEntrar={entrouEm} />

  const atual = orcamentos.find((o) => o.id === atualId) ?? orcamentos[0]!

  const ctx: ContextoOrcamento = { orcamento: atual, usuarioId, membros, categorias, ocultar }

  const seletor = (
    <Seletor orcamentos={orcamentos} atualId={atual.id} aoTrocar={trocarOrcamento} aoEntrarEmNovo={entrouEm} />
  )

  const itensMenu = MENU.map((m) => (
    <ItemNav key={m.id} ativo={vista === m.id} icone={m.icone} rotulo={m.rotulo} aoClicar={() => irPara(m.id)} />
  ))

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
      <ItemNav ativo={false} icone="logOut" rotulo="Sair" aoClicar={() => void sair()} />
    </>
  )

  function conteudo() {
    switch (vista) {
      case 'historico':
        return <Historico {...ctx} />
      case 'busca':
        return <Busca {...ctx} />
      case 'metas':
        return <Metas {...ctx} />
      case 'analises':
        return <Analises {...ctx} />
      case 'acerto':
        return <Acerto {...ctx} aoMudar={recarregarOrcamentoAtual} />
      case 'recorrentes':
        return <Recorrentes {...ctx} />
      case 'config':
        return <ConfigOrcamento {...ctx} aoMudar={recarregarOrcamentoAtual} aoSair={saiuDoAtual} />
      case 'perfil':
        return (
          <Perfil usuario={sessao!} tema={tema} aoMudarTema={mudarTema} aoAtualizar={atualizarUsuario} />
        )
      case 'dashboard':
        return categorias.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-400 dark:text-gray-500">carregando categorias…</p>
        ) : (
          <Dashboard
            ledgerId={atual.id}
            categorias={categorias}
            usuarioId={usuarioId!}
            ocultar={ocultar}
            membros={mapaMembros}
          />
        )
    }
  }

  return (
    <div className="min-h-[100dvh] bg-white text-gray-900 dark:bg-gray-950 dark:text-white">
      {/* sidebar (desktop) */}
      <aside className="fixed bottom-0 left-0 top-0 z-40 hidden w-56 flex-col border-r border-gray-200 bg-gray-50/80 backdrop-blur dark:border-gray-800 dark:bg-gray-900/80 lg:flex">
        <div className="flex h-14 items-center border-b border-gray-200 px-5 dark:border-gray-800">{seletor}</div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="mb-2 px-2 text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
            Menu
          </div>
          <ul className="space-y-1">{itensMenu}</ul>
        </nav>
        <div className="border-t border-gray-200 px-3 py-3 dark:border-gray-800">
          <ul className="space-y-1">{acoes}</ul>
        </div>
      </aside>

      {/* top bar (mobile) */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-gray-200 bg-white/90 px-4 backdrop-blur dark:border-gray-800 dark:bg-gray-950/90 lg:hidden">
        <div className="min-w-0 max-w-[60%] flex-1">{seletor}</div>
        <div className="flex items-center gap-1">
          <BotaoIcone icone={ocultar ? 'eye' : 'eyeOff'} ativo={false} aoClicar={trocarOcultar} rotulo="Ocultar valores" />
          <BotaoIcone icone="menu" ativo={menuAberto} aoClicar={() => setMenuAberto(true)} rotulo="Menu" />
        </div>
      </header>

      {/* gaveta (mobile): 9 telas não cabem numa barra de ícones */}
      {menuAberto && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <button
            aria-label="Fechar menu"
            onClick={() => setMenuAberto(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="absolute bottom-0 right-0 top-0 flex w-72 max-w-[85%] flex-col bg-gray-50 dark:bg-gray-900">
            <div className="flex h-14 items-center justify-between border-b border-gray-200 px-4 dark:border-gray-800">
              <span className="truncate text-sm font-semibold">{atual.nome}</span>
              <BotaoIcone icone="x" ativo={false} aoClicar={() => setMenuAberto(false)} rotulo="Fechar" />
            </div>
            <nav className="flex-1 overflow-y-auto px-3 py-4">
              <ul className="space-y-1">{itensMenu}</ul>
            </nav>
            <div className="border-t border-gray-200 px-3 py-3 dark:border-gray-800">
              <ul className="space-y-1">{acoes}</ul>
            </div>
          </div>
        </div>
      )}

      {/* conteúdo */}
      <main className="lg:pl-56">
        {pendentes.length > 0 && (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-center text-xs text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400">
            {pendentes.length} lançamento{pendentes.length > 1 ? 's' : ''} aguardando rede
          </div>
        )}
        {erro && (
          <div className="border-b border-red-200 bg-red-50 px-4 py-1.5 text-center text-xs text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
            {erro}{' '}
            <button onClick={recarregarOrcamentoAtual} className="font-medium underline">
              tentar de novo
            </button>
          </div>
        )}
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">{conteudo()}</div>
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
  icone: NomeIcone
  rotulo: string
  aoClicar: () => void
}) {
  return (
    <li>
      <button
        onClick={aoClicar}
        aria-current={ativo ? 'page' : undefined}
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
  icone: NomeIcone
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
