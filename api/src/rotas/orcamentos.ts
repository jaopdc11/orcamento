import { Hono } from 'hono'
import { createMiddleware } from 'hono/factory'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { sql, mensagemDeNegocio } from '../db'
import type { Ambiente } from '../tipos'

// Tudo aqui está atrás de exigeSessao (montado no app.ts).
// O RLS do Supabase virou isto: toda rota com :ledgerId passa por `exigeMembro`,
// e quem não é membro recebe 404 — nem confirmamos que o orçamento existe.

const uuid = z.string().uuid()
const mesSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)

export const exigeMembro = createMiddleware<Ambiente>(async (c, next) => {
  const ledgerId = c.req.param('ledgerId')
  if (!ledgerId || !uuid.safeParse(ledgerId).success) return c.json({ erro: 'Não encontrado.' }, 404)

  const [membro] = await sql`
    select 1 from ledger_members
    where ledger_id = ${ledgerId} and user_id = ${c.get('uid')}
  `
  if (!membro) return c.json({ erro: 'Não encontrado.' }, 404)

  c.set('ledgerId', ledgerId)
  await next()
})

/** 'YYYY-MM' → [primeiro dia, primeiro dia do mês seguinte), comparando date × date. */
function intervalo(mes: string): { inicio: string; fim: string } {
  const [ano, m] = mes.split('-').map(Number) as [number, number]
  const prox = m === 12 ? `${ano + 1}-01` : `${ano}-${String(m + 1).padStart(2, '0')}`
  return { inicio: `${mes}-01`, fim: `${prox}-01` }
}

function mesAnterior(mes: string): string {
  const [ano, m] = mes.split('-').map(Number) as [number, number]
  return m === 1 ? `${ano - 1}-12` : `${ano}-${String(m - 1).padStart(2, '0')}`
}

