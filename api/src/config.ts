// Toda configuração vem do ambiente. Na VPS: /etc/orcamento/env (EnvironmentFile do systemd).

function lista(valor: string | undefined): string[] {
  return (valor ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

export const config = {
  porta: Number(process.env.PORT ?? 8001),

  // Sem DATABASE_URL, conecta pelo socket unix como o usuário de sistema que
  // roda o processo (peer auth): nenhuma senha existe pra vazar.
  databaseUrl: process.env.DATABASE_URL,
  pgSocket: process.env.PGHOST ?? '/var/run/postgresql',
  pgBanco: process.env.PGDATABASE ?? 'orcamento',
  pgUsuario: process.env.PGUSER ?? 'orcamento',

  // Origens do front autorizadas (CORS e checagem de Origin nas escritas).
  origens: lista(process.env.ORIGEM ?? 'https://orcamento.jaopd.dev'),

  // Só esses e-mails recebem código. Sem isso, qualquer um usaria o Resend pra spam
  // e criaria conta no app.
  emailsPermitidos: new Set(lista(process.env.EMAILS_PERMITIDOS)),

  resendApiKey: process.env.RESEND_API_KEY ?? '',
  emailRemetente: process.env.EMAIL_REMETENTE ?? 'Orçamento <orcamento@orcamento.jaopd.dev>',

  // Em dev (http://localhost) o cookie não pode ser Secure... na teoria. Chrome e
  // Firefox tratam localhost como contexto seguro, então Secure funciona lá também.
  // Fica configurável só pra testes.
  cookieSeguro: process.env.COOKIE_SEGURO !== '0',
}
