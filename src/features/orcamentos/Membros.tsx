import { useCallback, useEffect, useState } from 'react'
import {
  membrosDo,
  criarConvite,
  convitesPendentes,
  cancelarConvite,
  formatarCodigo,
} from './orcamentos.queries'
import type { Convite, Membro, Orcamento } from '@/lib/tipos'

type Props = {
  orcamento: Orcamento
  usuarioId: string
  aoFechar: () => void
}

export function Membros({ orcamento, usuarioId, aoFechar }: Props) {
  const [membros, setMembros] = useState<Membro[]>([])
  const [convites, setConvites] = useState<Convite[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [gerando, setGerando] = useState(false)
  const [copiado, setCopiado] = useState<string | null>(null)

  const recarregar = useCallback(async () => {
    try {
      const [m, c] = await Promise.all([
        membrosDo(orcamento.id),
        convitesPendentes(orcamento.id),
      ])
      setMembros(m)
      setConvites(c)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falhou ao carregar.')
    }
  }, [orcamento.id])

  useEffect(() => {
    void recarregar()
  }, [recarregar])

  async function gerar() {
    setGerando(true)
    setErro(null)
    try {
      await criarConvite(orcamento.id)
      await recarregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui gerar o código.')
    } finally {
      setGerando(false)
    }
  }

  async function copiar(code: string) {
    const texto = formatarCodigo(code)
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(code)
      setTimeout(() => setCopiado(null), 2000)
    } catch {
      // clipboard bloqueada (http, permissão): o código está na tela, dá pra ler.
    }
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Membros de {orcamento.nome}</h1>
        <button onClick={aoFechar} className="text-sm text-apagado hover:underline">
          Fechar
        </button>
      </div>

      <h2 className="mb-2 text-xs uppercase tracking-wide text-apagado">Quem participa</h2>
      <ul className="mb-8 flex flex-col gap-1">
        {membros.map((m) => (
          <li
            key={m.user_id}
            className="flex items-center justify-between rounded-lg bg-painel px-3 py-2"
          >
            <span>{m.apelido || 'sem apelido'}</span>
            {m.user_id === usuarioId && <span className="text-xs text-apagado">você</span>}
          </li>
        ))}
      </ul>

      <h2 className="mb-2 text-xs uppercase tracking-wide text-apagado">Convidar</h2>

      {convites.length > 0 && (
        <ul className="mb-3 flex flex-col gap-2">
          {convites.map((c) => (
            <li key={c.code} className="rounded-lg border border-borda bg-painel p-3">
              <div className="flex items-center justify-between">
                <code className="text-xl tracking-[0.2em]">{formatarCodigo(c.code)}</code>
                <div className="flex gap-3 text-xs">
                  <button onClick={() => void copiar(c.code)} className="text-apagado underline">
                    {copiado === c.code ? 'copiado' : 'copiar'}
                  </button>
                  <button
                    onClick={async () => {
                      await cancelarConvite(c.code)
                      await recarregar()
                    }}
                    className="text-saida underline"
                  >
                    cancelar
                  </button>
                </div>
              </div>
              <p className="mt-1 text-xs text-apagado">
                vence em{' '}
                {new Date(c.expires_at).toLocaleDateString('pt-BR', {
                  day: 'numeric',
                  month: 'long',
                })}
              </p>
            </li>
          ))}
        </ul>
      )}

      <button
        onClick={gerar}
        disabled={gerando}
        className="rounded-xl bg-primaria py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        {gerando ? 'Gerando…' : 'Gerar código de convite'}
      </button>

      <p className="mt-3 text-sm text-apagado">
        Mande o código pra pessoa. Ela entra no app, escolhe “Tenho um código” e cola.
        Vale 7 dias e serve uma vez só — depois disso, gere outro.
      </p>

      {erro && <p className="mt-4 text-sm text-saida">{erro}</p>}
    </div>
  )
}
