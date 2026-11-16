import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Aviso,
  Badge,
  Botao,
  BotaoIcone,
  CabecalhoTela,
  Campo,
  Cartao,
  Chip,
  EsqueletoLista,
  FileiraChips,
  Icone,
  Lista,
  LinhaLista,
  Select,
  Selo,
  Sheet,
  Tabs,
  TecladoValor,
  TituloSecao,
  Valor,
  Vazio,
  useToast,
  vibrar,
} from '@/design'
import { comAtraso, ouvirOrcamento } from '@/lib/eventos'
import { diaMes, hoje } from '@/lib/datas'
import { mapaDeMembros, nomeDoMembro } from '@/lib/membros'
import { uuidv7 } from '@/lib/uuidv7'
import type { Carteira, ContextoOrcamento, Indexador, Investimento, Membro, Movimento, TipoInvestimento } from '@/lib/tipos'
import {
  apagarInvestimento,
  apagarMovimento,
  buscarCarteira,
  criarInvestimento,
  editarInvestimento,
  listarMovimentos,
  registrarMovimento,
} from './investimentos.queries'

export type Props = ContextoOrcamento

const msg = (e: unknown) => (e instanceof Error ? e.message : 'Não deu certo.')

const TIPOS: { id: TipoInvestimento; rotulo: string; curto: string }[] = [
  { id: 'acao', rotulo: 'Ação', curto: 'AÇÃO' },
  { id: 'fii', rotulo: 'FII', curto: 'FII' },
  { id: 'etf', rotulo: 'ETF', curto: 'ETF' },
  { id: 'cripto', rotulo: 'Cripto', curto: 'CRIPTO' },
  { id: 'renda_fixa', rotulo: 'Renda fixa', curto: 'RF' },
  { id: 'outro', rotulo: 'Outro', curto: 'OUTRO' },
]
const rotuloTipo = (t: TipoInvestimento) => TIPOS.find((x) => x.id === t)!.rotulo
const ehMercado = (t: TipoInvestimento) => t === 'acao' || t === 'fii' || t === 'etf' || t === 'cripto'

const INDEXADORES: { id: Indexador; rotulo: string }[] = [
  { id: 'cdi', rotulo: 'CDI' },
  { id: 'selic', rotulo: 'Selic' },
  { id: 'prefixado', rotulo: 'Prefixado' },
]

const numero = (v: number, max = 8) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: max }).format(v)

