import { SQL } from 'bun'
import { config } from './config'

// Pegadinhas do Bun.sql que o SQL das rotas trata com cast explícito:
//   - bigint (int8) volta como STRING  → `::float8` (centavos cabem com folga em 2^53)
//   - date volta como Date à meia-noite UTC → `::text` dá o 'YYYY-MM-DD' que o front espera
// timestamptz volta como Date e o JSON serializa em ISO, que é o que o front já lia.
export const sql = config.databaseUrl
  ? new SQL(config.databaseUrl)
  : new SQL({
      path: config.pgSocket,
      database: config.pgBanco,
      username: config.pgUsuario,
      max: 5,
    })

/** Mensagem de `raise exception` das funções SQL (SQLSTATE P0001). */
export function mensagemDeNegocio(erro: unknown): string | null {
  if (erro instanceof SQL.PostgresError && erro.errno === 'P0001') return erro.message
  return null
}
