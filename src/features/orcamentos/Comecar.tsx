import { useState } from 'react'
import { criarOrcamento, aceitarConvite } from './orcamentos.queries'
import { Aviso, Botao, Campo, Icone, Selo, Tabs, vibrar } from '@/design'

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
      vibrar('sucesso')
      aoEntrar(id)
    } catch (e) {
      // as RPCs levantam mensagem em português e legível — mostre como veio.
      setErro(e instanceof Error ? e.message : 'Não deu certo.')
    } finally {
      setOcupado(false)
    }
  }

  return (
    // Fora do shell: cuida da própria safe-area.
    <div className="flex min-h-[100dvh] flex-col bg-fundo px-6 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[max(2.5rem,env(safe-area-inset-top))]">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center">
        <div className="animate-subir">
          <span className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-card border border-borda bg-superficie text-acento shadow-card">
            <Icone n={aoCancelar ? 'users' : 'wallet'} className="h-6 w-6" />
          </span>
          <Selo tom="acento">{aoCancelar ? 'Mais um' : 'Primeiro passo'}</Selo>
          <h1 className="mb-6 mt-1.5 font-display text-3xl font-semibold tracking-tight text-texto">
            {aoCancelar ? 'Outro orçamento' : 'Bora começar'}
          </h1>
        </div>

        <Tabs
          cheio
          className="mb-6"
          abas={[
            { id: 'criar', rotulo: 'Criar um' },
            { id: 'entrar', rotulo: 'Tenho um código' },
          ]}
          ativa={aba}
          aoTrocar={(a) => {
            setAba(a)
            setErro(null)
          }}
        />

        <form key={aba} onSubmit={submeter} className="flex animate-subir flex-col gap-3">
          {aba === 'criar' ? (
            <>
              <Campo
                rotulo="Nome do orçamento"
                required
                autoFocus
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="ex: Nossa casa"
              />
              <Campo
                rotulo="Como você aparece"
                ajuda="Opcional. Dá pra mudar depois nas configurações."
                value={apelido}
                onChange={(e) => setApelido(e.target.value)}
                placeholder="seu apelido"
              />
            </>
          ) : (
            <Campo
              rotulo="Código de convite"
              ajuda="O código vem de quem já está no orçamento. Vale 7 dias e serve uma vez só."
              required
              autoFocus
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              placeholder="ABCD-1234"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              className="min-h-14 text-center font-mono text-2xl tracking-[0.2em] sm:text-2xl"
            />
          )}

          <Botao type="submit" tamanho="lg" cheio carregando={ocupado} className="mt-2">
            {ocupado ? 'Um instante…' : aba === 'criar' ? 'Criar orçamento' : 'Entrar'}
          </Botao>

          {aoCancelar && (
            <Botao type="button" variante="fantasma" cheio onClick={aoCancelar}>
              Voltar
            </Botao>
          )}
        </form>

        {erro && <Aviso className="mt-4 animate-fade">{erro}</Aviso>}
      </div>
    </div>
  )
}
