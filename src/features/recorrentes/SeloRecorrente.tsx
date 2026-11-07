import { Icone } from '@/lib/icones'

/**
 * Marca de "veio de recorrente" pra linha de lançamento do mês. Exportado pra
 * o Dashboard (F1) usar: `{l.recurring_id && <SeloRecorrente />}`.
 * Só ícone + title: a linha do celular não tem espaço pra texto.
 */
export function SeloRecorrente({ className = '' }: { className?: string }) {
  return (
    <span
      title="Lançamento recorrente"
      aria-label="recorrente"
      className={`inline-flex shrink-0 items-center text-apagado ${className}`}
    >
      <Icone n="repeat" className="h-3 w-3" />
    </span>
  )
}
