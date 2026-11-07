// Utilitários sem JSX do sistema de design.

/** Junta classes ignorando falsy — evita `${a ? 'x' : ''}` espalhado. */
export function cx(...partes: Array<string | number | boolean | null | undefined>): string {
  return partes.filter(Boolean).join(' ')
}

/** true se o usuário pediu menos movimento (Contador/Barra checam no JS). */
export function prefereParado(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

export type TipoVibracao = 'leve' | 'sucesso' | 'aviso' | 'erro'

const PADROES: Record<TipoVibracao, number | number[]> = {
  leve: 8,
  sucesso: 18, // lançou/salvou: um toque curto, não um alarme
  aviso: [12, 60, 12], // apagou: dois toques
  erro: [30, 50, 30],
}

/** Vibração curta de confirmação. No-op onde não existe (iOS, desktop) ou em reduced-motion. */
export function vibrar(tipo: TipoVibracao = 'leve'): void {
  try {
    if (prefereParado()) return
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(PADROES[tipo])
  } catch {
    /* alguns navegadores lançam fora de gesto do usuário — irrelevante */
  }
}

/*
 * Cor estável por categoria: hash do id (ou nome) numa paleta de 8 tons sóbrios
 * que funcionam no escuro E no claro (nível ~400 do Tailwind, nada neon).
 * Estável = a mesma categoria tem a mesma cor no gráfico, na linha e no ícone,
 * em todo aparelho, sem guardar nada.
 */
export const PALETA_CATEGORIAS = [
  '#2dd4bf', // teal
  '#60a5fa', // azul
  '#a78bfa', // violeta
  '#f472b6', // rosa
  '#fbbf24', // âmbar
  '#4ade80', // verde
  '#fb923c', // laranja
  '#94a3b8', // ardósia
] as const

function hash(s: string): number {
  // FNV-1a 32 bits: curto, determinístico e espalha bem strings parecidas (uuid)
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export type CorCategoria = {
  /** cor cheia (hex) — traço, fatia de gráfico, ponto de legenda */
  cor: string
  /** mesma cor a 16% — fundo do IconeCategoria, chip tintado */
  tinta: string
}

export function corDaCategoria(idOuNome: string | null | undefined, corPropria?: string | null): CorCategoria {
  // categoria com cor escolhida pelo usuário (campo `cor`) ganha; senão, hash
  const cor =
    corPropria && /^#[0-9a-f]{6}$/i.test(corPropria)
      ? corPropria
      : PALETA_CATEGORIAS[hash(idOuNome ?? '') % PALETA_CATEGORIAS.length]!
  return { cor, tinta: `${cor}29` }
}

/** Cores dos gráficos (recharts) lidas dos tokens — use estas, não hex solto. */
export const CORES_GRAFICO = {
  entrada: 'rgb(var(--entrada))',
  saida: 'rgb(var(--saida))',
  acento: 'rgb(var(--acento))',
  atencao: 'rgb(var(--atencao))',
  grade: 'rgb(var(--borda))',
  eixo: 'rgb(var(--texto-tenue))',
  texto: 'rgb(var(--texto))',
  superficie: 'rgb(var(--superficie-alta))',
} as const

// Estilo único dos tooltips do recharts: tokens via CSS var, então o tema
// troca sem re-render. Fonte mono porque o conteúdo é sempre número.
export const TOOLTIP_GRAFICO = {
  contentStyle: {
    background: 'rgb(var(--superficie-alta))',
    border: '1px solid rgb(var(--borda))',
    borderRadius: 12,
    fontSize: 12,
    color: 'rgb(var(--texto))',
    fontFamily: 'JetBrains Mono Variable, monospace',
  },
  itemStyle: { color: 'rgb(var(--texto))' },
  labelStyle: { color: 'rgb(var(--texto-suave))', marginBottom: 2 },
  cursor: { fill: 'rgb(var(--superficie-alta) / 0.5)' },
}

// Rótulo de eixo: mono e tênue pra não brigar com as séries.
export const TICK_GRAFICO = { fill: CORES_GRAFICO.eixo, fontSize: 11, fontFamily: 'JetBrains Mono Variable, monospace' }

// Cor de membro pela posição na lista do orçamento: a mesma pessoa tem a mesma
// cor em todas as telas enquanto a ordem dos membros não mudar.
export function corDoMembro(indice: number): string {
  return PALETA_CATEGORIAS[indice % PALETA_CATEGORIAS.length]!
}
