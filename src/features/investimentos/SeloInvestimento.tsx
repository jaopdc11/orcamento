import { Icone, cx } from '@/design'

/**
 * Marca de "aporte/resgate de investimento" na linha de lançamento do mês.
 * Só ícone + title, como o SeloRecorrente: a linha do celular não tem espaço.
 */
export function SeloInvestimento({ className = '' }: { className?: string }) {
  return (
    <span
      title="Investimento: toque para abrir"
      aria-label="investimento"
      className={cx('inline-flex shrink-0 items-center text-tenue', className)}
    >
      <Icone n="trendingUp" className="h-3 w-3" />
    </span>
  )
}

/** Evento que o App ouve pra trocar pra tela de Investimentos com a ficha aberta. */
export const EVENTO_ABRIR_INVESTIMENTO = 'orcamento:abrir-investimento'

export function abrirInvestimento(id: string): void {
  window.dispatchEvent(new CustomEvent(EVENTO_ABRIR_INVESTIMENTO, { detail: id }))
}
