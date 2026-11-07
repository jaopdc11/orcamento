import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
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
  Icone,
  IconeCategoria,
  Lista,
  LinhaLista,
  Select,
  Selo,
  Sheet,
  Tabs,
  Valor,
  Vazio,
  useToast,
  vibrar, TecladoValor,
} from '@/design'
import { comAtraso, ouvirOrcamento } from '@/lib/eventos'
import { mapaDeMembros, nomeDoMembro } from '@/lib/membros'
import type { Categoria, ContextoOrcamento, Especie, Recorrente } from '@/lib/tipos'
import {
  apagarRecorrente,
  criarRecorrente,
  editarRecorrente,
  listarRecorrentes,
  type DadosRecorrente,
} from './recorrentes.queries'

export type Props = ContextoOrcamento

const msg = (e: unknown) => (e instanceof Error ? e.message : 'Não deu certo.')

export function Recorrentes({ orcamento, usuarioId, membros, categorias, ocultar }: Props) {
  const ledgerId = orcamento.id
  const toast = useToast()
  const [lista, setLista] = useState<Recorrente[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  // null = Sheet fechado; 'novo' = criando; senão o recorrente em edição
  const [editando, setEditando] = useState<Recorrente | 'novo' | null>(null)

  const recarregar = useCallback(async () => {
    try {
      setLista(await listarRecorrentes(ledgerId))
      setErro(null)
    } catch (e) {
      setErro(msg(e))
    }
  }, [ledgerId])

  useEffect(() => {
    setLista(null)
    setEditando(null)
    void recarregar()
  }, [recarregar])

  useEffect(() => {
    const releitura = comAtraso(() => void recarregar())
    const parar = ouvirOrcamento(ledgerId, (tipo) => {
      if (tipo === 'recorrentes') releitura.chamar()
    })
    return () => {
      parar()
      releitura.cancelar()
    }
  }, [ledgerId, recarregar])

  const porMembro = useMemo(() => mapaDeMembros(membros), [membros])
  const porCategoria = useMemo(() => new Map(categorias.map((c) => [c.id, c])), [categorias])

  // Ordem do calendário: a pessoa pensa "o que cai primeiro no mês".
  const ordenada = useMemo(() => [...(lista ?? [])].sort((a, b) => a.dia_do_mes - b.dia_do_mes), [lista])

  // Quanto já está "comprometido" todo mês: é a pergunta que faz alguém abrir esta tela.
  const totais = useMemo(() => {
    const ativos = (lista ?? []).filter((r) => r.ativo)
    return {
      saida: ativos.filter((r) => r.kind === 'expense').reduce((s, r) => s + r.amount_cents, 0),
      entrada: ativos.filter((r) => r.kind === 'income').reduce((s, r) => s + r.amount_cents, 0),
      ativos: ativos.length,
    }
  }, [lista])

  async function alternar(r: Recorrente) {
    try {
      await editarRecorrente(ledgerId, r.id, { ativo: !r.ativo })
      vibrar('leve')
      toast.mostrar(r.ativo ? `${r.descricao} pausado` : `${r.descricao} retomado`, { tom: 'info' })
      await recarregar()
    } catch (e) {
      setErro(msg(e))
    }
  }

  const botaoNovo = (
    <Botao tamanho="sm" onClick={() => setEditando('novo')} icone={<Icone n="plus" className="h-4 w-4" />}>
      Novo
    </Botao>
  )

  return (
    <div className="mx-auto max-w-2xl">
      <CabecalhoTela
        selo="Todo mês"
        titulo="Recorrentes"
        descricao="Contas que se repetem entram sozinhas no mês"
        acao={lista && lista.length > 0 ? botaoNovo : undefined}
      />

      {erro && (
        <Aviso className="mb-4" aoTentarDeNovo={() => void recarregar()}>
          {erro}
        </Aviso>
      )}

      {!lista ? (
        !erro && <EsqueletoLista linhas={5} />
      ) : lista.length === 0 ? (
        <Cartao>
          <Vazio
            icone="repeat"
            titulo="Nada recorrente ainda."
            descricao="Aluguel, internet, salário: cadastre uma vez e ele cai sozinho todo mês."
            acao={
              <Botao onClick={() => setEditando('novo')} icone={<Icone n="plus" className="h-4 w-4" />}>
                Novo recorrente
              </Botao>
            }
          />
        </Cartao>
      ) : (
        <div className="space-y-6">
          <div className="cascata grid grid-cols-2 gap-3">
            <Cartao>
              <Selo>Saídas fixas / mês</Selo>
              <Valor centavos={totais.saida} tipo="saida" tamanho="lg" ocultar={ocultar} className="mt-1 block" />
            </Cartao>
            <Cartao>
              <Selo>Entradas fixas / mês</Selo>
              <Valor centavos={totais.entrada} tipo="entrada" tamanho="lg" ocultar={ocultar} className="mt-1 block" />
            </Cartao>
          </div>

          <section>
            <Selo className="mb-2">
              <span className="font-mono">{totais.ativos}</span> ativo{totais.ativos === 1 ? '' : 's'} ·{' '}
              <span className="font-mono">{lista.length - totais.ativos}</span> pausado{lista.length - totais.ativos === 1 ? '' : 's'}
            </Selo>
            <Lista cascata>
              {ordenada.map((r) => {
                const cat = r.category_id ? porCategoria.get(r.category_id) : undefined
                const pagador = r.paid_by ? nomeDoMembro(porMembro.get(r.paid_by), usuarioId) : null
                return (
                  <LinhaLista
                    key={r.id}
                    apagada={!r.ativo}
                    inicio={<DiaDoMes dia={r.dia_do_mes} />}
                    titulo={r.descricao}
                    subtitulo={
                      <>
                        {cat ? `${cat.emoji ?? ''} ${cat.nome}`.trim() : 'sem categoria'}
                        {pagador && ` · ${pagador}`}
                      </>
                    }
                    fim={<Valor centavos={r.amount_cents} tipo={r.kind === 'income' ? 'entrada' : 'saida'} tamanho="sm" ocultar={ocultar} />}
                    aoTocar={() => setEditando(r)}
                    acoes={
                      <Chip ativo={r.ativo} aoTocar={() => void alternar(r)} className="mx-1">
                        {r.ativo ? 'ativo' : 'pausado'}
                      </Chip>
                    }
                  />
                )
              })}
            </Lista>
            <p className="mt-2 text-xs text-tenue">Toque no chip pra pausar ou retomar; na linha pra editar.</p>
          </section>
        </div>
      )}

      <SheetRecorrente
        aberto={editando !== null}
        atual={editando === 'novo' ? undefined : (editando ?? undefined)}
        {...{ ledgerId, membros, categorias, usuarioId }}
        aoFechar={() => setEditando(null)}
        aoSalvar={async (texto) => {
          vibrar('sucesso')
          toast.mostrar(texto)
          setEditando(null)
          await recarregar()
        }}
        aoApagar={async (r) => {
          await apagarRecorrente(ledgerId, r.id)
          vibrar('aviso')
          toast.mostrar(`${r.descricao} apagado`)
          setEditando(null)
          await recarregar()
        }}
      />
    </div>
  )
}

/** Quadradinho "dia 05": âncora visual do calendário no início da linha. */
function DiaDoMes({ dia }: { dia: number }) {
  return (
    <span className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-[10px] border border-borda bg-campo leading-none">
      <span className="text-[9px] uppercase tracking-[.15em] text-tenue">dia</span>
      <span className="mt-0.5 font-mono text-sm font-semibold text-texto">{String(dia).padStart(2, '0')}</span>
    </span>
  )
}

function SheetRecorrente({
  aberto,
  ledgerId,
  membros,
  categorias,
  usuarioId,
  atual,
  aoFechar,
  aoSalvar,
  aoApagar,
}: Pick<Props, 'membros' | 'categorias' | 'usuarioId'> & {
  aberto: boolean
  ledgerId: string
  atual?: Recorrente
  aoFechar: () => void
  aoSalvar: (texto: string) => Promise<void>
  aoApagar: (r: Recorrente) => Promise<void>
}) {
  const [descricao, setDescricao] = useState('')
  const [centavos, setCentavos] = useState(0)
  const [kind, setKind] = useState<Especie>('expense')
  const [categoria, setCategoria] = useState('')
  const [pagador, setPagador] = useState('')
  const [dia, setDia] = useState(5)
  const [diaTexto, setDiaTexto] = useState('5')
  const [salvando, setSalvando] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Sheet fica montado: cada abertura recomeça do recorrente tocado (ou do zero).
  useEffect(() => {
    if (!aberto) return
    setDescricao(atual?.descricao ?? '')
    setCentavos(atual?.amount_cents ?? 0)
    setKind(atual?.kind ?? 'expense')
    setCategoria(atual?.category_id ?? '')
    setPagador(atual?.paid_by ?? '')
    setDia(atual?.dia_do_mes ?? 5)
    setDiaTexto(String(atual?.dia_do_mes ?? 5))
    setSalvando(false)
    setConfirmando(false)
    setErro(null)
  }, [aberto, atual])

  const opcoes = useMemo(() => categorias.filter((c) => c.kind === kind), [categorias, kind])

  async function salvar() {
    if (!descricao.trim()) return setErro('Dê um nome.')
    if (centavos <= 0) return setErro('Digite o valor.')
    const dados: DadosRecorrente = {
      descricao: descricao.trim(),
      amount_cents: centavos,
      kind,
      // categoria de outro tipo (trocou entrada/saída) cai pra "sem categoria"
      category_id: opcoes.some((c) => c.id === categoria) ? categoria : null,
      paid_by: pagador || null,
      dia_do_mes: dia,
    }
    setSalvando(true)
    try {
      if (atual) await editarRecorrente(ledgerId, atual.id, dados)
      else await criarRecorrente(ledgerId, dados)
      await aoSalvar(atual ? 'Recorrente salvo' : `${dados.descricao} entra todo dia ${dia}`)
    } catch (e) {
      vibrar('erro')
      setErro(msg(e))
      setSalvando(false)
    }
  }

  async function apagar() {
    if (!atual) return
    setSalvando(true)
    try {
      await aoApagar(atual)
    } catch (e) {
      setErro(msg(e))
      setSalvando(false)
    }
  }

  const rodape = confirmando ? (
    <>
      <Botao variante="fantasma" className="flex-1" onClick={() => setConfirmando(false)}>
        Voltar
      </Botao>
      <Botao variante="perigo" className="flex-1" carregando={salvando} onClick={() => void apagar()}>
        Apagar de vez
      </Botao>
    </>
  ) : (
    <>
      {atual && (
        <BotaoIcone rotulo="apagar recorrente" onClick={() => setConfirmando(true)} className="text-perigo">
          <Icone n="trash" className="h-5 w-5" />
        </BotaoIcone>
      )}
      <Botao variante="fantasma" className="flex-1" onClick={aoFechar}>
        Cancelar
      </Botao>
      <Botao className="flex-1" carregando={salvando} onClick={() => void salvar()}>
        {atual ? 'Salvar' : 'Criar'}
      </Botao>
    </>
  )

  return (
    <Sheet aberto={aberto} aoFechar={aoFechar} selo="Recorrentes" titulo={atual ? 'Editar recorrente' : 'Novo recorrente'} rodape={rodape} alto>
      {confirmando ? (
        <div className="animate-fade py-6 text-center">
          <p className="text-sm font-medium text-texto">Apagar “{atual?.descricao}”?</p>
          <p className="mt-1 text-sm text-suave">Os lançamentos já gerados ficam no histórico.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <Tabs
            cheio
            tom={kind === 'expense' ? 'saida' : 'entrada'}
            abas={[
              { id: 'expense', rotulo: 'Saída' },
              { id: 'income', rotulo: 'Entrada' },
            ]}
            ativa={kind}
            aoTrocar={setKind}
          />

          <Campo rotulo="Nome" value={descricao} maxLength={200} onChange={(e) => setDescricao(e.target.value)} placeholder="Aluguel" />

          <TecladoValor centavos={centavos} aoMudar={setCentavos} tom={kind === 'expense' ? 'saida' : 'entrada'} rotulo="Valor todo mês" />

          <div className="grid grid-cols-2 gap-3">
            {/* texto que só aceita dígito: digitar "15" é mais rápido que achar 15 numa lista,
                e o <select> nativo dentro do sheet pedia clicar e segurar no PC */}
            <Campo
              rotulo="Todo dia"
              inputMode="numeric"
              autoComplete="off"
              maxLength={2}
              value={diaTexto}
              onChange={(e) => {
                const so = e.target.value.replace(/\D/g, '').slice(0, 2)
                setDiaTexto(so)
                const n = Number(so)
                if (n >= 1 && n <= 28) setDia(n)
              }}
              // fora de 1–28 (ou vazio) volta pro último dia válido ao sair do campo
              onBlur={() => setDiaTexto(String(dia))}
              ajuda="de 1 a 28"
              erro={diaTexto !== '' && (Number(diaTexto) < 1 || Number(diaTexto) > 28) ? 'de 1 a 28' : undefined}
              className="font-mono"
            />
            <Select rotulo="Quem paga" value={pagador} onChange={(e) => setPagador(e.target.value)}>
              <option value="">o pote</option>
              {membros.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {nomeDoMembro(m, usuarioId)}
                </option>
              ))}
            </Select>
          </div>

          <EscolhaCategoria opcoes={opcoes} valor={categoria} aoMudar={setCategoria} />

          {atual && (
            <p className="flex items-center gap-2 text-xs text-tenue">
              <Badge tom="atencao">aviso</Badge> A mudança vale para os meses que ainda não foram gerados.
            </p>
          )}
          {erro && <p className="text-sm text-perigo">{erro}</p>}
        </div>
      )}
    </Sheet>
  )
}

