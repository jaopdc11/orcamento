// Smoke test: monta as telas de verdade num DOM simulado, com a rede stubada.
// Roda com `pnpm fumaca`.
//
// O build passar só prova que os tipos batem. Isto pega o que os tipos não
// pegam: hook fora de ordem, acesso a window na montagem, e principalmente
// tela que quebra com estado VAZIO — mês sem lançamento, orçamento sem meta,
// lista só com item pendente.

import { JSDOM } from 'jsdom'

process.env.VITE_API_URL ??= 'https://api.exemplo.dev'

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'https://exemplo.dev/',
  pretendToBeVisual: true,
})

const g = globalThis as unknown as Record<string, unknown>
g.window = dom.window
g.document = dom.window.document
Object.defineProperty(globalThis, 'navigator', {
  value: dom.window.navigator,
  configurable: true,
})
g.localStorage = dom.window.localStorage
g.sessionStorage = dom.window.sessionStorage
g.history = dom.window.history
g.location = dom.window.location
g.HTMLElement = dom.window.HTMLElement
g.Element = dom.window.Element
g.Node = dom.window.Node
g.Event = dom.window.Event
g.KeyboardEvent = dom.window.KeyboardEvent
g.MouseEvent = dom.window.MouseEvent
g.getComputedStyle = dom.window.getComputedStyle
g.requestAnimationFrame = (cb: FrameRequestCallback) =>
  setTimeout(() => cb(performance.now()), 16) as unknown as number
g.cancelAnimationFrame = (id: number) => clearTimeout(id)
g.IS_REACT_ACT_ENVIRONMENT = true

