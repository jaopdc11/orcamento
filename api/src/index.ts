import { config } from './config'

// Um binário só pra duas tarefas (cada binário do Bun carrega ~100 MB de runtime):
//   orcamento-api           → servidor
//   orcamento-api migrar    → aplica as migrations e sai
if (process.argv[2] === 'migrar') {
  const { migrar } = await import('./migrar')
  const { sql } = await import('./db')
  await migrar()
  console.log('[migrar] banco em dia')
  await sql.close()
  process.exit(0)
}

const { app } = await import('./app')

if (config.emailsPermitidos.size === 0) {
  console.warn('[api] EMAILS_PERMITIDOS vazio: ninguém consegue logar.')
}
if (!config.resendApiKey) {
  console.warn('[api] RESEND_API_KEY vazio: o envio de código vai falhar.')
}

// Só localhost: quem fala com a internet é o Caddy.
const servidor = Bun.serve({
  hostname: '127.0.0.1',
  port: config.porta,
  fetch: app.fetch,
})

console.log(`[api] ouvindo em http://${servidor.hostname}:${servidor.port}`)
