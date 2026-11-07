import { Selo, Sheet } from '@/design'
import { AJUDA_ATALHOS } from '@/lib/atalhos'

/** Lista dos atalhos de teclado (tecla ?). A fonte é AJUDA_ATALHOS em lib/atalhos. */
export function AjudaAtalhos({ aberto, aoFechar }: { aberto: boolean; aoFechar: () => void }) {
  return (
    <Sheet aberto={aberto} aoFechar={aoFechar} selo="Teclado" titulo="Atalhos" largura="sm">
      <div className="space-y-5">
        {AJUDA_ATALHOS.map((g) => (
          <section key={g.grupo}>
            <Selo className="mb-2">{g.grupo}</Selo>
            <ul className="divide-y divide-borda rounded-card border border-borda">
              {g.itens.map(([tecla, oQue]) => (
                <li key={tecla} className="flex items-center justify-between gap-4 px-3.5 py-2.5 text-sm">
                  <span className="text-suave">{oQue}</span>
                  <kbd className="shrink-0 rounded-md border border-borda-forte bg-campo px-2 py-0.5 font-mono text-xs text-texto">
                    {tecla}
                  </kbd>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Sheet>
  )
}
