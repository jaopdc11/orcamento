import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSessao } from '@/features/auth/useSessao'
import { Login } from '@/features/auth/Login'
import { Dashboard } from '@/features/mes/Dashboard'
import { buscarCategorias } from '@/features/lancamentos/lancamentos.queries'
import { Comecar } from '@/features/orcamentos/Comecar'
import { ConfigOrcamento } from '@/features/orcamentos/ConfigOrcamento'
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
import { Inicio } from '@/features/inicio/Inicio'
import { Lancar } from '@/features/lancamentos/Lancar'
import { Aviso, Botao, EsqueletoLista, ProvedorToast, Sheet } from '@/design'
import { NavInferior } from '@/shell/NavInferior'
import { TopBar } from '@/shell/TopBar'
import { Sidebar } from '@/shell/Sidebar'
import { SeletorSheet } from '@/shell/SeletorSheet'
import { Mais } from '@/shell/Mais'
import { abaDe, type Vista } from '@/shell/navegacao'
import type { Categoria, ContextoOrcamento, LancamentoNovo, Membro, Orcamento } from '@/lib/tipos'

// Qual orçamento estava aberto da última vez. Conveniência por aparelho:
// se sumir, o app cai no primeiro da lista. Nada aqui é fonte da verdade.
const ULTIMO = 'orcamento:ultimo'
const OCULTAR = 'orcamento:ocultar'

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

// O provider do toast envolve tudo (inclusive login): qualquer tela pode confirmar.
export function App() {
  return (
    <ProvedorToast>
      <Raiz />
    </ProvedorToast>
  )
}

function Raiz() {
  const { sessao, carregando, usuarioId } = useSessao()

  const [orcamentos, setOrcamentos] = useState<Orcamento[] | null>(null)
  const [atualId, setAtualId] = useState<string | null>(null)
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [membros, setMembros] = useState<Membro[]>([])
  const [pendentes, setPendentes] = useState<LancamentoNovo[]>([])
  const [vista, setVista] = useState<Vista>('inicio')
  const [seletorAberto, setSeletorAberto] = useState(false)
  const [lancando, setLancando] = useState(false)
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
    setSeletorAberto(false)
  }, [])

  const entrouEm = useCallback(
    async (id: string) => {
      setAtualId(id)
      setVista('inicio')
      await carregarOrcamentos()
    },
    [carregarOrcamentos],
  )

  const saiuDoAtual = useCallback(() => {
    setAtualId(null)
    setVista('inicio')
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
    // troca de tela começa do topo, como em app nativo
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 })
  }

  if (carregando) return <Tela />
  if (!sessao || !usuarioId) return <Login />

  if (orcamentos === null) {
    return erroLista ? (
      <Tela>
        <Aviso className="mb-4 text-left">{erroLista}</Aviso>
        <div className="flex gap-2">
          <Botao variante="fantasma" onClick={() => void sair()}>
            Sair
          </Botao>
          <Botao onClick={() => void carregarOrcamentos()}>Tentar de novo</Botao>
        </div>
      </Tela>
    ) : (
      <Tela />
    )
  }

  // Ninguém tem orçamento no primeiro acesso — nem quem foi convidado.
  if (orcamentos.length === 0) return <Comecar aoEntrar={entrouEm} />

  const atual = orcamentos.find((o) => o.id === atualId) ?? orcamentos[0]!

  const ctx: ContextoOrcamento = { orcamento: atual, usuarioId, membros, categorias, ocultar }
  const emSubtela = abaDe(vista) === 'mais' && vista !== 'mais'

  function conteudo() {
    switch (vista) {
      case 'inicio':
        return <Inicio {...ctx} />
      case 'mais':
        return <Mais aoIr={irPara} tema={tema} aoTrocarTema={trocarTema} aoSair={() => void sair()} />
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
        return <Perfil usuario={sessao!} tema={tema} aoMudarTema={mudarTema} aoAtualizar={atualizarUsuario} />
      case 'mes':
        return categorias.length === 0 ? (
          <EsqueletoLista linhas={5} />
        ) : (
          <Dashboard ledgerId={atual.id} categorias={categorias} usuarioId={usuarioId!} ocultar={ocultar} membros={mapaMembros} />
        )
    }
  }

  return (
    <div className="min-h-[100dvh] bg-fundo text-texto">
      <Sidebar
        nome={atual.nome}
        vista={vista}
        aoIr={irPara}
        aoLancar={() => setLancando(true)}
        aoAbrirSeletor={() => setSeletorAberto(true)}
        ocultar={ocultar}
        aoTrocarOcultar={trocarOcultar}
        tema={tema}
        aoTrocarTema={trocarTema}
        aoSair={() => void sair()}
      />
      <TopBar
        nome={atual.nome}
        aoAbrirSeletor={() => setSeletorAberto(true)}
        ocultar={ocultar}
        aoTrocarOcultar={trocarOcultar}
        tema={tema}
        aoTrocarTema={trocarTema}
        aoVoltar={emSubtela ? () => irPara('mais') : undefined}
      />

      <main className="pb-[calc(theme(spacing.nav)+env(safe-area-inset-bottom)+1.5rem)] lg:pb-10 lg:pl-sidebar">
        {pendentes.length > 0 && (
          <div className="border-b border-borda bg-tinta-atencao px-4 py-1.5 text-center text-xs text-atencao">
            <span className="font-mono">{pendentes.length}</span> lançamento{pendentes.length > 1 ? 's' : ''} aguardando rede
          </div>
        )}
        <div className="mx-auto max-w-5xl px-4 pt-5 sm:px-6 lg:pt-8">
          {erro && (
            <Aviso className="mb-4" aoTentarDeNovo={recarregarOrcamentoAtual}>
              {erro}
            </Aviso>
          )}
          {/* key = vista: trocar de tela REMONTA, e a remontagem toca a entrada */}
          <div key={vista} className="animate-subir">
            {conteudo()}
          </div>
        </div>
      </main>

      <NavInferior vista={vista} aoIr={irPara} aoLancar={() => setLancando(true)} />

      <SeletorSheet
        aberto={seletorAberto}
        aoFechar={() => setSeletorAberto(false)}
        orcamentos={orcamentos}
        atualId={atual.id}
        aoTrocar={trocarOrcamento}
        aoEntrarEmNovo={entrouEm}
      />

      <Sheet aberto={lancando} aoFechar={() => setLancando(false)} selo={atual.nome} titulo="Novo lançamento" semPadding alto largura="sm">
        {categorias.length === 0 ? (
          <div className="p-5">
            <EsqueletoLista linhas={3} />
          </div>
        ) : (
          <Lancar ledgerId={atual.id} categorias={categorias} usuarioId={usuarioId} aoLancar={() => setLancando(false)} />
        )}
      </Sheet>
    </div>
  )
}

/** Tela cheia centrada: carregamento inicial e erro antes do shell existir. */
function Tela({ children }: { children?: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-fundo px-8 text-center">
      {children ?? <span className="h-6 w-6 animate-spin rounded-full border-2 border-acento border-r-transparent" aria-label="carregando" />}
    </div>
  )
}
