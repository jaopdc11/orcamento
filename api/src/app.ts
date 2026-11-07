import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'
import { bodyLimit } from 'hono/body-limit'
import { config } from './config'
import { rotasAuth, exigeSessao } from './auth'
import { rotasOrcamentos } from './rotas/orcamentos'
import { rotasLancamentos, rotasConvites } from './rotas/soltas'
import type { Ambiente } from './tipos'

const ESCRITA = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export const app = new Hono<Ambiente>()

app.use(secureHeaders())
app.use(bodyLimit({ maxSize: 256 * 1024 }))

app.use(
  cors({
    origin: (origem) => (config.origens.includes(origem.toLowerCase()) ? origem : null),
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowHeaders: ['Content-Type'],
    maxAge: 600,
  }),
)

// CSRF: o cookie é SameSite=Lax, mas um subdomínio irmão (*.jaopd.dev) é
// same-site e mandaria o cookie. Então toda escrita exige Origin do nosso front
// e corpo JSON (form HTML não manda application/json sem preflight).
app.use(async (c, next) => {
  if (ESCRITA.has(c.req.method)) {
    const origem = c.req.header('origin')?.toLowerCase()
    if (!origem || !config.origens.includes(origem)) {
      return c.json({ erro: 'Origem não permitida.' }, 403)
    }
    const temCorpo = c.req.header('content-length') !== '0' && c.req.method !== 'DELETE'
    if (temCorpo && !c.req.header('content-type')?.startsWith('application/json')) {
      return c.json({ erro: 'Envie JSON.' }, 415)
    }
  }
  await next()
})

app.get('/saude', (c) => c.json({ ok: true }))

app.route('/auth', rotasAuth)

app.use('/orcamentos/*', exigeSessao)
app.use('/orcamentos', exigeSessao)
app.use('/lancamentos/*', exigeSessao)
app.use('/lancamentos', exigeSessao)
app.use('/convites/*', exigeSessao)

app.route('/orcamentos', rotasOrcamentos)
app.route('/lancamentos', rotasLancamentos)
app.route('/convites', rotasConvites)

app.notFound((c) => c.json({ erro: 'Não encontrado.' }, 404))

app.onError((erro, c) => {
  console.error('[api]', c.req.method, c.req.path, erro)
  return c.json({ erro: 'Erro interno.' }, 500)
})
