import { sql } from './db'
// Embutidas no binário pelo `bun build --compile`: a VPS não precisa da pasta migrations/.
import m0001 from '../migrations/0001_schema.sql' with { type: 'text' }
import m0002 from '../migrations/0002_funcoes.sql' with { type: 'text' }

const MIGRATIONS: [string, string][] = [
  ['0001_schema', m0001],
  ['0002_funcoes', m0002],
]

/** Aplica as que faltam, cada uma na própria transação. Rodar de novo não faz nada. */
export async function migrar(log = console.log): Promise<void> {
  await sql`
    create table if not exists schema_migrations (
      nome text primary key,
      aplicada_em timestamptz not null default now()
    )
  `
  const feitas = new Set(
    (await sql`select nome from schema_migrations`).map((l: { nome: string }) => l.nome),
  )

  for (const [nome, texto] of MIGRATIONS) {
    if (feitas.has(nome)) continue
    await sql.begin(async (tx) => {
      await tx.unsafe(texto)
      await tx`insert into schema_migrations (nome) values (${nome})`
    })
    log(`[migrar] aplicada ${nome}`)
  }
}

if (import.meta.main) {
  await migrar()
  console.log('[migrar] banco em dia')
  await sql.close()
}
