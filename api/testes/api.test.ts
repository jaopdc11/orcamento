// Integração da API contra Postgres real (testes/rodar.sh sobe o container).
// Porta das 16 checagens de supabase/testes + as que o auth próprio exige.
// O foco é o que o RLS fazia: ninguém de fora enxerga ou escreve num orçamento alheio.

import { describe, test, expect, beforeAll } from 'bun:test'
import { app } from '../src/app'
import { sql } from '../src/db'
import { trocarEnviador } from '../src/email'
import { limparRateLimit } from '../src/auth'

const ORIGEM = 'http://front.teste'
const codigos = new Map<string, string>()
trocarEnviador(async (para, codigo) => {
  codigos.set(para, codigo)
})

type Resp = { status: number; corpo: any }

/** Cliente de teste com cookie de sessão. */
class Cliente {
  cookie = ''
  constructor(public email: string) {}

  async req(metodo: string, caminho: string, corpo?: unknown, extra: Record<string, string> = {}): Promise<Resp> {
    const headers: Record<string, string> = { origin: ORIGEM, ...extra }
    if (this.cookie) headers.cookie = this.cookie
    if (corpo !== undefined) headers['content-type'] = 'application/json'
    const r = await app.request(caminho, {
      method: metodo,
      headers,
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    })
    const setCookie = r.headers.get('set-cookie')
    if (setCookie?.startsWith('sessao=')) this.cookie = setCookie.split(';')[0]!
    const texto = await r.text()
    return { status: r.status, corpo: texto ? JSON.parse(texto) : null }
  }

  get = (c: string) => this.req('GET', c)
  post = (c: string, b?: unknown) => this.req('POST', c, b ?? {})
  put = (c: string, b: unknown) => this.req('PUT', c, b)
  del = (c: string) => this.req('DELETE', c)

  async logar(): Promise<string> {
    await this.post('/auth/codigo', { email: this.email })
    const r = await this.post('/auth/verificar', { email: this.email, codigo: codigos.get(this.email) })
    expect(r.status).toBe(200)
    return r.corpo.usuarioId
  }
}

let ana: Cliente, bia: Cliente, estranho: Cliente
let anaId: string, biaId: string
let ledger: string
let mercado: string

const uuidv7 = () => Bun.randomUUIDv7()

beforeAll(async () => {
  ana = new Cliente('ana@teste.dev')
  bia = new Cliente('bia@teste.dev')
  estranho = new Cliente('estranho@teste.dev')
  anaId = await ana.logar()
  biaId = await bia.logar()
  await estranho.logar()

  const r = await ana.post('/orcamentos', { nome: 'Nossa casa', apelido: 'Ana' })
  ledger = r.corpo.id
  const cats = await ana.get(`/orcamentos/${ledger}/categorias`)
  mercado = cats.corpo.find((c: any) => c.nome === 'Mercado').id
})

describe('auth', () => {
  test('e-mail fora da lista recebe a mesma resposta e nenhum código', async () => {
    limparRateLimit()
    const intruso = new Cliente('intruso@teste.dev')
    const r = await intruso.post('/auth/codigo', { email: 'intruso@teste.dev' })
    expect(r.status).toBe(200)
    expect(codigos.has('intruso@teste.dev')).toBe(false)
  })

  test('código é de uso único', async () => {
    limparRateLimit()
    const c = new Cliente('bia@teste.dev')
    await c.post('/auth/codigo', { email: c.email })
    const codigo = codigos.get(c.email)
    expect((await c.post('/auth/verificar', { email: c.email, codigo })).status).toBe(200)
    expect((await c.post('/auth/verificar', { email: c.email, codigo })).status).toBe(400)
  })

  test('5 chutes errados matam o código, mesmo que o 6º seja o certo', async () => {
    limparRateLimit()
    const c = new Cliente('bia@teste.dev')
    await c.post('/auth/codigo', { email: c.email })
    const certo = codigos.get(c.email)!
    const errado = certo === '000000' ? '111111' : '000000'
    for (let i = 0; i < 5; i++) {
      expect((await c.post('/auth/verificar', { email: c.email, codigo: errado })).status).toBe(400)
    }
    expect((await c.post('/auth/verificar', { email: c.email, codigo: certo })).status).toBe(400)
  })

  test('sem cookie: 401', async () => {
    const anonimo = new Cliente('x@teste.dev')
    expect((await anonimo.get('/orcamentos')).status).toBe(401)
    expect((await anonimo.get('/auth/eu')).status).toBe(401)
  })

  test('/auth/eu devolve quem está logado', async () => {
    const r = await ana.get('/auth/eu')
    expect(r.corpo).toEqual({ usuarioId: anaId, email: 'ana@teste.dev' })
  })

  test('sessão expirada: 401', async () => {
    limparRateLimit()
    const c = new Cliente('bia@teste.dev')
    const id = await c.logar()
    await sql`update sessions set expires_at = now() - interval '1 second' where user_id = ${id}
              and created_at = (select max(created_at) from sessions where user_id = ${id})`
    expect((await c.get('/orcamentos')).status).toBe(401)
  })

  test('sair invalida a sessão no servidor, não só o cookie', async () => {
    limparRateLimit()
    const c = new Cliente('bia@teste.dev')
    await c.logar()
    const cookieVelho = c.cookie
    await c.post('/auth/sair')
    c.cookie = cookieVelho
    expect((await c.get('/orcamentos')).status).toBe(401)
  })
})

