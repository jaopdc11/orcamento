import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { sql, mensagemDeNegocio } from '../db'
import type { Ambiente } from '../tipos'

// Rotas que não têm :ledgerId na URL. A checagem de membro vai DENTRO do SQL,
// pelo ledger da própria linha — nunca confiando em ledger_id vindo do cliente.

const uuid = z.string().uuid()

const lancamentoNovo = z.object({
  id: uuid,
  ledger_id: uuid,
  category_id: uuid.nullable(),
  kind: z.enum(['expense', 'income']),
  amount_cents: z.number().int().refine((v) => v !== 0 && Math.abs(v) <= 1e12),
  occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  descricao: z.string().max(200).nullable(),
  paid_by: uuid.nullable(),
  client_created_at: z.string().datetime({ offset: true }).nullable().optional(),
  // created_by vem no corpo (é o tipo do front), mas é IGNORADO: a autoria é a sessão.
  created_by: z.string().optional(),
})

export const rotasLancamentos = new Hono<Ambiente>()
  /**
   * A fila offline sobe tudo por aqui. Idempotente pelo id (UUIDv7 do cliente):
   * reenviar a mesma linha é inofensivo.
   *
   * Devolve:
   *  - confirmados: gravados agora OU que já existiam num orçamento seu → saem da fila
   *  - rejeitados: orçamento que você não participa (ex.: saiu dele com item pendente),
   *    categoria/pagador de fora. Também saem da fila, senão ficariam em loop eterno.
   */
  .post('/', zValidator('json', z.array(lancamentoNovo).max(200)), async (c) => {
    const uid = c.get('uid')
    const itens = c.req.valid('json')

    await sql.begin(async (tx) => {
      for (const l of itens) {
        // insert...select: só grava se você é membro do ledger, a categoria é dele
        // e quem pagou também é membro. Senão, zero linhas e cai em "rejeitados".
        await tx`
          insert into entries
            (id, ledger_id, category_id, kind, amount_cents, occurred_on,
             descricao, paid_by, created_by, client_created_at)
          select ${l.id}, ${l.ledger_id}, ${l.category_id}, ${l.kind}, ${l.amount_cents},
                 ${l.occurred_on}::date, ${l.descricao}, ${l.paid_by}, ${uid},
                 ${l.client_created_at ?? null}::timestamptz
          where exists (select 1 from ledger_members m
                        where m.ledger_id = ${l.ledger_id} and m.user_id = ${uid})
            and (${l.category_id}::uuid is null or exists (
                  select 1 from categories c
                  where c.id = ${l.category_id} and c.ledger_id = ${l.ledger_id}))
            and (${l.paid_by}::uuid is null or exists (
                  select 1 from ledger_members m
                  where m.ledger_id = ${l.ledger_id} and m.user_id = ${l.paid_by}))
          on conflict (id) do nothing
        `
      }
    })

    const ids = itens.map((l) => l.id)
    const existentes =
      ids.length === 0
        ? []
        : await sql`
            select e.id::text from entries e
            join ledger_members m on m.ledger_id = e.ledger_id and m.user_id = ${uid}
            where e.id in ${sql(ids)}
          `
    const confirmados = new Set(existentes.map((l: { id: string }) => l.id))
    return c.json({
      confirmados: [...confirmados],
      rejeitados: ids.filter((id) => !confirmados.has(id)),
    })
  })

  /** Apagar é soft delete: o histórico é o ativo, e estorno é linha nova negativa. */
  .delete('/:id', async (c) => {
    const id = c.req.param('id')
    if (!uuid.safeParse(id).success) return c.json({ erro: 'Não encontrado.' }, 404)
    const apagadas = await sql`
      update entries e set deleted_at = now()
      where e.id = ${id} and e.deleted_at is null
        and exists (select 1 from ledger_members m
                    where m.ledger_id = e.ledger_id and m.user_id = ${c.get('uid')})
      returning 1
    `
    if (apagadas.length === 0) return c.json({ erro: 'Não encontrado.' }, 404)
    return c.json({ ok: true })
  })

export const rotasConvites = new Hono<Ambiente>()
  .post('/aceitar', zValidator('json', z.object({ codigo: z.string().max(40) })), async (c) => {
    try {
      const [linha] = await sql`
        select aceitar_convite(${c.get('uid')}, ${c.req.valid('json').codigo})::text as id
      `
      return c.json({ ledgerId: linha.id })
    } catch (erro) {
      const msg = mensagemDeNegocio(erro)
      if (msg) return c.json({ erro: msg }, 400)
      throw erro
    }
  })

  .delete('/:code', async (c) => {
    const apagados = await sql`
      delete from ledger_invites i
      where i.code = ${c.req.param('code')} and i.used_at is null
        and exists (select 1 from ledger_members m
                    where m.ledger_id = i.ledger_id and m.user_id = ${c.get('uid')})
      returning 1
    `
    if (apagados.length === 0) return c.json({ erro: 'Não encontrado.' }, 404)
    return c.json({ ok: true })
  })
