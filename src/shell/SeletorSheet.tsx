import { useState } from 'react'
import { aceitarConvite, criarOrcamento } from '@/features/orcamentos/orcamentos.queries'
import { Botao, Campo, Icone, Lista, LinhaLista, Sheet, cx, useToast } from '@/design'
import type { Orcamento } from '@/lib/tipos'

type Props = {
  aberto: boolean
  aoFechar: () => void
  orcamentos: Orcamento[]
  atualId: string
  aoTrocar: (id: string) => void
  /** criou ou entrou com código: o App relê a lista e abre este */
  aoEntrarEmNovo: (id: string) => void
}

type Modo = 'lista' | 'criar' | 'entrar'

/**
 * Troca de orçamento num sheet: lista (um toque troca) + criar + entrar com
 * código. Mesma lógica do features/orcamentos/Seletor.tsx, com a cara nova.
 */
export function SeletorSheet({ aberto, aoFechar, orcamentos, atualId, aoTrocar, aoEntrarEmNovo }: Props) {
  const toast = useToast()
  const [modo, setModo] = useState<Modo>('lista')
  const [texto, setTexto] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  function fechar() {
    setModo('lista')
    setTexto('')
    setErro(null)
    aoFechar()
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (!texto.trim()) return
    setOcupado(true)
    setErro(null)
    try {
      const id = modo === 'criar' ? await criarOrcamento(texto.trim()) : await aceitarConvite(texto.trim())
      toast.mostrar(modo === 'criar' ? 'Orçamento criado' : 'Você entrou no orçamento')
      fechar()
      aoEntrarEmNovo(id)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu certo.')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <Sheet
      aberto={aberto}
      aoFechar={fechar}
      selo="Orçamentos"
      titulo={modo === 'lista' ? 'Trocar de orçamento' : modo === 'criar' ? 'Novo orçamento' : 'Entrar com código'}
      largura="sm"
    >
      {modo === 'lista' ? (
        <>
          <Lista>
            {orcamentos.map((o) => {
              const atual = o.id === atualId
              return (
                <LinhaLista
                  key={o.id}
                  inicio={
                    <span className={cx('flex h-10 w-10 items-center justify-center rounded-[10px] font-display font-semibold', atual ? 'bg-tinta-acento text-acento' : 'bg-superficie-alta text-suave')}>
                      {o.nome.slice(0, 1).toUpperCase()}
                    </span>
                  }
                  titulo={o.nome}
                  subtitulo={atual ? 'aberto agora' : undefined}
                  fim={atual ? <Icone n="check" className="h-5 w-5 text-acento" /> : undefined}
                  aoTocar={() => {
                    fechar()
                    if (!atual) aoTrocar(o.id)
                  }}
                />
              )
            })}
          </Lista>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Botao variante="secundario" icone={<Icone n="plus" />} onClick={() => setModo('criar')}>
              Criar novo
            </Botao>
            <Botao variante="secundario" icone={<Icone n="login" />} onClick={() => setModo('entrar')}>
              Tenho código
            </Botao>
          </div>
        </>
      ) : (
        <form onSubmit={enviar} className="space-y-4">
          <Campo
            autoFocus
            required
            rotulo={modo === 'criar' ? 'Nome' : 'Código do convite'}
            value={texto}
            onChange={(e) => setTexto(modo === 'entrar' ? e.target.value.toUpperCase() : e.target.value)}
            placeholder={modo === 'criar' ? 'ex: Viagem' : 'ABCD-1234'}
            maxLength={modo === 'criar' ? 80 : 12}
            autoCapitalize={modo === 'entrar' ? 'characters' : undefined}
            spellCheck={false}
            className={modo === 'entrar' ? 'text-center font-mono tracking-[0.2em]' : undefined}
            erro={erro}
          />
          <div className="flex gap-2">
            <Botao
              variante="fantasma"
              className="flex-1"
              onClick={() => {
                setModo('lista')
                setTexto('')
                setErro(null)
              }}
            >
              Voltar
            </Botao>
            <Botao type="submit" className="flex-1" carregando={ocupado} disabled={!texto.trim()}>
              {modo === 'criar' ? 'Criar' : 'Entrar'}
            </Botao>
          </div>
        </form>
      )}
    </Sheet>
  )
}
