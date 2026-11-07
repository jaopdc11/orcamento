// Tipos de saída da API (snake_case). Espelho de orcamento-api/docs/CONTRATO.md:
// mudou lá, muda aqui. Exceção histórica: Usuario (camelCase) vem de lib/api.ts.

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
  updated_at: string
  updated_by: string | null // quem editou por último (F1); null = nunca editado
  deleted_at: string | null
  deleted_by: string | null
  recurring_id: string | null // gerado por recorrente (F7)
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
  apelido: string | null // por orçamento
  nome: string | null // nome de exibição global (F5)
  email: string
  proporcao: number // peso no acerto (F6), padrão 1
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

// ---------------------------------------------------------------------------
// v2 — um bloco por feature (dono entre parênteses)
// ---------------------------------------------------------------------------

/** O que toda tela de orçamento recebe do App. */
export type ContextoOrcamento = {
  orcamento: Orcamento
  usuarioId: string
  membros: Membro[]
  categorias: Categoria[] // só ativas
  ocultar: boolean
}

/** 'eu' | <user_id de um membro> | 'conjunto' */
export type Escopo = 'eu' | 'conjunto' | (string & {})

// (F1) histórico + edição

export type TipoAtividade =
  | 'orcamento.criado'
  | 'orcamento.renomeado'
  | 'membro.entrou'
  | 'membro.saiu'
  | 'membro.removido'
  | 'membro.proporcao'
  | 'convite.criado'
  | 'lancamento.criado'
  | 'lancamento.editado'
  | 'lancamento.apagado'
  | 'categoria.criada'
  | 'categoria.editada'
  | 'categoria.arquivada'
  | 'categoria.desarquivada'
  | 'categorias.reordenadas'
  | 'meta.definida'
  | 'meta.removida'
  | 'metas.copiadas'
  | 'economia.definida'
  | 'economia.removida'
  | 'recorrente.criado'
  | 'recorrente.editado'
  | 'recorrente.removido'

export type EntidadeAtividade =
  | 'orcamento'
  | 'membro'
  | 'convite'
  | 'lancamento'
  | 'categoria'
  | 'meta'
  | 'economia'
  | 'recorrente'

export type Atividade = {
  id: string
  ledger_id: string
  user_id: string
  tipo: TipoAtividade
  entidade: EntidadeAtividade
  entidade_id: string | null
  resumo: string
  dados: unknown | null
  created_at: string
}

export type PaginaHistorico = { itens: Atividade[]; proximo: string | null }

/** Corpo do PUT /lancamentos/:id — só o que mudou. */
export type EdicaoLancamento = Partial<{
  category_id: string | null
  kind: Especie
  amount_cents: number
  occurred_on: string
  descricao: string | null
  paid_by: string | null
}>

// (F3) meta de economia

export type Economia = {
  mes: string // 'YYYY-MM'
  target_cents: number | null
  entrou_cents: number
  saiu_cents: number
  guardado_cents: number // entrou − saiu
}

// (F4) análises

export type FatiaCategoria = {
  category_id: string | null
  nome: string
  emoji: string | null
  cor: string | null
  total_cents: number
}

export type AnaliseCategorias = {
  mes: string
  escopo: Escopo
  kind: Especie
  total_cents: number
  itens: FatiaCategoria[]
}

export type PontoEvolucao = { mes: string; entrou_cents: number; saiu_cents: number; saldo_cents: number }

export type AnaliseEvolucao = { escopo: Escopo; itens: PontoEvolucao[] }

export type GastoMembro = { user_id: string; entrou_cents: number; saiu_cents: number }

export type AnaliseMembros = { mes: string; escopo: Escopo; itens: GastoMembro[] }

// (F5) perfil

export type Perfil = { usuario_id: string; email: string; nome: string | null }

// (F6) acerto

export type AcertoMembro = {
  user_id: string
  proporcao: number
  parte_cents: number
  pagou_cents: number
  saldo_cents: number // > 0 tem a receber; < 0 deve
}

export type Transferencia = { de: string; para: string; valor_cents: number }

export type Acerto = {
  mes: string
  total_cents: number
  membros: AcertoMembro[]
  transferencias: Transferencia[]
}

// (F7) recorrentes

export type Recorrente = {
  id: string
  ledger_id: string
  descricao: string
  amount_cents: number
  kind: Especie
  category_id: string | null
  paid_by: string | null
  dia_do_mes: number // 1..28
  ativo: boolean
  inicio: string // 'YYYY-MM'
  created_by: string
  created_at: string
}

// (F8) busca + push

export type FiltroBusca = {
  q?: string
  category_id?: string
  membro?: string // 'eu' | user_id
  de?: string // 'YYYY-MM-DD'
  ate?: string // inclusivo
  kind?: Especie
  limite?: number
  cursor?: string
}

export type ResultadoBusca = {
  itens: Lancamento[]
  proximo: string | null
  entrou_cents: number
  saiu_cents: number
}

export type ChavePublica = { chave: string | null }