/** taxa em centésimos → '110' / '12,5' (o que a pessoa digita). */
const taxaTexto = (t: number | null) => (t === null ? '' : numero(t / 100, 2))
/** '110' / '12,5' → centésimos; null se inválido. */
function taxaDe(texto: string): number | null {
  const n = Number(texto.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null
}

function descricaoTaxa(i: Pick<Investimento, 'indexador' | 'taxa'>): string {
  if (!i.indexador || i.taxa === null) return ''
  return i.indexador === 'prefixado' ? `${taxaTexto(i.taxa)}% a.a.` : `${taxaTexto(i.taxa)}% do ${i.indexador === 'cdi' ? 'CDI' : 'Selic'}`
}

/** Variação em % do investido, em texto ('+12,4%'). null quando não há base. */
function percentual(rendimento: number, investido: number): string | null {
  if (investido <= 0) return null
  const p = (rendimento / investido) * 100
  return `${p > 0 ? '+' : p < 0 ? '−' : ''}${numero(Math.abs(p), 1)}%`
}

export function Investimentos({ orcamento, usuarioId, membros, ocultar }: Props) {
  const ledgerId = orcamento.id
  const toast = useToast()
  const [carteira, setCarteira] = useState<Carteira | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [criando, setCriando] = useState(false)
  const [abertoId, setAbertoId] = useState<string | null>(null)

  const recarregar = useCallback(async () => {
    try {
      setCarteira(await buscarCarteira(ledgerId))
      setErro(null)
    } catch (e) {
      setErro(msg(e))
    }
  }, [ledgerId])

  useEffect(() => {
    setCarteira(null)
    setAbertoId(null)
    void recarregar()
  }, [recarregar])

  useEffect(() => {
    const releitura = comAtraso(() => void recarregar())
    const parar = ouvirOrcamento(ledgerId, (tipo) => {
      if (tipo === 'investimentos') releitura.chamar()
    })
    return () => {
      parar()
      releitura.cancelar()
    }
  }, [ledgerId, recarregar])

  const itens = useMemo(() => carteira?.itens ?? [], [carteira])
  const ativos = useMemo(() => itens.filter((i) => !i.arquivado), [itens])
  const arquivados = useMemo(() => itens.filter((i) => i.arquivado), [itens])
  const aberto = useMemo(() => itens.find((i) => i.id === abertoId), [itens, abertoId])
  const algumDesatualizado = ativos.some((i) => i.desatualizado)

  const botaoNovo = (
    <Botao tamanho="sm" onClick={() => setCriando(true)} icone={<Icone n="plus" className="h-4 w-4" />}>
      Novo
    </Botao>
  )

  const linha = (i: Investimento) => (
    <LinhaLista
      key={i.id}
      apagada={i.arquivado}
      inicio={<MarcaTipo tipo={i.tipo} />}
      titulo={
        <span className="flex items-center gap-1.5">
          <span className="truncate">{i.nome}</span>
          {i.ticker && (
            <Badge mono className="uppercase">
              {i.ticker}
            </Badge>
          )}
        </span>
      }
      subtitulo={
        <span className="flex flex-wrap items-center gap-x-1">
          <span className="truncate">{resumoPosicao(i)}</span>
          {i.desatualizado && !i.arquivado && (
            <Badge tom="atencao" className="ml-1">
              sem cotação nova
            </Badge>
          )}
        </span>
      }
      fim={
        <span className="flex flex-col items-end">
          <Valor centavos={i.valor_atual_cents} tamanho="sm" ocultar={ocultar} />
          {i.investido_cents > 0 && (
            <Valor centavos={i.rendimento_cents} tipo="auto" tamanho="sm" ocultar={ocultar} className="mt-0.5 text-xs" />
          )}
        </span>
      }
      aoTocar={() => setAbertoId(i.id)}
    />
  )

  const pct = carteira ? percentual(carteira.rendimento_cents, carteira.investido_cents) : null

  return (
    <div className="mx-auto max-w-2xl">
      <CabecalhoTela
        selo="Carteira"
        titulo="Investimentos"
        descricao="Aporte sai do saldo do mês; o valor de hoje vem da cotação"
        acao={itens.length > 0 ? botaoNovo : undefined}
      />

      {erro && (
        <Aviso className="mb-4" aoTentarDeNovo={() => void recarregar()}>
          {erro}
        </Aviso>
      )}

      {!carteira ? (
        !erro && <EsqueletoLista linhas={4} />
      ) : itens.length === 0 ? (
        <Cartao>
          <Vazio
            icone="trendingUp"
            titulo="Nenhum investimento ainda."
            descricao="Cadastre ações, FIIs, cripto ou renda fixa. Cada aporte entra no mês como saída."
            acao={
              <Botao onClick={() => setCriando(true)} icone={<Icone n="plus" className="h-4 w-4" />}>
                Novo investimento
              </Botao>
            }
          />
        </Cartao>
      ) : (
        <div className="space-y-6">
          <div className="cascata grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Cartao className="col-span-2 sm:col-span-1">
              <Selo>Patrimônio hoje</Selo>
              <Valor centavos={carteira.valor_atual_cents} tamanho="lg" ocultar={ocultar} animar className="mt-1 block" />
            </Cartao>
            <Cartao>
              <Selo>Investido</Selo>
              <Valor centavos={carteira.investido_cents} tamanho="lg" ocultar={ocultar} className="mt-1 block" />
            </Cartao>
            <Cartao>
              <Selo>Rendimento</Selo>
              <Valor centavos={carteira.rendimento_cents} tipo="auto" tamanho="lg" ocultar={ocultar} className="mt-1 block" />
              {pct && !ocultar && <span className="mt-0.5 block font-mono text-xs text-tenue">{pct}</span>}
            </Cartao>
          </div>

          {algumDesatualizado && (
            <Aviso tom="atencao">
              Alguma fonte de cotação não respondeu agora. Os valores marcados usam a última cotação conhecida.
            </Aviso>
          )}

          {ativos.length > 0 && (
            <section>
              <Selo className="mb-2">
                <span className="font-mono">{ativos.length}</span> ativo{ativos.length === 1 ? '' : 's'}
              </Selo>
              <Lista cascata>{ativos.map(linha)}</Lista>
            </section>
          )}

          {arquivados.length > 0 && (
            <section>
              <TituloSecao titulo="Arquivados" />
              <Lista>{arquivados.map(linha)}</Lista>
            </section>
          )}
        </div>
      )}

      <SheetNovo
        aberto={criando}
        ledgerId={ledgerId}
        aoFechar={() => setCriando(false)}
        aoCriar={async (inv) => {
          vibrar('sucesso')
          toast.mostrar(`${inv.nome} na carteira`)
          setCriando(false)
          await recarregar()
          setAbertoId(inv.id)
        }}
      />

      <SheetDetalhe
        investimento={aberto}
        aoFechar={() => setAbertoId(null)}
        {...{ ledgerId, membros, usuarioId, ocultar }}
        aoMudar={async (texto) => {
          if (texto) toast.mostrar(texto)
          await recarregar()
        }}
        aoRemover={async (texto) => {
          vibrar('aviso')
          toast.mostrar(texto)
          setAbertoId(null)
          await recarregar()
        }}
      />
    </div>
  )
}

function resumoPosicao(i: Investimento): string {
  const partes: string[] = [rotuloTipo(i.tipo)]
  if (ehMercado(i.tipo) && i.quantidade !== null) {
    partes.push(`${numero(Number(i.quantidade))} ${i.tipo === 'cripto' ? 'un.' : 'cotas'}`)
  }
  if (i.tipo === 'renda_fixa') partes.push(descricaoTaxa(i))
  if (i.tipo === 'outro') partes.push('valor informado à mão')
  return partes.filter(Boolean).join(' · ')
}

/** Quadradinho com a sigla do tipo: âncora visual no início da linha. */
function MarcaTipo({ tipo }: { tipo: TipoInvestimento }) {
  const curto = TIPOS.find((t) => t.id === tipo)!.curto
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-borda bg-campo">
      <span className="font-mono text-[9px] font-semibold tracking-wider text-suave">{curto}</span>
    </span>
  )
}

