import { useState } from 'react'
import { sair, type Usuario } from '@/lib/api'
import type { Tema } from '@/lib/tema'
import { AvisosDeMeta } from '@/features/busca/Busca'
import {
  Aviso,
  Botao,
  CabecalhoTela,
  Campo,
  Cartao,
  Icone,
  Sheet,
  Tabs,
  TituloSecao,
  useToast,
  vibrar, Avatar, CaixasCodigo,
} from '@/design'
import { confirmarTrocaEmail, encerrarOutrasSessoes, pedirTrocaEmail, salvarNome } from './perfil.queries'

export type Props = {
  usuario: Usuario
  tema: Tema
  aoMudarTema: (t: Tema) => void
  /** nome/e-mail mudou: o App relê /auth/eu e os membros */
  aoAtualizar: () => void
}

const mensagem = (e: unknown, padrao: string) => (e instanceof Error ? e.message : padrao)

export function Perfil({ usuario, tema, aoMudarTema, aoAtualizar }: Props) {
  return (
    <div className="mx-auto max-w-lg">
      <CabecalhoTela selo="Sua conta" titulo="Perfil" />
      <div className="cascata space-y-6">
        <Cartao className="flex items-center gap-4">
          <Avatar nome={usuario.nome || usuario.email} tamanho="lg" destaque />
          <div className="min-w-0">
            <p className="truncate font-display text-xl font-semibold text-texto">{usuario.nome || 'Sem nome'}</p>
            <p className="truncate text-sm text-suave">{usuario.email}</p>
          </div>
        </Cartao>

        <SecaoNome usuario={usuario} aoAtualizar={aoAtualizar} />
        <SecaoEmail usuario={usuario} aoAtualizar={aoAtualizar} />

        <section>
          <TituloSecao selo="Aparência" titulo="Tema" />
          <Tabs
            cheio
            abas={[
              { id: 'escuro', rotulo: <span className="inline-flex items-center gap-2"><Icone n="moon" />Escuro</span> },
              { id: 'claro', rotulo: <span className="inline-flex items-center gap-2"><Icone n="sun" />Claro</span> },
            ]}
            ativa={tema}
            aoTrocar={(t) => aoMudarTema(t)}
          />
        </section>

        {/* notificações: AvisosDeMeta (da Busca) já vem em cartão próprio e some quando não há suporte */}
        <AvisosDeMeta />

        <SecaoSessoes />
      </div>
    </div>
  )
}

function SecaoNome({ usuario, aoAtualizar }: { usuario: Usuario; aoAtualizar: () => void }) {
  const toast = useToast()
  const [nome, setNome] = useState(usuario.nome ?? '')
  const [estado, setEstado] = useState<{ ocupado: boolean; erro?: string }>({ ocupado: false })
  const mudou = nome.trim() !== (usuario.nome ?? '')

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setEstado({ ocupado: true })
    try {
      await salvarNome(nome.trim() || null)
      setEstado({ ocupado: false })
      vibrar('sucesso')
      toast.mostrar('Nome salvo', { tom: 'sucesso' })
      aoAtualizar()
    } catch (e) {
      setEstado({ ocupado: false, erro: mensagem(e, 'Não consegui salvar o nome.') })
    }
  }

  return (
    <section>
      <TituloSecao selo="Identidade" titulo="Nome" />
      <Cartao>
        <form onSubmit={salvar} className="flex items-start gap-2">
          <Campo
            aria-label="Nome"
            value={nome}
            maxLength={60}
            autoComplete="name"
            onChange={(e) => {
              setNome(e.target.value)
              setEstado({ ocupado: false })
            }}
            placeholder="Seu nome"
            ajuda="É como os outros membros te veem (se não tiver apelido no orçamento)."
            erro={estado.erro}
            classeCaixa="min-w-0 flex-1"
          />
          <Botao type="submit" carregando={estado.ocupado} disabled={!mudou}>
            Salvar
          </Botao>
        </form>
      </Cartao>
    </section>
  )
}

