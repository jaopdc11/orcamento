export type Especie = 'expense' | 'income'

export type Categoria = {
  id: string
  ledger_id: string
  nome: string
  kind: Especie
  emoji: string | null
  cor: string | null
  ordem: number
  archived_at: string | null
}

export type Lancamento = {
  id: string
  ledger_id: string
  category_id: string | null
  kind: Especie
  amount_cents: number
  signed_cents: number
  occurred_on: string // 'YYYY-MM-DD'
  descricao: string | null
  paid_by: string | null
  created_by: string
  created_at: string
  deleted_at: string | null
}

/** O que a fila guarda e o que o insert manda. Sem as colunas geradas pelo banco. */
export type LancamentoNovo = {
  id: string
  ledger_id: string
  category_id: string | null
  kind: Especie
  amount_cents: number
  occurred_on: string
  descricao: string | null
  paid_by: string | null
  created_by: string
  client_created_at: string
}

export type Membro = {
  ledger_id: string
  user_id: string
  apelido: string | null
}

export type Orcamento = {
  id: string
  nome: string
  created_at: string
}

export type Meta = {
  ledger_id: string
  category_id: string
  month: string // 'YYYY-MM-01'
  limit_cents: number
}

export type Convite = {
  code: string
  ledger_id: string
  criado_por: string
  expires_at: string
  used_at: string | null
  used_by: string | null
  created_at: string
}