describe('CSRF', () => {
  test('escrita sem Origin: 403', async () => {
    const r = await ana.req('POST', '/orcamentos', { nome: 'x' }, { origin: '' })
    expect(r.status).toBe(403)
  })

  test('escrita de origem estranha: 403', async () => {
    const r = await ana.req('POST', '/orcamentos', { nome: 'x' }, { origin: 'https://mal.jaopd.dev' })
    expect(r.status).toBe(403)
  })

  test('escrita sem JSON: 415', async () => {
    const r = await app.request('/orcamentos', {
      method: 'POST',
      headers: { origin: ORIGEM, cookie: ana.cookie, 'content-type': 'application/x-www-form-urlencoded' },
      body: 'nome=x',
    })
    expect(r.status).toBe(415)
  })
})

describe('orçamento', () => {
  test('criar semeia 13 categorias e torna o criador membro', async () => {
    const cats = await ana.get(`/orcamentos/${ledger}/categorias`)
    expect(cats.corpo).toHaveLength(13)
    const membros = await ana.get(`/orcamentos/${ledger}/membros`)
    expect(membros.corpo).toEqual([{ ledger_id: ledger, user_id: anaId, apelido: 'Ana' }])
  })

  test('nome vazio é recusado', async () => {
    expect((await ana.post('/orcamentos', { nome: '   ' })).status).toBe(400)
  })

  test('estranho não vê o orçamento em lugar nenhum', async () => {
    expect((await estranho.get('/orcamentos')).corpo).toEqual([])
    for (const rota of ['membros', 'categorias', 'convites', 'lancamentos?mes=2026-01', 'metas?mes=2026-01']) {
      expect((await estranho.get(`/orcamentos/${ledger}/${rota}`)).status).toBe(404)
    }
    expect((await estranho.post(`/orcamentos/${ledger}/convites`)).status).toBe(404)
    expect((await estranho.put(`/orcamentos/${ledger}/metas/${mercado}?mes=2026-01`, { limite_cents: 1 })).status).toBe(404)
    expect((await estranho.post(`/orcamentos/${ledger}/metas/copiar?mes=2026-01`)).status).toBe(404)
  })

  test('id inexistente e id malformado dão o mesmo 404', async () => {
    expect((await ana.get(`/orcamentos/${crypto.randomUUID()}/categorias`)).status).toBe(404)
    expect((await ana.get(`/orcamentos/nao-e-uuid/categorias`)).status).toBe(404)
  })
})