// ---------------------------------------------------------------------------
// novo investimento
// ---------------------------------------------------------------------------

function SheetNovo({
  aberto,
  ledgerId,
  aoFechar,
  aoCriar,
}: {
  aberto: boolean
  ledgerId: string
  aoFechar: () => void
  aoCriar: (inv: Investimento) => Promise<void>
}) {
  const [tipo, setTipo] = useState<TipoInvestimento>('acao')
  const [nome, setNome] = useState('')
  const [ticker, setTicker] = useState('')
  const [indexador, setIndexador] = useState<Indexador>('cdi')
  const [taxa, setTaxa] = useState('100')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!aberto) return
    setTipo('acao')
    setNome('')
    setTicker('')
    setIndexador('cdi')
    setTaxa('100')
    setSalvando(false)
    setErro(null)
  }, [aberto])

  async function criar() {
    const mercado = ehMercado(tipo)
    if (mercado && !ticker.trim()) return setErro(tipo === 'cripto' ? 'Informe o id da moeda.' : 'Informe o código.')
    const t = tipo === 'renda_fixa' ? taxaDe(taxa) : null
    if (tipo === 'renda_fixa' && t === null) return setErro('Informe a taxa.')
    const nomeFinal = nome.trim() || (mercado ? ticker.trim().toUpperCase() : '')
    if (!nomeFinal) return setErro('Dê um nome.')
    setSalvando(true)
    try {
      const inv = await criarInvestimento(ledgerId, {
        nome: nomeFinal,
        tipo,
        ticker: mercado ? ticker.trim() : null,
        indexador: tipo === 'renda_fixa' ? indexador : null,
        taxa: t,
      })
      await aoCriar(inv)
    } catch (e) {
      vibrar('erro')
      setErro(msg(e))
      setSalvando(false)
    }
  }

  const rodape = (
    <>
      <Botao variante="fantasma" className="flex-1" onClick={aoFechar}>
        Cancelar
      </Botao>
      <Botao className="flex-1" carregando={salvando} onClick={() => void criar()}>
        Criar
      </Botao>
    </>
  )

  return (
    <Sheet aberto={aberto} aoFechar={aoFechar} selo="Investimentos" titulo="Novo investimento" rodape={rodape} alto>
      <div className="space-y-4">
        <div>
          <p className="mb-1.5 text-xs font-medium text-suave">Tipo</p>
          <FileiraChips>
            {TIPOS.map((t) => (
              <Chip key={t.id} ativo={tipo === t.id} aoTocar={() => setTipo(t.id)}>
                {t.rotulo}
              </Chip>
            ))}
          </FileiraChips>
        </div>

        {ehMercado(tipo) && (
          <Campo
            rotulo={tipo === 'cripto' ? 'Moeda (id da CoinGecko)' : 'Código na B3'}
            value={ticker}
            maxLength={40}
            autoCapitalize={tipo === 'cripto' ? 'none' : 'characters'}
            autoComplete="off"
            onChange={(e) => setTicker(e.target.value)}
            placeholder={tipo === 'cripto' ? 'bitcoin' : tipo === 'fii' ? 'HGLG11' : tipo === 'etf' ? 'BOVA11' : 'PETR4'}
            ajuda={tipo === 'cripto' ? 'Ex.: bitcoin, ethereum, solana' : 'A cotação é buscada sozinha'}
            className="font-mono"
          />
        )}

        <Campo
          rotulo="Nome"
          value={nome}
          maxLength={80}
          onChange={(e) => setNome(e.target.value)}
          placeholder={tipo === 'renda_fixa' ? 'CDB Banco X' : tipo === 'outro' ? 'Previdência' : 'opcional: usa o código'}
        />

        {tipo === 'renda_fixa' && (
          <>
            <Tabs cheio abas={INDEXADORES} ativa={indexador} aoTrocar={setIndexador} />
            <Campo
              rotulo={indexador === 'prefixado' ? 'Taxa ao ano (%)' : `Percentual do ${indexador === 'cdi' ? 'CDI' : 'Selic'} (%)`}
              inputMode="decimal"
              value={taxa}
              onChange={(e) => setTaxa(e.target.value.replace(/[^\d,.]/g, ''))}
              ajuda={indexador === 'prefixado' ? 'Ex.: 12,5' : 'Ex.: 110 para 110% do CDI'}
              className="font-mono"
            />
          </>
        )}

        {tipo === 'outro' && (
          <p className="text-xs text-tenue">Sem cotação automática: você informa o valor atual quando quiser.</p>
        )}
        {erro && <p className="text-sm text-perigo">{erro}</p>}
      </div>
    </Sheet>
  )
}

