import { useState } from 'react'
import { api, avisarSessao, type Usuario } from '@/lib/api'

// Login por CÓDIGO de 6 dígitos, nunca por link.
//
// Magic link é incompatível com PWA instalada: no iOS a PWA da tela inicial tem
// um data store do WebKit separado do Safari, então a sessão gravada ao clicar o
// link no Mail fica no Safari e o app continua deslogado, em loop, pra sempre.
// No Android o Gmail abre em Custom Tab — mesmo problema de contexto.
//
// O código é gerado e mandado pela nossa API (Resend). Só e-mails da lista
// EMAILS_PERMITIDOS recebem — os outros recebem a mesma resposta e nada chega.

type Etapa = 'email' | 'codigo'

export function Login() {
  const [etapa, setEtapa] = useState<Etapa>('email')
  const [email, setEmail] = useState('')
  const [codigo, setCodigo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  async function pedirCodigo(e: React.FormEvent) {
    e.preventDefault()
    setOcupado(true)
    setErro(null)
    try {
      await api.post('/auth/codigo', { email: email.trim() })
      setEtapa('codigo')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui pedir o código.')
    } finally {
      setOcupado(false)
    }
  }

  async function conferirCodigo(e: React.FormEvent) {
    e.preventDefault()
    setOcupado(true)
    setErro(null)
    try {
      const usuario = await api.post<Usuario>('/auth/verificar', {
        email: email.trim(),
        codigo: codigo.trim(),
      })
      avisarSessao(usuario) // o useSessao troca a tela
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Código errado ou vencido. Peça outro.')
      setOcupado(false)
    }
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm">
      <h1 className="mb-1 text-2xl font-semibold">Orçamento</h1>
      <p className="mb-8 text-sm text-apagado">
        {etapa === 'email'
          ? 'Entre com seu e-mail. Chega um código de 6 dígitos.'
          : `Código enviado para ${email}.`}
      </p>

      {etapa === 'email' ? (
        <form onSubmit={pedirCodigo} className="flex flex-col gap-3">
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@email.com"
            className="rounded-xl border border-borda bg-painel px-4 py-3 text-base outline-none focus:border-primaria"
          />
          <button
            type="submit"
            disabled={ocupado}
            className="rounded-xl bg-primaria px-4 py-3 font-semibold text-white disabled:opacity-50"
          >
            {ocupado ? 'Enviando…' : 'Receber código'}
          </button>
        </form>
      ) : (
        <form onSubmit={conferirCodigo} className="flex flex-col gap-3">
          <input
            type="text"
            inputMode="numeric"
            // faz iOS e Android sugerirem o código direto do teclado —
            // é o que derruba a fricção pra perto de zero.
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            required
            autoFocus
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
            placeholder="000000"
            className="rounded-xl border border-borda bg-painel px-4 py-3 text-center text-3xl tracking-[0.4em] outline-none focus:border-primaria"
          />
          <button
            type="submit"
            disabled={ocupado || codigo.length < 6}
            className="rounded-xl bg-primaria px-4 py-3 font-semibold text-white disabled:opacity-50"
          >
            {ocupado ? 'Conferindo…' : 'Entrar'}
          </button>
          <button
            type="button"
            onClick={() => {
              setEtapa('email')
              setCodigo('')
              setErro(null)
            }}
            className="py-2 text-sm text-apagado"
          >
            Usar outro e-mail
          </button>
        </form>
      )}

      {erro && <p className="mt-4 text-sm text-saida">{erro}</p>}
      </div>
    </div>
  )
}
