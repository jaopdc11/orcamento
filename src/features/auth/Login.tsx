import { useState } from 'react'
import { api, avisarSessao, type Usuario } from '@/lib/api'
import { Aviso, Botao, Campo, Icone, Selo, vibrar, CaixasCodigo } from '@/design'

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
      vibrar('sucesso')
      avisarSessao(usuario) // o useSessao troca a tela
    } catch (e) {
      vibrar('erro')
      setErro(e instanceof Error ? e.message : 'Código errado ou vencido. Peça outro.')
      setOcupado(false)
    }
  }

  return (
    // Tela fora do shell: ela mesma cuida da safe-area (notch/home bar).
    <div className="flex min-h-[100dvh] flex-col bg-fundo px-6 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[max(2.5rem,env(safe-area-inset-top))]">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center">
        <div className="animate-subir">
          <span className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-card border border-borda bg-superficie text-acento shadow-card">
            <Icone n="wallet" className="h-6 w-6" />
          </span>
          <Selo tom="acento">{etapa === 'email' ? 'Entrar' : 'Confirmar'}</Selo>
          <h1 className="mt-1.5 font-display text-4xl font-semibold tracking-tight text-texto">Orçamento</h1>
          <p className="mb-8 mt-2 text-sm text-suave">
            {etapa === 'email' ? (
              'Entre com seu e-mail. Chega um código de 6 dígitos.'
            ) : (
              <>
                Código enviado para <span className="font-medium text-texto">{email}</span>.
              </>
            )}
          </p>
        </div>

        {etapa === 'email' ? (
          <form key="email" onSubmit={pedirCodigo} className="flex animate-subir flex-col gap-3">
            <Campo
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@email.com"
              aria-label="E-mail"
              className="min-h-14 text-lg sm:text-base"
            />
            <Botao type="submit" tamanho="lg" cheio carregando={ocupado}>
              {ocupado ? 'Enviando…' : 'Receber código'}
            </Botao>
          </form>
        ) : (
          <form key="codigo" onSubmit={conferirCodigo} className="flex animate-subir flex-col gap-3">
            <CaixasCodigo valor={codigo} aoMudar={setCodigo} autoFocus erro={!!erro} />
            <Botao type="submit" tamanho="lg" cheio carregando={ocupado} disabled={ocupado || codigo.length < 6} className="mt-2">
              {ocupado ? 'Conferindo…' : 'Entrar'}
            </Botao>
            <Botao
              type="button"
              variante="fantasma"
              cheio
              onClick={() => {
                setEtapa('email')
                setCodigo('')
                setErro(null)
              }}
            >
              Usar outro e-mail
            </Botao>
          </form>
        )}

        {erro && <Aviso className="mt-4 animate-fade">{erro}</Aviso>}
      </div>
    </div>
  )
}
