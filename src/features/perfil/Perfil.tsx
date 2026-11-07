import { useState } from 'react'
import { CabecalhoTela } from '@/lib/ui'
import { Icone } from '@/lib/icones'
import { sair, type Usuario } from '@/lib/api'
import type { Tema } from '@/lib/tema'
import { AvisosDeMeta } from '@/features/busca/Busca'
import { confirmarTrocaEmail, encerrarOutrasSessoes, pedirTrocaEmail, salvarNome } from './perfil.queries'

export type Props = {
  usuario: Usuario
  tema: Tema
  aoMudarTema: (t: Tema) => void
  /** nome/e-mail mudou: o App relê /auth/eu e os membros */
  aoAtualizar: () => void
}

const mensagem = (e: unknown, padrao: string) => (e instanceof Error ? e.message : padrao)

const campo =
  'w-full rounded-xl border border-borda bg-painel px-4 py-3 text-base outline-none focus:border-primaria'
const botao = 'rounded-xl bg-primaria px-4 py-3 font-semibold text-white disabled:opacity-50'
const cartao = 'rounded-2xl border border-borda bg-painel p-4'

export function Perfil({ usuario, tema, aoMudarTema, aoAtualizar }: Props) {
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <CabecalhoTela titulo="Perfil" subtitulo={usuario.email} />
      <SecaoNome usuario={usuario} aoAtualizar={aoAtualizar} />
      <SecaoEmail usuario={usuario} aoAtualizar={aoAtualizar} />
      <section className={cartao}>
        <h3 className="mb-3 text-sm font-semibold">Tema</h3>
        <div className="grid grid-cols-2 gap-2">
          {(['claro', 'escuro'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => aoMudarTema(t)}
              aria-pressed={tema === t}
              className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm ${
                tema === t ? 'border-primaria text-primaria' : 'border-borda text-apagado'
              }`}
            >
              <Icone n={t === 'claro' ? 'sun' : 'moon'} />
              {t === 'claro' ? 'Claro' : 'Escuro'}
            </button>
          ))}
        </div>
      </section>
      <AvisosDeMeta />
      <SecaoSessoes />
    </div>
  )
}

function SecaoNome({ usuario, aoAtualizar }: { usuario: Usuario; aoAtualizar: () => void }) {
  const [nome, setNome] = useState(usuario.nome ?? '')
  const [estado, setEstado] = useState<{ ocupado: boolean; erro?: string; ok?: boolean }>({ ocupado: false })
  const mudou = nome.trim() !== (usuario.nome ?? '')

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setEstado({ ocupado: true })
    try {
      await salvarNome(nome.trim() || null)
      setEstado({ ocupado: false, ok: true })
      aoAtualizar()
    } catch (e) {
      setEstado({ ocupado: false, erro: mensagem(e, 'Não consegui salvar o nome.') })
    }
  }

  return (
    <form onSubmit={salvar} className={cartao}>
      <label htmlFor="perfil-nome" className="mb-1 block text-sm font-semibold">
        Nome
      </label>
      <p className="mb-3 text-xs text-apagado">É como os outros membros te veem (se não tiver apelido no orçamento).</p>
      <div className="flex gap-2">
        <input
          id="perfil-nome"
          value={nome}
          maxLength={60}
          autoComplete="name"
          onChange={(e) => {
            setNome(e.target.value)
            setEstado({ ocupado: false })
          }}
          placeholder="Seu nome"
          className={campo}
        />
        <button type="submit" disabled={!mudou || estado.ocupado} className={botao}>
          Salvar
        </button>
      </div>
      {estado.erro && <p className="mt-2 text-sm text-saida">{estado.erro}</p>}
      {estado.ok && !mudou && <p className="mt-2 text-sm text-apagado">Salvo.</p>}
    </form>
  )
}

function SecaoEmail({ usuario, aoAtualizar }: { usuario: Usuario; aoAtualizar: () => void }) {
  const [etapa, setEtapa] = useState<'fechado' | 'email' | 'codigo'>('fechado')
  const [novo, setNovo] = useState('')
  const [codigo, setCodigo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  async function pedir(e: React.FormEvent) {
    e.preventDefault()
    setOcupado(true)
    setErro(null)
    try {
      await pedirTrocaEmail(novo.trim())
      setCodigo('')
      setEtapa('codigo')
    } catch (e) {
      setErro(mensagem(e, 'Não consegui pedir o código.'))
    } finally {
      setOcupado(false)
    }
  }

  async function confirmar(e: React.FormEvent) {
    e.preventDefault()
    setOcupado(true)
    setErro(null)
    try {
      await confirmarTrocaEmail(codigo.trim())
      setEtapa('fechado')
      setNovo('')
      aoAtualizar()
    } catch (e) {
      setErro(mensagem(e, 'Código errado ou vencido. Peça outro.'))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <section className={cartao}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">E-mail</h3>
          <p className="truncate text-sm text-apagado">{usuario.email}</p>
        </div>
        {etapa === 'fechado' && (
          <button type="button" onClick={() => setEtapa('email')} className="text-sm font-semibold text-primaria">
            Trocar
          </button>
        )}
      </div>

      {etapa === 'email' && (
        <form onSubmit={pedir} className="mt-3 flex flex-col gap-2">
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            autoFocus
            value={novo}
            onChange={(e) => setNovo(e.target.value)}
            placeholder="novo@email.com"
            className={campo}
          />
          <div className="flex gap-2">
            <button type="submit" disabled={ocupado} className={`${botao} flex-1`}>
              Mandar código
            </button>
            <button type="button" onClick={() => setEtapa('fechado')} className="px-4 text-sm text-apagado">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {etapa === 'codigo' && (
        <form onSubmit={confirmar} className="mt-3 flex flex-col gap-2">
          <p className="text-sm text-apagado">Código enviado para {novo.trim()}.</p>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            required
            autoFocus
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
            placeholder="000000"
            className={`${campo} tracking-[0.4em]`}
          />
          <div className="flex gap-2">
            <button type="submit" disabled={ocupado || codigo.length !== 6} className={`${botao} flex-1`}>
              Confirmar
            </button>
            <button type="button" onClick={() => setEtapa('email')} className="px-4 text-sm text-apagado">
              Voltar
            </button>
          </div>
        </form>
      )}
      {erro && <p className="mt-2 text-sm text-saida">{erro}</p>}
    </section>
  )
}

function SecaoSessoes() {
  const [aviso, setAviso] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  async function encerrar() {
    setOcupado(true)
    try {
      const { encerradas } = await encerrarOutrasSessoes()
      setAviso(encerradas === 0 ? 'Não havia outras sessões.' : `${encerradas} sessão(ões) encerrada(s).`)
    } catch (e) {
      setAviso(mensagem(e, 'Não consegui encerrar as sessões.'))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <section className={`${cartao} space-y-3`}>
      <h3 className="text-sm font-semibold">Sessões</h3>
      <button
        type="button"
        onClick={encerrar}
        disabled={ocupado}
        className="w-full rounded-xl border border-borda px-4 py-3 text-sm disabled:opacity-50"
      >
        Sair dos outros aparelhos
      </button>
      {aviso && <p className="text-sm text-apagado">{aviso}</p>}
      <button
        type="button"
        onClick={() => void sair()}
        className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-saida"
      >
        Sair
      </button>
    </section>
  )
}
