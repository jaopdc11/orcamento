// Cliente da API própria (orcamento.api.jaopd.dev). Substitui o supabase-js.
//
// A sessão é um cookie HttpOnly que o JS nem enxerga: `credentials: 'include'`
// faz o navegador mandar. Front e API são same-site (*.jaopd.dev), então o
// SameSite=Lax do cookie não atrapalha.

const env = (import.meta as { env?: Record<string, string | undefined> }).env ?? {}
export const API_URL = (env.VITE_API_URL ?? 'https://orcamento.api.jaopd.dev').replace(/\/$/, '')

export type Usuario = { usuarioId: string; email: string }

// --- sessão: quem quiser saber de login/logout escuta aqui ------------------

type Ouvinte = (u: Usuario | null) => void
const ouvintes = new Set<Ouvinte>()

export function aoMudarSessao(fn: Ouvinte): () => void {
  ouvintes.add(fn)
  return () => ouvintes.delete(fn)
}

export function avisarSessao(u: Usuario | null): void {
  ouvintes.forEach((fn) => fn(u))
}

// --- requisição --------------------------------------------------------------

export class ErroApi extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
  }
}

async function requisitar<T>(metodo: string, caminho: string, corpo?: unknown): Promise<T> {
  const resposta = await fetch(API_URL + caminho, {
    method: metodo,
    credentials: 'include',
    headers: corpo === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  })

  const texto = await resposta.text()
  const dados = texto ? JSON.parse(texto) : null

  if (!resposta.ok) {
    // Sessão morreu no meio do uso (expirou, saiu em outro aparelho): volta pro login.
    // /auth/eu fica de fora porque é ele que descobre se tem sessão.
    if (resposta.status === 401 && caminho !== '/auth/eu') avisarSessao(null)
    throw new ErroApi((dados as { erro?: string } | null)?.erro ?? `Erro ${resposta.status}`, resposta.status)
  }
  return dados as T
}

export const api = {
  get: <T>(caminho: string) => requisitar<T>('GET', caminho),
  // escrita sempre manda corpo JSON (nem que vazio): a API exige application/json
  post: <T>(caminho: string, corpo: unknown = {}) => requisitar<T>('POST', caminho, corpo),
  put: <T>(caminho: string, corpo: unknown) => requisitar<T>('PUT', caminho, corpo),
  del: <T>(caminho: string) => requisitar<T>('DELETE', caminho),
}

export async function sair(): Promise<void> {
  try {
    await api.post('/auth/sair')
  } finally {
    avisarSessao(null)
  }
}