// ---------------------------------------------------------------------------
// detalhe: posição, movimentações, aportar/resgatar, editar
// ---------------------------------------------------------------------------

type Modo = 'ver' | 'aporte' | 'resgate' | 'editar' | 'remover'

function SheetDetalhe({
  investimento: inv,
  ledgerId,
  membros,
  usuarioId,
  ocultar,
  aoFechar,
  aoMudar,
  aoRemover,
}: {
  investimento: Investimento | undefined
  ledgerId: string
  membros: Membro[]
  usuarioId: string
  ocultar: boolean
  aoFechar: () => void
  aoMudar: (texto?: string) => Promise<void>
  aoRemover: (texto: string) => Promise<void>
}) {
  const [modo, setModo] = useState<Modo>('ver')
  const [movs, setMovs] = useState<Movimento[] | null>(null)
  const [apagando, setApagando] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const id = inv?.id

  const carregarMovs = useCallback(async () => {
    if (!id) return
    try {
      setMovs(await listarMovimentos(ledgerId, id))
    } catch (e) {
      setErro(msg(e))
    }
  }, [ledgerId, id])

  useEffect(() => {
    setModo('ver')
    setMovs(null)
    setApagando(null)
    setErro(null)
    void carregarMovs()
  }, [carregarMovs])

  // o investimento muda quando a carteira relê (outra pessoa aportou): relê os movimentos junto
  useEffect(() => {
    if (inv) void carregarMovs()
  }, [inv?.investido_cents, carregarMovs]) // eslint-disable-line react-hooks/exhaustive-deps

  const porMembro = useMemo(() => mapaDeMembros(membros), [membros])

  async function tirarMovimento(m: Movimento) {
    if (!inv) return
    try {
      await apagarMovimento(ledgerId, inv.id, m.id)
      vibrar('aviso')
      setApagando(null)
      await aoMudar(`${m.tipo === 'aporte' ? 'Aporte' : 'Resgate'} apagado`)
    } catch (e) {
      vibrar('erro')
      setErro(msg(e))
      setApagando(null)
    }
  }

  async function arquivar() {
    if (!inv) return
    try {
      await editarInvestimento(ledgerId, inv.id, { arquivado: !inv.arquivado })
      vibrar('leve')
      await aoMudar(inv.arquivado ? `${inv.nome} reativado` : `${inv.nome} arquivado`)
    } catch (e) {
      setErro(msg(e))
    }
  }

  if (!inv) return <Sheet aberto={false} aoFechar={aoFechar}>{null}</Sheet>

  const voltar = () => {
    setModo('ver')
    setErro(null)
  }

  if (modo === 'aporte' || modo === 'resgate') {
    return (
      <FormMovimento
        inv={inv}
        tipo={modo}
        {...{ ledgerId, membros, usuarioId }}
        aoFechar={aoFechar}
        aoVoltar={voltar}
        aoSalvar={async (texto) => {
          vibrar('sucesso')
          setModo('ver')
          await aoMudar(texto)
        }}
      />
    )
  }

  if (modo === 'editar') {
    return (
      <FormEditar
        inv={inv}
        ledgerId={ledgerId}
        aoFechar={aoFechar}
        aoVoltar={voltar}
        aoSalvar={async (texto) => {
          vibrar('sucesso')
          setModo('ver')
          await aoMudar(texto)
        }}
      />
    )
  }

  const temMovimento = (movs?.length ?? 0) > 0
  const pct = percentual(inv.rendimento_cents, inv.investido_cents)

  const rodape =
    modo === 'remover' ? (
      <>
        <Botao variante="fantasma" className="flex-1" onClick={voltar}>
          Voltar
        </Botao>
        <Botao
          variante="perigo"
          className="flex-1"
          onClick={async () => {
            try {
              await apagarInvestimento(ledgerId, inv.id)
              await aoRemover(`${inv.nome} removido`)
            } catch (e) {
              setErro(msg(e))
              setModo('ver')
            }
          }}
        >
          Apagar de vez
        </Botao>
      </>
    ) : inv.arquivado ? (
      <Botao className="flex-1" onClick={() => void arquivar()}>
        Reativar
      </Botao>
    ) : (
      <>
        <Botao variante="secundario" className="flex-1" disabled={!temMovimento} onClick={() => setModo('resgate')}>
          Resgatar
        </Botao>
        <Botao className="flex-1" onClick={() => setModo('aporte')} icone={<Icone n="plus" className="h-4 w-4" />}>
          Aportar
        </Botao>
      </>
    )

  return (
    <Sheet aberto aoFechar={aoFechar} selo={rotuloTipo(inv.tipo)} titulo={inv.nome} rodape={rodape} alto largura="md">
      {modo === 'remover' ? (
        <div className="animate-fade py-6 text-center">
          <p className="text-sm font-medium text-texto">Apagar “{inv.nome}”?</p>
          <p className="mt-1 text-sm text-suave">Ele não tem movimentações; nada some do mês.</p>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Selo>Valor hoje</Selo>
              <Valor centavos={inv.valor_atual_cents} tamanho="lg" ocultar={ocultar} className="mt-1 block" />
            </div>
            <div>
              <Selo>Rendimento</Selo>
              <Valor centavos={inv.rendimento_cents} tipo="auto" tamanho="lg" ocultar={ocultar} className="mt-1 block" />
              {pct && !ocultar && <span className="block font-mono text-xs text-tenue">{pct}</span>}
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
            <Info rotulo="Investido">
              <Valor centavos={inv.investido_cents} tamanho="sm" ocultar={ocultar} />
            </Info>
            {ehMercado(inv.tipo) && (
              <>
                <Info rotulo="Quantidade">
                  <span className="font-mono">{numero(Number(inv.quantidade ?? 0))}</span>
                </Info>
                <Info rotulo="Cotação">
                  {inv.cotacao !== null ? (
                    <Valor centavos={Math.round(inv.cotacao * 100)} tamanho="sm" ocultar={ocultar} />
                  ) : (
                    <span className="text-tenue">sem cotação</span>
                  )}
                </Info>
                <Info rotulo="Atualizada">
                  <span className="font-mono">{inv.cotacao_em ? quando(inv.cotacao_em) : '—'}</span>
                </Info>
              </>
            )}
            {inv.tipo === 'renda_fixa' && <Info rotulo="Rende">{descricaoTaxa(inv)}</Info>}
          </dl>

          {inv.desatualizado && !inv.arquivado && (
            <Aviso tom="atencao">A fonte de cotação não respondeu agora; o valor usa a última cotação conhecida.</Aviso>
          )}
          {erro && <Aviso>{erro}</Aviso>}

          <section>
            <TituloSecao titulo="Movimentações" />
            {!movs ? (
              <EsqueletoLista linhas={2} />
            ) : movs.length === 0 ? (
              <p className="text-sm text-tenue">Nenhum aporte ainda. O aporte entra no mês como saída.</p>
            ) : (
              <Lista>
                {movs.map((m) => {
                  const quem = m.paid_by ? nomeDoMembro(porMembro.get(m.paid_by), usuarioId) : 'o pote'
                  return (
                    <LinhaLista
                      key={m.id}
                      inicio={
                        <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-superficie-alta text-suave">
                          <Icone n={m.tipo === 'aporte' ? 'trendingUp' : 'trendingDown'} className="h-4 w-4" />
                        </span>
                      }
                      titulo={m.tipo === 'aporte' ? 'Aporte' : 'Resgate'}
                      subtitulo={
                        <>
                          <span className="font-mono">{diaMes(m.occurred_on)}</span>
                          {m.quantidade && <span className="font-mono"> · {numero(Number(m.quantidade))}</span>} · {quem}
                        </>
                      }
                      fim={
                        <Valor
                          centavos={m.amount_cents}
                          tipo={m.tipo === 'aporte' ? 'saida' : 'entrada'}
                          tamanho="sm"
                          ocultar={ocultar}
                        />
                      }
                      acoes={
                        apagando === m.id ? (
                          <Botao variante="perigo" tamanho="sm" className="mx-1" onClick={() => void tirarMovimento(m)}>
                            Apagar
                          </Botao>
                        ) : (
                          <BotaoIcone rotulo="apagar movimentação" onClick={() => setApagando(m.id)} className="text-tenue">
                            <Icone n="trash" className="h-4 w-4" />
                          </BotaoIcone>
                        )
                      }
                    />
                  )
                })}
              </Lista>
            )}
            <p className="mt-2 text-xs text-tenue">Apagar uma movimentação tira o lançamento dela do mês.</p>
          </section>

          <div className="flex flex-wrap gap-2">
            <Botao variante="fantasma" tamanho="sm" icone={<Icone n="pencil" className="h-4 w-4" />} onClick={() => setModo('editar')}>
              Editar
            </Botao>
            {!inv.arquivado && (
              <Botao variante="fantasma" tamanho="sm" onClick={() => void arquivar()}>
                Arquivar
              </Botao>
            )}
            {!temMovimento && movs && (
              <Botao
                variante="fantasma"
                tamanho="sm"
                className="text-perigo"
                icone={<Icone n="trash" className="h-4 w-4" />}
                onClick={() => setModo('remover')}
              >
                Apagar
              </Botao>
            )}
          </div>
        </div>
      )}
    </Sheet>
  )
}

