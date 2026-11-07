import { formatar, formatarSeco } from '@/lib/dinheiro'
import { Contador } from './Contador'
import { cx } from './util'

export type TipoValor = 'entrada' | 'saida' | 'neutro' | 'auto'
export type TamanhoValor = 'sm' | 'md' | 'lg' | 'heroi'

export type PropsValor = {
  /** SEMPRE inteiro de centavos (ver lib/dinheiro.ts) */
  centavos: number
  /**
   * entrada = verde com "+", saida = rosa com "−", neutro = cor do texto,
   * auto = pelo sinal do número (saldo).
   */
  tipo?: TipoValor
  /** mostra +/− explícito (padrão: só em entrada/saida) */
  sinal?: boolean
  tamanho?: TamanhoValor
  /** modo "ocultar valores" do App: troca por bolinhas */
  ocultar?: boolean
  /** número que corre (use só no valor herói) */
  animar?: boolean
  /** sem "R$" (coluna alinhada) */
  semMoeda?: boolean
  className?: string
}

const TAMANHOS: Record<TamanhoValor, string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-xl font-semibold',
  heroi: 'text-4xl font-semibold tracking-tight sm:text-5xl',
}

const OCULTO = '••••'

/** Todo dinheiro do app passa por aqui: mono, tabular, cor/sinal por tipo. */
export function Valor({ centavos, tipo = 'neutro', sinal, tamanho = 'md', ocultar = false, animar = false, semMoeda = false, className }: PropsValor) {
  const efetivo: Exclude<TipoValor, 'auto'> = tipo === 'auto' ? (centavos < 0 ? 'saida' : centavos > 0 ? 'entrada' : 'neutro') : tipo
  const mostraSinal = sinal ?? (tipo === 'entrada' || tipo === 'saida')
  const prefixo = mostraSinal && centavos !== 0 ? (efetivo === 'saida' ? '−' : efetivo === 'entrada' ? '+' : '') : ''
  const abs = Math.abs(centavos)
  const fmt = (n: number) => prefixo + (semMoeda ? formatarSeco(n) : formatar(n))

  const cor = efetivo === 'entrada' ? 'text-entrada' : efetivo === 'saida' ? 'text-saida' : 'text-texto'
  const classe = cx('font-mono tabular-nums whitespace-nowrap', TAMANHOS[tamanho], cor, className)

  if (ocultar) {
    return (
      <span className={classe} aria-label="valor oculto">
        {semMoeda ? OCULTO : `R$ ${OCULTO}`}
      </span>
    )
  }
  if (animar) return <Contador valor={abs} formatar={fmt} className={classe} />
  return <span className={classe}>{fmt(abs)}</span>
}
