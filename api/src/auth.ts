import { Hono, type Context } from 'hono'
import { createMiddleware } from 'hono/factory'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { sql } from './db'
import { config } from './config'
import { enviarCodigo } from './email'
import type { Ambiente } from './tipos'

const COOKIE = 'sessao'
const SESSAO_DIAS = 90 // PWA no celular não pode deslogar toda semana
const CODIGO_MINUTOS = 10
const CODIGO_TENTATIVAS = 5

function sha256(texto: string): string {
  return new Bun.CryptoHasher('sha256').update(texto).digest('hex')
}

/** 6 dígitos sem viés de módulo: rejeita o topo do intervalo do uint32. */
function gerarCodigo(): string {
  const limite = 4_294_000_000 // maior múltiplo de 1_000_000 ≤ 2^32
  const buf = new Uint32Array(1)
  do crypto.getRandomValues(buf)
  while (buf[0]! >= limite)
  return String(buf[0]! % 1_000_000).padStart(6, '0')
}

function gerarToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Buffer.from(bytes).toString('base64url')
}

// ---------------------------------------------------------------------------
// rate limit em memória: um processo só, dois usuários. Redis seria piada.
// ---------------------------------------------------------------------------

const janelas = new Map<string, number[]>()

/** true se a chave ainda pode; registra a tentativa. */
function permitir(chave: string, maximo: number, janelaMs: number): boolean {
  const agora = Date.now()
  const recentes = (janelas.get(chave) ?? []).filter((t) => agora - t < janelaMs)
  if (recentes.length >= maximo) {
    janelas.set(chave, recentes)
    return false
  }
  recentes.push(agora)
  janelas.set(chave, recentes)
  return true
}

export function limparRateLimit(): void {
  janelas.clear()
}

/**
 * IP do cliente. Atrás do Caddy, o último valor do X-Forwarded-For é o que o
 * próprio Caddy viu — os anteriores o cliente pode forjar.
 */
function ipDe(c: Context): string {
  const xff = c.req.header('x-forwarded-for')
  return xff?.split(',').at(-1)?.trim() || 'local'
}

// ---------------------------------------------------------------------------
// sessão
// ---------------------------------------------------------------------------

async function criarSessao(c: Context, uid: string): Promise<void> {
  const token = gerarToken()
  await sql`
    insert into sessions (token_hash, user_id, expires_at)
    values (${sha256(token)}, ${uid}, now() + ${`${SESSAO_DIAS} days`}::interval)
  `
  setCookie(c, COOKIE, token, {
    httpOnly: true,
    secure: config.cookieSeguro,
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSAO_DIAS * 24 * 3600,
  })
}

/** Exige sessão válida; deixa uid e email no contexto. Renova a validade (deslizante). */
export const exigeSessao = createMiddleware<Ambiente>(async (c, next) => {
  const token = getCookie(c, COOKIE)
  if (!token) return c.json({ erro: 'Precisa estar logado.' }, 401)

  const hash = sha256(token)
  const [linha] = await sql`
    select s.user_id::text as uid, u.email,
           s.last_seen_at < now() - interval '1 day' as renovar
    from sessions s join users u on u.id = s.user_id
    where s.token_hash = ${hash} and s.expires_at > now()
  `
  if (!linha) {
    deleteCookie(c, COOKIE, { path: '/' })
    return c.json({ erro: 'Sessão expirada. Entre de novo.' }, 401)
  }

  // Renova no máximo uma vez por dia: evita um UPDATE por requisição.
  if (linha.renovar) {
    await sql`
      update sessions
         set last_seen_at = now(),
             expires_at = now() + ${`${SESSAO_DIAS} days`}::interval
       where token_hash = ${hash}
    `
  }

  c.set('uid', linha.uid)
  c.set('email', linha.email)
  await next()
})

// ---------------------------------------------------------------------------
// rotas /auth
// ---------------------------------------------------------------------------

const emailSchema = z.string().trim().toLowerCase().email().max(254)

export const rotasAuth = new Hono<Ambiente>()
  .post('/codigo', zValidator('json', z.object({ email: emailSchema })), async (c) => {
    const { email } = c.req.valid('json')

    if (!permitir(`ip:${ipDe(c)}`, 10, 15 * 60_000) || !permitir(`email:${email}`, 3, 15 * 60_000)) {
      return c.json({ erro: 'Muitos pedidos seguidos. Espere alguns minutos.' }, 429)
    }

    // Resposta idêntica pra e-mail fora da lista: não revela quem tem acesso.
    if (config.emailsPermitidos.has(email)) {
      const codigo = gerarCodigo()
      await sql`
        insert into login_codes (email, code_hash, expires_at)
        values (${email}, ${sha256(codigo)}, now() + ${`${CODIGO_MINUTOS} minutes`}::interval)
        on conflict (email) do update
          set code_hash = excluded.code_hash,
              expires_at = excluded.expires_at,
              tentativas = 0,
              created_at = now()
      `
      try {
        await enviarCodigo(email, codigo)
      } catch (erro) {
        console.error('[auth] falha ao enviar e-mail:', erro)
        return c.json({ erro: 'Não consegui mandar o e-mail. Tente de novo.' }, 502)
      }
    }

    return c.json({ ok: true })
  })

  .post(
    '/verificar',
    zValidator('json', z.object({ email: emailSchema, codigo: z.string().regex(/^\d{6}$/) })),
    async (c) => {
      const { email, codigo } = c.req.valid('json')
      const invalido = () => c.json({ erro: 'Código errado ou vencido. Peça outro.' }, 400)

      if (!permitir(`verificar:${ipDe(c)}`, 20, 15 * 60_000)) {
        return c.json({ erro: 'Muitas tentativas. Espere alguns minutos.' }, 429)
      }

      // Conta a tentativa ANTES de comparar: 5 chutes e o código morre,
      // mesmo que o 6º estivesse certo.
      const [registro] = await sql`
        update login_codes
           set tentativas = tentativas + 1
         where email = ${email} and expires_at > now()
        returning code_hash, tentativas
      `
      if (!registro || registro.tentativas > CODIGO_TENTATIVAS) return invalido()
      if (registro.code_hash !== sha256(codigo)) return invalido()

      // Uso único: apaga antes de criar a sessão.
      await sql`delete from login_codes where email = ${email}`

      const [usuario] = await sql`
        insert into users (email) values (${email})
        on conflict (email) do update set email = excluded.email
        returning id::text as id
      `
      await criarSessao(c, usuario.id)
      return c.json({ usuarioId: usuario.id, email })
    },
  )

  .get('/eu', exigeSessao, (c) => c.json({ usuarioId: c.get('uid'), email: c.get('email') }))

  .post('/sair', async (c) => {
    const token = getCookie(c, COOKIE)
    if (token) await sql`delete from sessions where token_hash = ${sha256(token)}`
    deleteCookie(c, COOKIE, { path: '/' })
    return c.json({ ok: true })
  })
