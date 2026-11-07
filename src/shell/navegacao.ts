import type { NomeIcone } from '@/lib/icones'

// Todas as vistas do app. As 4 primeiras são abas da nav; o resto mora dentro
// de "Mais" (no desktop aparecem direto na sidebar).
export type Vista =
  | 'inicio'
  | 'mes'
  | 'analises'
  | 'mais'
  | 'metas'
  | 'recorrentes'
  | 'historico'
  | 'busca'
  | 'config'
  | 'perfil'

export type ItemVista = { id: Vista; rotulo: string; icone: NomeIcone; descricao?: string }

export const ABAS: ItemVista[] = [
  { id: 'inicio', rotulo: 'Início', icone: 'home' },
  { id: 'mes', rotulo: 'Mês', icone: 'calendar' },
  { id: 'analises', rotulo: 'Análises', icone: 'pieChart' },
  { id: 'mais', rotulo: 'Mais', icone: 'more' },
]

export const ITENS_MAIS: ItemVista[] = [
  { id: 'metas', rotulo: 'Metas', icone: 'target', descricao: 'Teto por categoria e objetivos' },
  { id: 'recorrentes', rotulo: 'Recorrentes', icone: 'repeat', descricao: 'Contas que se repetem todo mês' },
  { id: 'historico', rotulo: 'Histórico', icone: 'history', descricao: 'O que mudou e quem mudou' },
  { id: 'busca', rotulo: 'Busca', icone: 'search', descricao: 'Achar qualquer lançamento' },
  { id: 'config', rotulo: 'Configurações', icone: 'settings', descricao: 'Categorias, membros e convite' },
  { id: 'perfil', rotulo: 'Perfil', icone: 'user', descricao: 'Seu nome, tema e notificações' },
]

/** Qual aba fica acesa: as vistas de dentro do Mais acendem "Mais". */
export function abaDe(v: Vista): Vista {
  return ITENS_MAIS.some((i) => i.id === v) ? 'mais' : v
}

export function rotuloDe(v: Vista): string {
  return [...ABAS, ...ITENS_MAIS].find((i) => i.id === v)?.rotulo ?? ''
}