describe('convite', () => {
  let codigo: string

  test('membro gera; aparece nos pendentes', async () => {
    const r = await ana.post(`/orcamentos/${ledger}/convites`)
    codigo = r.corpo.code
    expect(codigo).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/)
    const pend = await ana.get(`/orcamentos/${ledger}/convites`)
    expect(pend.corpo.map((c: any) => c.code)).toContain(codigo)
  })

  test('aceitar normaliza o código e torna membro', async () => {
    const formatado = `${codigo.slice(0, 4).toLowerCase()}-${codigo.slice(4)}`
    const r = await bia.post('/convites/aceitar', { codigo: formatado })
    expect(r.corpo.ledgerId).toBe(ledger)
    expect((await bia.get(`/orcamentos/${ledger}/categorias`)).status).toBe(200)
  })

  test('aceitar de novo é idempotente', async () => {
    const r = await bia.post('/convites/aceitar', { codigo })
    expect(r.status).toBe(200)
    expect(r.corpo.ledgerId).toBe(ledger)
  })

  test('código usado não serve pra terceiro', async () => {
    const r = await estranho.post('/convites/aceitar', { codigo })
    expect(r.status).toBe(400)
    expect(r.corpo.erro).toBe('Este código já foi usado.')
  })

  test('código vencido é recusado', async () => {
    const novo = (await ana.post(`/orcamentos/${ledger}/convites`)).corpo.code
    await sql`update ledger_invites set expires_at = now() - interval '1 second' where code = ${novo}`
    const r = await estranho.post('/convites/aceitar', { codigo: novo })
    expect(r.corpo.erro).toBe('Este código venceu. Peça outro.')
  })

  test('código inexistente', async () => {
    const r = await estranho.post('/convites/aceitar', { codigo: 'ZZZZZZZZ' })
    expect(r.corpo.erro).toBe('Código não existe.')
  })

  test('estranho não cancela convite alheio; membro cancela', async () => {
    const novo = (await ana.post(`/orcamentos/${ledger}/convites`)).corpo.code
    expect((await estranho.del(`/convites/${novo}`)).status).toBe(404)
    expect((await bia.del(`/convites/${novo}`)).status).toBe(200)
    expect((await estranho.post('/convites/aceitar', { codigo: novo })).corpo.erro).toBe('Código não existe.')
  })
})

describe('lançamentos', () => {
  const novo = (extra: Record<string, unknown> = {}) => ({
    id: uuidv7(),
    ledger_id: ledger,
    category_id: mercado,
    kind: 'expense',
    amount_cents: 1234,
    occurred_on: '2026-01-31',
    descricao: 'pão',
    paid_by: null,
    created_by: 'quem-o-cliente-quiser',
    client_created_at: new Date().toISOString(),
    ...extra,
  })

  test('reenviar o mesmo lote não duplica e confirma os dois envios', async () => {
    const lote = [novo(), novo({ amount_cents: 500 })]
    const r1 = await ana.post('/lancamentos', lote)
    const r2 = await ana.post('/lancamentos', lote)
    expect(r1.corpo.confirmados.sort()).toEqual(lote.map((l) => l.id).sort())
    expect(r2.corpo.confirmados.sort()).toEqual(lote.map((l) => l.id).sort())
    const [{ n }] = await sql`select count(*)::int as n from entries where id in ${sql(lote.map((l) => l.id))}`
    expect(n).toBe(2)
  })

  test('autoria é da sessão, não do corpo', async () => {
    const l = novo()
    await bia.post('/lancamentos', [l])
    const [linha] = await sql`select created_by::text from entries where id = ${l.id}`
    expect(linha.created_by).toBe(biaId)
  })

  test('estranho não lança no orçamento alheio', async () => {
    const l = novo()
    const r = await estranho.post('/lancamentos', [l])
    expect(r.corpo).toEqual({ confirmados: [], rejeitados: [l.id] })
  })

  test('categoria de outro orçamento é rejeitada', async () => {
    const outro = (await estranho.post('/orcamentos', { nome: 'Do estranho' })).corpo.id
    const catAlheia = (await estranho.get(`/orcamentos/${outro}/categorias`)).corpo[0].id
    const l = novo({ category_id: catAlheia })
    expect((await ana.post('/lancamentos', [l])).corpo.rejeitados).toEqual([l.id])
  })

  test('pagador de fora do orçamento é rejeitado', async () => {
    const [{ id }] = await sql`select id::text from users where email = 'estranho@teste.dev'`
    const l = novo({ paid_by: id })
    expect((await ana.post('/lancamentos', [l])).corpo.rejeitados).toEqual([l.id])
  })

  test('reenviar id que já existe em orçamento alheio não confirma', async () => {
    const l = novo()
    await ana.post('/lancamentos', [l])
    const sequestro = { ...l, ledger_id: crypto.randomUUID() }
    expect((await estranho.post('/lancamentos', [sequestro])).corpo.rejeitados).toEqual([l.id])
  })

  test('mês: virada 31/01 → 01/02 e tipos que o front espera', async () => {
    await ana.post('/lancamentos', [novo({ occurred_on: '2026-02-01', descricao: 'fev' })])
    const jan = (await ana.get(`/orcamentos/${ledger}/lancamentos?mes=2026-01`)).corpo
    const fev = (await ana.get(`/orcamentos/${ledger}/lancamentos?mes=2026-02`)).corpo
    expect(jan.every((l: any) => l.occurred_on === '2026-01-31')).toBe(true)
    expect(fev.map((l: any) => l.descricao)).toEqual(['fev'])
    expect(typeof fev[0].amount_cents).toBe('number')
    expect(fev[0].signed_cents).toBe(-1234)
  })

  test('receita tem signed_cents positivo', async () => {
    const l = novo({ kind: 'income', occurred_on: '2026-03-05', category_id: null })
    await ana.post('/lancamentos', [l])
    const mar = (await ana.get(`/orcamentos/${ledger}/lancamentos?mes=2026-03`)).corpo
    expect(mar[0].signed_cents).toBe(1234)
  })

  test('apagar: estranho 404, membro apaga e some da lista', async () => {
    const l = novo({ occurred_on: '2026-04-10' })
    await ana.post('/lancamentos', [l])
    expect((await estranho.del(`/lancamentos/${l.id}`)).status).toBe(404)
    expect((await bia.del(`/lancamentos/${l.id}`)).status).toBe(200)
    expect((await ana.get(`/orcamentos/${ledger}/lancamentos?mes=2026-04`)).corpo).toEqual([])
    const [linha] = await sql`select deleted_at from entries where id = ${l.id}`
    expect(linha.deleted_at).not.toBeNull() // soft delete
  })

  test('mês malformado: 400', async () => {
    expect((await ana.get(`/orcamentos/${ledger}/lancamentos?mes=2026-13`)).status).toBe(400)
  })
})

