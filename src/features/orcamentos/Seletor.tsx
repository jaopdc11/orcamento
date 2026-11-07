import { useEffect, useRef, useState } from 'react'
import { aceitarConvite, criarOrcamento } from './orcamentos.queries'
import type { Orcamento } from '@/lib/tipos'

export type Props = {
  orcamentos: Orcamento[]
  atualId: string
  /** troca o orçamento aberto — só estado, sem deslogar */
  aoTrocar: (id: string) => void
  /** criou ou entrou com código: o App relê a lista e abre este */
  aoEntrarEmNovo: (id: string) => void
}

type Modo = 'lista' | 'criar' | 'entrar'

// Botão com o nome do orçamento atual que abre um painel: lista pra troca
// instantânea + criar/entrar inline. Inline (não tela cheia) pra trocar ser um
// toque só, sem perder o lugar onde se estava no app.
// As props são fixadas pelo App.tsx (fundação): não mude a assinatura.
export function Seletor({ orcamentos, atualId, aoTrocar, aoEntrarEmNovo }: Props) {
  const [aberto, setAberto] = useState(false)
  const [modo, setModo] = useState<Modo>('lista')
  const [texto, setTexto] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const raiz = useRef<HTMLDivElement>(null)

  const atual = orcamentos.find((o) => o.id === atualId)

  function fechar() {
    setAberto(false)
    setModo('lista')
    setTexto('')
    setErro(null)
  }

  // Fecha ao clicar fora ou apertar Esc — comportamento esperado de menu.
  useEffect(() => {
    if (!aberto) return
    const clique = (e: MouseEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) fechar()
    }
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && fechar()
    document.addEventListener('mousedown', clique)
    document.addEventListener('keydown', tecla)
    return () => {
      document.removeEventListener('mousedown', clique)
      document.removeEventListener('keydown', tecla)
    }
  }, [aberto])

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setOcupado(true)
    setErro(null)
    try {
      const id = modo === 'criar' ? await criarOrcamento(texto.trim()) : await aceitarConvite(texto.trim())
      fechar()
      aoEntrarEmNovo(id)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu certo.')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div ref={raiz} className="relative w-full min-w-0">
      <button
        onClick={() => (aberto ? fechar() : setAberto(true))}
        aria-label="Trocar de orçamento"
        aria-expanded={aberto}
        className="flex w-full min-w-0 items-center gap-1 text-left text-base font-semibold text-gray-900 outline-none dark:text-white"
      >
        <span className="truncate">{atual?.nome ?? 'Orçamento'}</span>
        <span className={`shrink-0 text-xs text-gray-400 transition-transform ${aberto ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {aberto && (
        <div className="absolute left-0 top-full z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-800 dark:bg-gray-900">
          <ul className="max-h-64 overflow-y-auto">
            {orcamentos.map((o) => (
              <li key={o.id}>
                <button
                  onClick={() => {
                    fechar()
                    if (o.id !== atualId) aoTrocar(o.id)
                  }}
                  className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm ${
                    o.id === atualId
                      ? 'bg-gray-100 font-semibold text-gray-900 dark:bg-gray-800 dark:text-white'
                      : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800/60'
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate">{o.nome}</span>
                  {o.id === atualId && <span className="text-primaria">✓</span>}
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-1 border-t border-gray-100 pt-1 dark:border-gray-800">
            {modo === 'lista' ? (
              <div className="flex gap-1">
                {(['criar', 'entrar'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setModo(m)}
                    className="flex-1 rounded-md px-2 py-2 text-xs font-semibold text-primaria hover:bg-gray-50 dark:hover:bg-gray-800/60"
                  >
                    {m === 'criar' ? '+ Criar novo' : 'Entrar com código'}
                  </button>
                ))}
              </div>
            ) : (
              <form onSubmit={enviar} className="flex flex-col gap-2 p-2">
                <input
                  required
                  autoFocus
                  value={texto}
                  onChange={(e) => setTexto(modo === 'entrar' ? e.target.value.toUpperCase() : e.target.value)}
                  placeholder={modo === 'criar' ? 'Nome (ex: Viagem)' : 'ABCD-1234'}
                  maxLength={modo === 'criar' ? 80 : 12}
                  autoCapitalize={modo === 'entrar' ? 'characters' : undefined}
                  spellCheck={false}
                  className={`w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-primaria dark:border-gray-700 dark:bg-gray-950 dark:text-white ${
                    modo === 'entrar' ? 'text-center tracking-[0.2em]' : ''
                  }`}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setModo('lista')
                      setTexto('')
                      setErro(null)
                    }}
                    className="flex-1 py-1.5 text-xs text-gray-400"
                  >
                    voltar
                  </button>
                  <button
                    type="submit"
                    disabled={ocupado || !texto.trim()}
                    className="flex-1 rounded-md bg-primaria py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {ocupado ? '…' : modo === 'criar' ? 'Criar' : 'Entrar'}
                  </button>
                </div>
                {erro && <p className="text-xs text-saida">{erro}</p>}
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
