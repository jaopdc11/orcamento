import { useState } from 'react'
import { Botao, Cartao, Icone, Selo, useToast, vibrar } from '@/design'
import { formatarCodigo } from './orcamentos.queries'
import type { Convite } from '@/lib/tipos'

// Convite pendente: o código GRANDE em mono (é pra ser lido em voz alta ou
// copiado), copiar e cancelar sempre visíveis. Usado em Config e Membros.
export function CartaoConvite({ convite, aoCancelar }: { convite: Convite; aoCancelar: () => Promise<unknown> | void }) {
  const toast = useToast()
  const [copiado, setCopiado] = useState(false)
  const [cancelando, setCancelando] = useState(false)
  const codigo = formatarCodigo(convite.code)

  async function copiar() {
    try {
      await navigator.clipboard.writeText(codigo)
      setCopiado(true)
      vibrar('leve')
      toast.mostrar('Código copiado', { tom: 'info' })
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      // clipboard bloqueada (http, permissão): o código está na tela, dá pra ler.
    }
  }

  return (
    <Cartao className="animate-scale-in">
      <div className="flex items-start justify-between gap-2">
        <Selo>Código de convite</Selo>
        <span className="font-mono text-xs text-tenue">
          vence {new Date(convite.expires_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
        </span>
      </div>
      <button
        type="button"
        onClick={() => void copiar()}
        aria-label={`Copiar código ${codigo}`}
        className="mt-3 block w-full rounded-card border border-dashed border-borda-forte bg-campo py-4 text-center font-mono text-3xl font-semibold tracking-[0.2em] text-texto transition-transform duration-150 ease-suave active:scale-[0.97]"
      >
        {codigo}
      </button>
      <div className="mt-3 flex gap-2">
        <Botao
          variante="secundario"
          className="flex-1"
          icone={<Icone n={copiado ? 'check' : 'list'} />}
          onClick={() => void copiar()}
        >
          {copiado ? 'Copiado' : 'Copiar'}
        </Botao>
        <Botao
          variante="fantasma"
          className="flex-1"
          carregando={cancelando}
          onClick={async () => {
            setCancelando(true)
            try {
              await aoCancelar()
            } finally {
              setCancelando(false)
            }
          }}
        >
          Cancelar convite
        </Botao>
      </div>
    </Cartao>
  )
}