// A API devolve lista vazia pra tudo, no envelope { status, data }: é o estado
// mais hostil às telas. Response nativo do Node (não o do jsdom).
g.fetch = async () =>
  new Response(JSON.stringify({ status: 'success', data: [] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

const erroOriginal = console.error
const errosDoReact: string[] = []
console.error = (...args: unknown[]) => {
  const txt = String(args[0] ?? '')
  if (txt.includes('not wrapped in act')) return
  errosDoReact.push(txt)
  erroOriginal(...args)
}

const { createRoot } = await import('react-dom/client')
const { createElement } = await import('react')
const { Login } = await import('../features/auth/Login')
const { Comecar } = await import('../features/orcamentos/Comecar')
const { Mes } = await import('../features/mes/Mes')
const { Lancar } = await import('../features/lancamentos/Lancar')
const { Dashboard } = await import('../features/mes/Dashboard')
const { Historico } = await import('../features/historico/Historico')
const { ConfigOrcamento } = await import('../features/orcamentos/ConfigOrcamento')
const { Seletor } = await import('../features/orcamentos/Seletor')
const { Metas } = await import('../features/metas/Metas')
const { Analises } = await import('../features/analises/Analises')
const { Perfil } = await import('../features/perfil/Perfil')
const { Acerto } = await import('../features/acerto/Acerto')
const { Recorrentes } = await import('../features/recorrentes/Recorrentes')
const { Busca } = await import('../features/busca/Busca')

let falhas = 0

async function montar(nome: string, elemento: React.ReactElement, esperado: string[]) {
  const alvo = dom.window.document.createElement('div')
  dom.window.document.body.appendChild(alvo)
  const root = createRoot(alvo)

  try {
    root.render(elemento)
    // deixa efeitos e promessas de dados resolverem.
    await new Promise((r) => setTimeout(r, 300))

    const texto = alvo.textContent ?? ''
    const faltando = esperado.filter((e) => !texto.includes(e))
    if (faltando.length > 0) {
      falhas++
      console.log(`✗ ${nome} — não achei: ${faltando.join(', ')}`)
      console.log(`    tela: ${texto.slice(0, 160)}`)
    } else {
      console.log(`✓ ${nome}`)
    }
  } catch (e) {
    falhas++
    console.log(`✗ ${nome} — quebrou: ${e instanceof Error ? e.message : String(e)}`)
  } finally {
    root.unmount()
    alvo.remove()
  }
}

const ORCAMENTO = { id: 'l1', nome: 'Nossa casa', created_at: '2026-01-01T00:00:00Z' }
const MEMBRO = {
  ledger_id: 'l1',
  user_id: 'u1',
  apelido: 'João',
  nome: null,
  email: 'joao@exemplo.dev',
  proporcao: 1,
}
const CATEGORIAS = [
  {
    id: 'c1',
    ledger_id: 'l1',
    nome: 'Mercado',
    kind: 'expense' as const,
    emoji: '🛒',
    cor: null,
    ordem: 10,
    archived_at: null,
  },
  {
    id: 'c2',
    ledger_id: 'l1',
    nome: 'Salário',
    kind: 'income' as const,
    emoji: '💰',
    cor: null,
    ordem: 10,
    archived_at: null,
  },
]

console.log('')
await montar('login pede e-mail', createElement(Login), ['Orçamento', 'Receber código'])

await montar(
  'começar oferece criar e entrar',
  createElement(Comecar, { aoEntrar: () => {} }),
  ['Criar um', 'Tenho um código', 'Criar orçamento'],
)

await montar(
  'lançar abre pedindo valor',
  createElement(Lancar, {
    ledgerId: 'l1',
    categorias: CATEGORIAS,
    usuarioId: 'u1',
    aoLancar: () => {},
  }),
  ['Saiu', 'Entrou', 'Mercado', 'Digite o valor'],
)

// O caso que mais quebra: mês sem nenhum lançamento.
await montar(
  'mês vazio não quebra',
  createElement(Mes, {
    orcamento: ORCAMENTO,
    categorias: CATEGORIAS,
    membros: [MEMBRO],
    aoFechar: () => {},
  }),
  ['Nada em', 'Lançamentos', 'Metas', 'exportar CSV'],
)

await montar(
  'dashboard vazio não quebra',
  createElement(Dashboard, {
    ledgerId: 'l1',
    categorias: CATEGORIAS,
    usuarioId: 'u1',
    ocultar: false,
    membros: new Map([['u1', MEMBRO]]),
  }),
  ['Orçamento Mensal', 'Receitas', 'Despesas'],
)

// Telas v2: cada uma tem que montar com a API devolvendo vazio. O texto
// esperado é o TÍTULO da tela — quem implementar mantém o título.
const CTX = {
  orcamento: ORCAMENTO,
  usuarioId: 'u1',
  membros: [MEMBRO],
  categorias: CATEGORIAS,
  ocultar: false,
}
const nada = () => {}
await montar('histórico', createElement(Historico, CTX), ['Histórico'])
await montar('busca', createElement(Busca, CTX), ['Busca'])
await montar('metas', createElement(Metas, CTX), ['Metas'])
await montar('análises', createElement(Analises, CTX), ['Análises'])
await montar('acerto', createElement(Acerto, { ...CTX, aoMudar: nada }), ['Acerto de contas'])
await montar('recorrentes', createElement(Recorrentes, CTX), ['Recorrentes'])
await montar(
  'configurações',
  createElement(ConfigOrcamento, { ...CTX, aoMudar: nada, aoSair: nada }),
  ['Configurações'],
)
await montar(
  'seletor',
  createElement(Seletor, {
    orcamentos: [ORCAMENTO],
    atualId: 'l1',
    aoTrocar: nada,
    aoEntrarEmNovo: nada,
  }),
  ['Nossa casa'],
)
await montar(
  'perfil',
  createElement(Perfil, {
    usuario: { usuarioId: 'u1', email: 'joao@exemplo.dev', nome: null },
    tema: 'claro',
    aoMudarTema: nada,
    aoAtualizar: nada,
  }),
  ['Perfil'],
)

console.log(
  errosDoReact.length > 0
    ? `\n${errosDoReact.length} erro(s) do React acima.`
    : '\nsem erro do React.',
)
console.log(falhas === 0 ? 'Fumaça limpa.\n' : `${falhas} tela(s) com problema.\n`)
process.exit(falhas === 0 && errosDoReact.length === 0 ? 0 : 1)