function Info({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-tenue">{rotulo}</dt>
      <dd className="truncate text-texto">{children}</dd>
    </div>
  )
}

function quando(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function FormMovimento({
  inv,
  tipo,
  ledgerId,
  membros,
  usuarioId,
  aoFechar,
  aoVoltar,
  aoSalvar,
}: {
  inv: Investimento
  tipo: 'aporte' | 'resgate'
  ledgerId: string
  membros: Membro[]
  usuarioId: string
  aoFechar: () => void
  aoVoltar: () => void
  aoSalvar: (texto: string) => Promise<void>
}) {
  const [centavos, setCentavos] = useState(0)
  const [quantidade, setQuantidade] = useState('')
  const [dia, setDia] = useState(hoje())
  const [pagador, setPagador] = useState(usuarioId)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  // um id por abertura do formulário: tocar "Salvar" duas vezes não duplica
  const [id] = useState(uuidv7)
  const mercado = ehMercado(inv.tipo)

  async function salvar() {
    if (centavos <= 0) return setErro('Digite o valor.')
    const qtd = quantidade.trim().replace(/\./g, '').replace(',', '.')
    if (mercado && !(Number(qtd) > 0)) return setErro('Informe a quantidade.')
    if (!dia) return setErro('Informe a data.')
    setSalvando(true)
    try {
      await registrarMovimento(ledgerId, inv.id, {
        id,
        tipo,
        amount_cents: centavos,
        quantidade: mercado ? qtd : null,
        occurred_on: dia,
        paid_by: pagador || null,
      })
      await aoSalvar(tipo === 'aporte' ? `Aporte em ${inv.nome} lançado no mês` : `Resgate de ${inv.nome} lançado no mês`)
    } catch (e) {
      vibrar('erro')
      setErro(msg(e))
      setSalvando(false)
    }
  }

  const rodape = (
    <>
      <Botao variante="fantasma" className="flex-1" onClick={aoVoltar}>
        Voltar
      </Botao>
      <Botao className="flex-1" carregando={salvando} onClick={() => void salvar()}>
        {tipo === 'aporte' ? 'Aportar' : 'Resgatar'}
      </Botao>
    </>
  )

  const precoMedio = mercado && centavos > 0 && Number(quantidade.replace(',', '.')) > 0 ? centavos / Number(quantidade.replace(',', '.')) : null

  return (
    <Sheet aberto aoFechar={aoFechar} selo={inv.nome} titulo={tipo === 'aporte' ? 'Aporte' : 'Resgate'} rodape={rodape} alto>
      <div className="space-y-4">
        <TecladoValor
          centavos={centavos}
          aoMudar={setCentavos}
          tom={tipo === 'aporte' ? 'saida' : 'entrada'}
          rotulo={tipo === 'aporte' ? 'Quanto saiu do pote' : 'Quanto voltou pro pote'}
        />
        {mercado && (
          <Campo
            rotulo={inv.tipo === 'cripto' ? 'Quantidade (moedas)' : 'Quantidade (cotas)'}
            inputMode="decimal"
            autoComplete="off"
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value.replace(/[^\d,.]/g, ''))}
            placeholder={inv.tipo === 'cripto' ? '0,0015' : '10'}
            ajuda={
              tipo === 'resgate' && inv.quantidade
                ? `Vocês têm ${numero(Number(inv.quantidade))}`
                : precoMedio
                  ? `Preço por unidade: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(precoMedio / 100)}`
                  : undefined
            }
            className="font-mono"
          />
        )}
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Data" type="date" value={dia} max={hoje()} onChange={(e) => setDia(e.target.value)} className="font-mono" />
          <Select rotulo={tipo === 'aporte' ? 'Quem pagou' : 'Quem recebeu'} value={pagador} onChange={(e) => setPagador(e.target.value)}>
            <option value="">o pote</option>
            {membros.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {nomeDoMembro(m, usuarioId)}
              </option>
            ))}
          </Select>
        </div>
        <p className="text-xs text-tenue">
          {tipo === 'aporte'
            ? 'Entra no mês como saída, na data escolhida.'
            : 'Entra no mês como entrada, na data escolhida.'}
        </p>
        {erro && <p className="text-sm text-perigo">{erro}</p>}
      </div>
    </Sheet>
  )
}

