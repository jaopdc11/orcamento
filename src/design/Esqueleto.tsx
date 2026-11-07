import { cx } from './util'

/** Bloco de carregamento. Dê a forma do conteúdo que vem (altura/largura), não um spinner. */
export function Esqueleto({ className }: { className?: string }) {
  return <div aria-hidden className={cx('esqueleto rounded-md', className ?? 'h-4 w-full')} />
}

/** N linhas de lista carregando (ícone + 2 linhas de texto + valor). */
export function EsqueletoLista({ linhas = 4 }: { linhas?: number }) {
  return (
    <div aria-busy="true" aria-label="carregando" className="divide-y divide-borda">
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <Esqueleto className="h-10 w-10 rounded-[10px]" />
          <div className="flex-1 space-y-2">
            <Esqueleto className="h-3.5 w-2/5" />
            <Esqueleto className="h-3 w-1/4" />
          </div>
          <Esqueleto className="h-4 w-16" />
        </div>
      ))}
    </div>
  )
}
