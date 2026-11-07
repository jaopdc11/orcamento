import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icone } from '@/lib/icones'
import { cx } from './util'

export type TomToast = 'sucesso' | 'erro' | 'info'
type Item = { id: number; texto: ReactNode; tom: TomToast; acao?: { rotulo: string; aoTocar: () => void } }

export type OpcoesToast = { tom?: TomToast; acao?: Item['acao']; duracaoMs?: number }
type Ctx = { mostrar: (texto: ReactNode, opcoes?: OpcoesToast) => void }

// Sem provider (fumaça, tela isolada) o toast vira no-op em vez de quebrar.
const ContextoToast = createContext<Ctx>({ mostrar: () => {} })

/** `const toast = useToast(); toast.mostrar('Lançado')` */
export function useToast(): Ctx {
  return useContext(ContextoToast)
}

/** Envolve o app uma vez (o App.tsx já faz). */
export function ProvedorToast({ children }: { children: ReactNode }) {
  const [itens, setItens] = useState<Item[]>([])
  const seq = useRef(0)

  const tirar = useCallback((id: number) => setItens((l) => l.filter((i) => i.id !== id)), [])

  const mostrar = useCallback(
    (texto: ReactNode, { tom = 'sucesso', acao, duracaoMs = 2600 }: OpcoesToast = {}) => {
      const id = ++seq.current
      // no máximo 2 empilhados: toast é confirmação, não log
      setItens((l) => [...l.slice(-1), { id, texto, tom, acao }])
      setTimeout(() => tirar(id), duracaoMs)
    },
    [tirar],
  )

  const valor = useMemo(() => ({ mostrar }), [mostrar])

  return (
    <ContextoToast.Provider value={valor}>
      {children}
      {typeof document !== 'undefined' &&
        createPortal(
          // acima da nav inferior no celular; canto inferior no desktop
          <div
            aria-live="polite"
            className="pointer-events-none fixed inset-x-0 z-[60] flex flex-col items-center gap-2 px-4 bottom-[calc(theme(spacing.nav)+env(safe-area-inset-bottom)+0.75rem)] lg:bottom-6 lg:left-auto lg:right-6 lg:items-end"
          >
            {itens.map((i) => (
              <div
                key={i.id}
                role="status"
                className="pointer-events-auto flex w-full max-w-sm animate-toast items-center gap-3 rounded-card border border-borda bg-superficie-alta px-4 py-3 text-sm text-texto shadow-flutuante"
              >
                <span
                  className={cx(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
                    i.tom === 'sucesso' && 'bg-tinta-entrada text-entrada',
                    i.tom === 'erro' && 'bg-tinta-perigo text-perigo',
                    i.tom === 'info' && 'bg-tinta-acento text-acento',
                  )}
                >
                  <Icone n={i.tom === 'erro' ? 'alert' : 'check'} className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1">{i.texto}</span>
                {i.acao && (
                  <button
                    type="button"
                    onClick={() => {
                      i.acao!.aoTocar()
                      tirar(i.id)
                    }}
                    className="-my-2 min-h-11 shrink-0 px-1 text-sm font-semibold text-acento"
                  >
                    {i.acao.rotulo}
                  </button>
                )}
              </div>
            ))}
          </div>,
          document.body,
        )}
    </ContextoToast.Provider>
  )
}