const doLedger = new Hono<Ambiente>()
  .use(exigeMembro)

  // ------------------------------------------------------------- membros
  .get('/membros', async (c) => {
    const membros = await sql`
      select ledger_id::text, user_id::text, apelido
      from ledger_members where ledger_id = ${c.get('ledgerId')}
    `
    return c.json(membros)
  })

  .delete('/membros/eu', async (c) => {
    await sql`
      delete from ledger_members
      where ledger_id = ${c.get('ledgerId')} and user_id = ${c.get('uid')}
    `
    return c.json({ ok: true })
  })

  // ------------------------------------------------------------- convites
  .get('/convites', async (c) => {
    const convites = await sql`
      select code, ledger_id::text, criado_por::text, expires_at, used_at, used_by::text, created_at
      from ledger_invites
      where ledger_id = ${c.get('ledgerId')} and used_at is null and expires_at > now()
      order by created_at desc
    `
    return c.json(convites)
  })

  .post('/convites', async (c) => {
    try {
      const [linha] = await sql`select criar_convite(${c.get('uid')}, ${c.get('ledgerId')}) as code`
      return c.json({ code: linha.code })
    } catch (erro) {
      const msg = mensagemDeNegocio(erro)
      if (msg) return c.json({ erro: msg }, 400)
      throw erro
    }
  })

  // ------------------------------------------------------------- categorias
  .get('/categorias', async (c) => {
    const categorias = await sql`
      select id::text, ledger_id::text, nome, kind, emoji, cor, ordem, archived_at
      from categories
      where ledger_id = ${c.get('ledgerId')} and archived_at is null
      order by ordem
    `
    return c.json(categorias)
  })

  // ------------------------------------------------------------- lançamentos
  .get('/lancamentos', zValidator('query', z.object({ mes: mesSchema })), async (c) => {
    const { inicio, fim } = intervalo(c.req.valid('query').mes)
    const lancamentos = await sql`
      select id::text, ledger_id::text, category_id::text, kind,
             amount_cents::float8 as amount_cents, signed_cents::float8 as signed_cents,
             occurred_on::text, descricao, paid_by::text, created_by::text,
             created_at, deleted_at
      from entries
      where ledger_id = ${c.get('ledgerId')}
        and deleted_at is null
        and occurred_on >= ${inicio}::date and occurred_on < ${fim}::date
      order by occurred_on desc, id desc  -- UUIDv7 desempata por horário de criação
    `
    return c.json(lancamentos)
  })

  // ------------------------------------------------------------- metas
  .get('/metas', zValidator('query', z.object({ mes: mesSchema })), async (c) => {
    const metas = await sql`
      select ledger_id::text, category_id::text, month::text, limit_cents::float8 as limit_cents
      from budgets
      where ledger_id = ${c.get('ledgerId')} and month = ${`${c.req.valid('query').mes}-01`}::date
    `
    return c.json(metas)
  })

  .put(
    '/metas/:categoryId',
    zValidator('query', z.object({ mes: mesSchema })),
    zValidator('json', z.object({ limite_cents: z.number().int().min(0).max(1e12) })),
    async (c) => {
      const ledgerId = c.get('ledgerId')
      const categoryId = c.req.param('categoryId')
      const mes = `${c.req.valid('query').mes}-01`
      const { limite_cents } = c.req.valid('json')
      if (!uuid.safeParse(categoryId).success) return c.json({ erro: 'Categoria inválida.' }, 400)

      // Meta zerada é meta removida: o usuário "apaga" limpando o campo.
      if (limite_cents === 0) {
        await sql`
          delete from budgets
          where ledger_id = ${ledgerId} and category_id = ${categoryId} and month = ${mes}::date
        `
        return c.json({ ok: true })
      }

      // A categoria tem que ser deste orçamento: o insert...select não grava nada se não for.
      const gravadas = await sql`
        insert into budgets (ledger_id, category_id, month, limit_cents)
        select ${ledgerId}, c.id, ${mes}::date, ${limite_cents}
        from categories c
        where c.id = ${categoryId} and c.ledger_id = ${ledgerId}
        on conflict (ledger_id, category_id, month) do update set limit_cents = excluded.limit_cents
        returning 1
      `
      if (gravadas.length === 0) return c.json({ erro: 'Categoria inválida.' }, 400)
      return c.json({ ok: true })
    },
  )

  .post('/metas/copiar', zValidator('query', z.object({ mes: mesSchema })), async (c) => {
    const mes = c.req.valid('query').mes
    const copiadas = await sql`
      insert into budgets (ledger_id, category_id, month, limit_cents)
      select ledger_id, category_id, ${`${mes}-01`}::date, limit_cents
      from budgets
      where ledger_id = ${c.get('ledgerId')} and month = ${`${mesAnterior(mes)}-01`}::date
      on conflict (ledger_id, category_id, month) do update set limit_cents = excluded.limit_cents
      returning 1
    `
    return c.json({ copiadas: copiadas.length })
  })

export const rotasOrcamentos = new Hono<Ambiente>()
  .get('/', async (c) => {
    const orcamentos = await sql`
      select l.id::text, l.nome, l.created_at
      from ledgers l join ledger_members m on m.ledger_id = l.id
      where m.user_id = ${c.get('uid')}
      order by l.created_at
    `
    return c.json(orcamentos)
  })

  .post(
    '/',
    zValidator(
      'json',
      z.object({
        nome: z.string().trim().min(1).max(80),
        apelido: z.string().trim().max(40).nullish(),
      }),
    ),
    async (c) => {
      const { nome, apelido } = c.req.valid('json')
      try {
        const [linha] = await sql`
          select criar_orcamento(${c.get('uid')}, ${nome}, ${apelido ?? null})::text as id
        `
        return c.json({ id: linha.id }, 201)
      } catch (erro) {
        const msg = mensagemDeNegocio(erro)
        if (msg) return c.json({ erro: msg }, 400)
        throw erro
      }
    },
  )

  .route('/:ledgerId', doLedger)