function FormEditar({
  inv,
  ledgerId,
  aoFechar,
  aoVoltar,
  aoSalvar,
}: {
  inv: Investimento
  ledgerId: string
  aoFechar: () => void
  aoVoltar: () => void
  aoSalvar: (texto: string) => Promise<void>
}) {
  const [nome, setNome] = useState(inv.nome)
  const [ticker, setTicker] = useState(inv.ticker ?? '')
  const [indexador, setIndexador] = useState<Indexador>(inv.indexador ?? 'cdi')
  const [taxa, setTaxa] = useState(taxaTexto(inv.taxa))
  const [valor, setValor] = useState(inv.valor_atual_cents)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function salvar() {
    if (!nome.trim()) return setErro('Dê um nome.')
    const mudancas: Parameters<typeof editarInvestimento>[2] = {}
    if (nome.trim() !== inv.nome) mudancas.nome = nome.trim()
    if (ehMercado(inv.tipo) && ticker.trim() && ticker.trim().toLowerCase() !== (inv.ticker ?? '').toLowerCase()) {
      mudancas.ticker = ticker.trim()
    }
    if (inv.tipo === 'renda_fixa') {
      const t = taxaDe(taxa)
      if (t === null) return setErro('Informe a taxa.')
      if (t !== inv.taxa) mudancas.taxa = t
      if (indexador !== inv.indexador) mudancas.indexador = indexador
    }
    if (inv.tipo === 'outro' && valor !== inv.valor_atual_cents) mudancas.valor_atual_cents = valor
    if (Object.keys(mudancas).length === 0) return aoVoltar()
    setSalvando(true)
    try {
      await editarInvestimento(ledgerId, inv.id, mudancas)
      await aoSalvar(mudancas.valor_atual_cents !== undefined ? 'Valor atualizado' : 'Investimento salvo')
    } catch (e) {
      vibrar('erro')
      setErro(msg(e))
      setSalvando(false)
    }
  }

  const rodape = (
    <>
      <Botao variante="fantasma" className="flex-1" onClick={aoVoltar}>
        Voltar
      </Botao>
      <Botao className="flex-1" carregando={salvando} onClick={() => void salvar()}>
        Salvar
      </Botao>
    </>
  )

  return (
    <Sheet aberto aoFechar={aoFechar} selo={rotuloTipo(inv.tipo)} titulo="Editar investimento" rodape={rodape} alto>
      <div className="space-y-4">
        <Campo rotulo="Nome" value={nome} maxLength={80} onChange={(e) => setNome(e.target.value)} />
        {ehMercado(inv.tipo) && (
          <Campo
            rotulo={inv.tipo === 'cripto' ? 'Moeda (id da CoinGecko)' : 'Código na B3'}
            value={ticker}
            maxLength={40}
            autoComplete="off"
            onChange={(e) => setTicker(e.target.value)}
            className="font-mono"
          />
        )}
        {inv.tipo === 'renda_fixa' && (
          <>
            <Tabs cheio abas={INDEXADORES} ativa={indexador} aoTrocar={setIndexador} />
            <Campo
              rotulo={indexador === 'prefixado' ? 'Taxa ao ano (%)' : `Percentual do ${indexador === 'cdi' ? 'CDI' : 'Selic'} (%)`}
              inputMode="decimal"
              value={taxa}
              onChange={(e) => setTaxa(e.target.value.replace(/[^\d,.]/g, ''))}
              className="font-mono"
            />
          </>
        )}
        {inv.tipo === 'outro' && (
          <TecladoValor centavos={valor} aoMudar={setValor} rotulo="Quanto vale hoje" />
        )}
        {erro && <p className="text-sm text-perigo">{erro}</p>}
      </div>
    </Sheet>
  )
}
