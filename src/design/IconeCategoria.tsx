import { corDaCategoria, cx } from './util'

export type PropsIconeCategoria = {
  /** a categoria (ou só id/nome/emoji). Sem categoria = "•" neutro. */
  categoria?: { id?: string; nome?: string; emoji?: string | null; cor?: string | null } | null
  tamanho?: 'sm' | 'md' | 'lg'
  className?: string
}

const TAMANHOS = { sm: 'h-8 w-8 text-base rounded-[9px]', md: 'h-10 w-10 text-lg rounded-[10px]', lg: 'h-12 w-12 text-xl rounded-card' }

/** Emoji da categoria num quadrado tintado pela cor estável dela. */
export function IconeCategoria({ categoria, tamanho = 'md', className }: PropsIconeCategoria) {
  const { tinta, cor } = corDaCategoria(categoria?.id ?? categoria?.nome, categoria?.cor)
  return (
    <span
      aria-hidden
      className={cx('inline-flex shrink-0 items-center justify-center leading-none', TAMANHOS[tamanho], !categoria && 'bg-superficie-alta text-tenue', className)}
      style={categoria ? { backgroundColor: tinta, boxShadow: `inset 0 0 0 1px ${cor}33` } : undefined}
    >
      {categoria?.emoji || (categoria?.nome ? categoria.nome.slice(0, 1).toUpperCase() : '•')}
    </span>
  )
}
