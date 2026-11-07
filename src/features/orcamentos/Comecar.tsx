import { useState } from 'react'
import { criarOrcamento, aceitarConvite } from './orcamentos.queries'

// Primeira tela depois do login, pra quem ainda não participa de nenhum orçamento.
// Também é a tela de "entrar num outro" mais tarde.

type Props = {
  aoEntrar: (ledgerId: string) => void
  aoCancelar?: () => void
}

type Aba = 'criar' | 'entrar'

export function Comecar({ aoEntrar, aoCancelar }: Props) {
  const [aba, setAba] = useState<Aba>('criar')
  const [nome, setNome] = useState('')
  const [apelido, setApelido] = useState('')
  const [codigo, setCodigo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  async function submeter(e: React.FormEvent) {
    e.preventDefault()
    setOcupado(true)
    setErro(null)
    try {
      const id =
        aba === 'criar'
          ? await criarOrcamento(nome, apelido)
          : await aceitarConvite(codigo)
      aoEntrar(id)
    } catch (e) {
      // as RPCs levantam mensagem em português e legível — mostre como veio.
      setErro(e instanceof Error ? e.message : 'Não deu certo.')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm">
      <h1 className="mb-6 text-2xl font-semibold">
        {aoCancelar ? 'Outro orçamento' : 'Bora começar'}
      </h1>

      <div className="mb-6 flex gap-1 rounded-lg border border-borda bg-painel p-1">
        {(['criar', 'entrar'] as const).map((a) => (
          <button
            key={a}
            onClick={() => {
              setAba(a)
              setErro(null)
            }}
            className={`flex-1 rounded-md py-2 text-sm font-semibold transition-colors ${
              aba === a ? 'bg-fundo text-texto shadow-sm' : 'text-apagado'
            }`}
          >
            {a === 'criar' ? 'Criar um' : 'Tenho um código'}
          </button>
        ))}
      </div>

      <form onSubmit={submeter} className="flex flex-col gap-3">
        {aba === 'criar' ? (
          <>
            <input
              required
              autoFocus
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome (ex: Nossa casa)"
              className="rounded-xl border border-borda bg-painel px-4 py-3 outline-none focus:border-primaria"
            />
            <input
              value={apelido}
              onChange={(e) => setApelido(e.target.value)}
              placeholder="Como você aparece (opcional)"
              className="rounded-xl border border-borda bg-painel px-4 py-3 outline-none focus:border-primaria"
            />
          </>
        ) : (
          <input
            required
            autoFocus
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase())}
            placeholder="ABCD-1234"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            className="rounded-xl border border-borda bg-painel px-4 py-3 text-center text-2xl tracking-[0.2em] outline-none focus:border-primaria"
          />
        )}

        <button
          type="submit"
          disabled={ocupado}
          className="rounded-xl bg-primaria px-4 py-3 font-semibold text-white disabled:opacity-50"
        >
          {ocupado ? 'Um instante…' : aba === 'criar' ? 'Criar orçamento' : 'Entrar'}
        </button>

        {aoCancelar && (
          <button type="button" onClick={aoCancelar} className="py-2 text-sm text-apagado">
            Voltar
          </button>
        )}
      </form>

      {erro && <p className="mt-4 text-sm text-saida">{erro}</p>}

      {aba === 'entrar' && !erro && (
        <p className="mt-4 text-sm text-apagado">
          O código vem de quem já está no orçamento. Vale 7 dias e serve uma vez só.
        </p>
      )}
      </div>
    </div>
  )
}
