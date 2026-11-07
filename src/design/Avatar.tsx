import { cx } from './util'

// Avatar de iniciais. Sem foto no produto; as iniciais bastam pra distinguir
// 2-4 pessoas de um orçamento.
export function iniciais(texto: string): string {
  const base = texto.includes('@') ? texto.split('@')[0]! : texto
  const partes = base.replace(/[._-]+/g, ' ').trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  if (partes.length === 1) return partes[0]!.slice(0, 2).toUpperCase()
  return (partes[0]![0]! + partes[partes.length - 1]![0]!).toUpperCase()
}

export function Avatar({ nome, tamanho = 'md', destaque = false }: { nome: string; tamanho?: 'md' | 'lg'; destaque?: boolean }) {
  return (
    <span
      aria-hidden
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-full font-display font-semibold',
        destaque ? 'bg-tinta-acento text-acento' : 'bg-superficie-alta text-suave',
        tamanho === 'lg' ? 'h-16 w-16 text-xl' : 'h-10 w-10 text-sm',
      )}
    >
      {iniciais(nome)}
    </span>
  )
}
