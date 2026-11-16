import { Icone, cx } from '@/design'

/**
 * Marca de "aporte/resgate de investimento" na linha de lançamento do mês.
 * Só ícone + title, como o SeloRecorrente: a linha do celular não tem espaço.
 */
export function SeloInvestimento({ className = '' }: { className?: string }) {
  return (
    <span
      title="Investimento: altere pela tela de Investimentos"
      aria-label="investimento"
      className={cx('inline-flex shrink-0 items-center text-tenue', className)}
    >
      <Icone n="trendingUp" className="h-3 w-3" />
    </span>
  )
}
