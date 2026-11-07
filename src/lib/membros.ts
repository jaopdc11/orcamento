import type { Membro } from './tipos'

/**
 * Como um membro aparece na tela: apelido do orçamento → nome global → começo
 * do e-mail. Um lugar só, pra autoria, acerto e análises falarem igual.
 */
export function nomeDoMembro(m: Membro | undefined, usuarioId?: string): string {
  if (!m) return 'ex-membro'
  const nome = m.apelido?.trim() || m.nome?.trim() || m.email.split('@')[0] || 'alguém'
  return usuarioId && m.user_id === usuarioId ? `${nome} (você)` : nome
}

export function mapaDeMembros(membros: readonly Membro[]): Map<string, Membro> {
  return new Map(membros.map((m) => [m.user_id, m]))
}