/** Grade de categorias tocáveis (mesma linguagem do Lancar); "nenhuma" fica primeiro. */
function EscolhaCategoria({ opcoes, valor, aoMudar }: { opcoes: Categoria[]; valor: string; aoMudar: (id: string) => void }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-suave">Categoria</p>
      <div className="grid grid-cols-4 gap-2">
        <BotaoCat ativo={valor === ''} aoTocar={() => aoMudar('')} rotulo="nenhuma">
          <IconeCategoria categoria={null} tamanho="sm" />
        </BotaoCat>
        {opcoes.map((c) => (
          <BotaoCat key={c.id} ativo={valor === c.id} aoTocar={() => aoMudar(c.id)} rotulo={c.nome}>
            <IconeCategoria categoria={c} tamanho="sm" />
          </BotaoCat>
        ))}
      </div>
    </div>
  )
}

function BotaoCat({ ativo, aoTocar, rotulo, children }: { ativo: boolean; aoTocar: () => void; rotulo: string; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={aoTocar}
      aria-pressed={ativo}
      className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-card border px-1 py-2 transition-[transform,border-color,background-color] duration-150 ease-suave active:scale-[0.97] ${
        ativo ? 'border-acento bg-tinta-acento' : 'border-borda bg-campo'
      }`}
    >
      {children}
      <span className={`w-full truncate text-center text-[11px] ${ativo ? 'text-acento' : 'text-suave'}`}>{rotulo}</span>
    </button>
  )
}