function SecaoEmail({ usuario, aoAtualizar }: { usuario: Usuario; aoAtualizar: () => void }) {
  const toast = useToast()
  const [etapa, setEtapa] = useState<'fechado' | 'email' | 'codigo'>('fechado')
  const [novo, setNovo] = useState('')
  const [codigo, setCodigo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  function fechar() {
    setEtapa('fechado')
    setErro(null)
  }

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
      vibrar('sucesso')
      toast.mostrar('E-mail trocado', { tom: 'sucesso' })
      aoAtualizar()
    } catch (e) {
      vibrar('erro')
      setErro(mensagem(e, 'Código errado ou vencido. Peça outro.'))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <section>
      <TituloSecao selo="Acesso" titulo="E-mail" />
      <Cartao className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-sm text-texto">{usuario.email}</p>
        <Botao variante="secundario" tamanho="sm" onClick={() => setEtapa('email')}>
          Trocar
        </Botao>
      </Cartao>

      <Sheet aberto={etapa !== 'fechado'} aoFechar={fechar} selo="Acesso" titulo="Trocar e-mail" largura="sm">
        {etapa === 'email' ? (
          <form key="email" onSubmit={pedir} className="animate-fade space-y-4">
            <Campo
              rotulo="Novo e-mail"
              ajuda="Mandamos um código de 6 dígitos pra ele."
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              autoFocus
              value={novo}
              onChange={(e) => setNovo(e.target.value)}
              placeholder="novo@email.com"
            />
            {erro && <Aviso>{erro}</Aviso>}
            <div className="flex gap-2">
              <Botao type="button" variante="fantasma" className="flex-1" onClick={fechar}>
                Cancelar
              </Botao>
              <Botao type="submit" className="flex-1" carregando={ocupado}>
                Mandar código
              </Botao>
            </div>
          </form>
        ) : (
          <form key="codigo" onSubmit={confirmar} className="animate-fade space-y-4">
            <p className="text-sm text-suave">
              Código enviado para <span className="font-medium text-texto">{novo.trim()}</span>.
            </p>
            <CaixasCodigo valor={codigo} aoMudar={setCodigo} autoFocus erro={!!erro} />
            {erro && <Aviso>{erro}</Aviso>}
            <div className="flex gap-2">
              <Botao type="button" variante="fantasma" className="flex-1" onClick={() => setEtapa('email')}>
                Voltar
              </Botao>
              <Botao type="submit" className="flex-1" carregando={ocupado} disabled={codigo.length !== 6}>
                Confirmar
              </Botao>
            </div>
          </form>
        )}
      </Sheet>
    </section>
  )
}

function SecaoSessoes() {
  const toast = useToast()
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [confirmandoSaida, setConfirmandoSaida] = useState(false)

  async function encerrar() {
    setOcupado(true)
    setErro(null)
    try {
      const { encerradas } = await encerrarOutrasSessoes()
      toast.mostrar(encerradas === 0 ? 'Não havia outras sessões.' : `${encerradas} sessão(ões) encerrada(s).`, {
        tom: encerradas === 0 ? 'info' : 'sucesso',
      })
    } catch (e) {
      setErro(mensagem(e, 'Não consegui encerrar as sessões.'))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <section>
      <TituloSecao selo="Segurança" titulo="Sessões" />
      <Cartao className="space-y-3">
        <Botao variante="secundario" cheio carregando={ocupado} onClick={() => void encerrar()}>
          Sair dos outros aparelhos
        </Botao>
        {erro && <Aviso>{erro}</Aviso>}
        <Botao variante="perigo" cheio icone={<Icone n="login" />} onClick={() => setConfirmandoSaida(true)}>
          Sair
        </Botao>
      </Cartao>

      <Sheet
        aberto={confirmandoSaida}
        aoFechar={() => setConfirmandoSaida(false)}
        selo="Sessões"
        titulo="Sair deste aparelho?"
        largura="sm"
        rodape={
          <>
            <Botao variante="fantasma" className="flex-1" onClick={() => setConfirmandoSaida(false)}>
              Cancelar
            </Botao>
            <Botao variante="perigo" className="flex-1" onClick={() => void sair()}>
              Sair
            </Botao>
          </>
        }
      >
        <p className="text-sm text-suave">Pra entrar de novo, é só pedir outro código no e-mail.</p>
      </Sheet>
    </section>
  )
}