describe('metas', () => {
  test('definir, ler, copiar pro mês seguinte e zerar apaga', async () => {
    expect((await ana.put(`/orcamentos/${ledger}/metas/${mercado}?mes=2026-05`, { limite_cents: 80000 })).status).toBe(200)
    const mai = (await ana.get(`/orcamentos/${ledger}/metas?mes=2026-05`)).corpo
    expect(mai).toEqual([{ ledger_id: ledger, category_id: mercado, month: '2026-05-01', limit_cents: 80000 }])

    expect((await bia.post(`/orcamentos/${ledger}/metas/copiar?mes=2026-06`)).corpo.copiadas).toBe(1)
    expect((await ana.get(`/orcamentos/${ledger}/metas?mes=2026-06`)).corpo).toHaveLength(1)

    await ana.put(`/orcamentos/${ledger}/metas/${mercado}?mes=2026-06`, { limite_cents: 0 })
    expect((await ana.get(`/orcamentos/${ledger}/metas?mes=2026-06`)).corpo).toEqual([])
  })

  test('virada de ano no copiar (dez → jan)', async () => {
    await ana.put(`/orcamentos/${ledger}/metas/${mercado}?mes=2026-12`, { limite_cents: 100 })
    expect((await ana.post(`/orcamentos/${ledger}/metas/copiar?mes=2027-01`)).corpo.copiadas).toBe(1)
  })

  test('categoria de outro orçamento: 400', async () => {
    const outro = (await estranho.get('/orcamentos')).corpo[0].id
    const catAlheia = (await estranho.get(`/orcamentos/${outro}/categorias`)).corpo[0].id
    expect((await ana.put(`/orcamentos/${ledger}/metas/${catAlheia}?mes=2026-05`, { limite_cents: 1 })).status).toBe(400)
  })
})

describe('sair', () => {
  test('quem sai perde o acesso na hora', async () => {
    expect((await bia.del(`/orcamentos/${ledger}/membros/eu`)).status).toBe(200)
    expect((await bia.get(`/orcamentos/${ledger}/categorias`)).status).toBe(404)
    expect((await ana.get(`/orcamentos/${ledger}/membros`)).corpo).toHaveLength(1)
  })
})
