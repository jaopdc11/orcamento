import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Aviso,
  Badge,
  BotaoIcone,
  Botao,
  CabecalhoTela,
  Campo,
  Cartao,
  Chip,
  EsqueletoLista,
  FileiraChips,
  Icone,
  IconeCategoria,
  LinhaLista,
  Lista,
  Select,
  Sheet,
  Selo,
  Valor,
  Vazio,
} from '@/design'
import { comAtraso, ouvirOrcamento } from '@/lib/eventos'
import { mapaDeMembros, nomeDoMembro } from '@/lib/membros'
import type { ContextoOrcamento, Especie, Lancamento } from '@/lib/tipos'
import { buscarLancamentos, type FiltroBusca } from './busca.queries'
import { ativarPush, desativarPush, estadoPush, type EstadoPush } from '../notificacoes/push'

export type Props = ContextoOrcamento

const POR_PAGINA = 50


/** Espera o usuário parar de digitar: cada tecla não vira uma requisição. */
function useAdiado<T>(valor: T, ms = 300): T {
  const [v, setV] = useState(valor)
  useEffect(() => {
    const t = setTimeout(() => setV(valor), ms)
    return () => clearTimeout(t)
  }, [valor, ms])
  return v
}

const ddmm = (dia: string) => {
  const [a, m, d] = dia.split('-')
  return `${d}/${m}/${a?.slice(2)}`
}

const TIPOS: Array<{ id: '' | Especie; rotulo: string }> = [
  { id: '', rotulo: 'Tudo' },
  { id: 'expense', rotulo: 'Saídas' },
  { id: 'income', rotulo: 'Entradas' },
]

export function Busca({ orcamento, usuarioId, membros, categorias, ocultar }: Props) {
  const ledgerId = orcamento.id
  const [texto, setTexto] = useState('')
  const [categoria, setCategoria] = useState('')
  const [membro, setMembro] = useState('')
  const [kind, setKind] = useState<'' | Especie>('')
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [abertos, setAbertos] = useState(false)

  const q = useAdiado(texto.trim())
  const filtro = useMemo<FiltroBusca>(
    () => ({
      q: q || undefined,
      category_id: categoria || undefined,
      membro: membro || undefined,
      kind: kind || undefined,
      de: de || undefined,
      ate: ate || undefined,
      limite: POR_PAGINA,
    }),
    [q, categoria, membro, kind, de, ate],
  )

  const [itens, setItens] = useState<Lancamento[]>([])
  const [proximo, setProximo] = useState<string | null>(null)
  const [totais, setTotais] = useState({ entrou: 0, saiu: 0 })
  const [carregando, setCarregando] = useState(true)
  const [carregandoMais, setCarregandoMais] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  // descarta resposta de um filtro velho que chegou depois da do novo
  const geracao = useRef(0)

  const recarregar = useCallback(async () => {
    const minha = ++geracao.current
    try {
      const r = await buscarLancamentos(ledgerId, filtro)
      if (minha !== geracao.current) return
      setItens(Array.isArray(r?.itens) ? r.itens : [])
      setProximo(r?.proximo ?? null)
      setTotais({ entrou: r?.entrou_cents ?? 0, saiu: r?.saiu_cents ?? 0 })
      setErro(null)
    } catch (e) {
      if (minha === geracao.current) setErro(e instanceof Error ? e.message : 'Falhou ao buscar.')
    } finally {
      if (minha === geracao.current) setCarregando(false)
    }
  }, [ledgerId, filtro])

  useEffect(() => {
    setCarregando(true)
    void recarregar()
  }, [recarregar])

  useEffect(() => {
    const releitura = comAtraso(() => void recarregar())
    const parar = ouvirOrcamento(ledgerId, (tipo) => {
      if (tipo === 'lancamentos') releitura.chamar()
    })
    return () => {
      parar()
      releitura.cancelar()
    }
  }, [ledgerId, recarregar])

  async function carregarMais() {
    if (!proximo || carregandoMais) return
    setCarregandoMais(true)
    const minha = geracao.current
    try {
      const r = await buscarLancamentos(ledgerId, { ...filtro, cursor: proximo })
      if (minha !== geracao.current) return
      setItens((atual) => {
        const vistos = new Set(atual.map((e) => e.id))
        return [...atual, ...(r.itens ?? []).filter((e) => !vistos.has(e.id))]
      })
      setProximo(r.proximo ?? null)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falhou ao carregar mais.')
    } finally {
      setCarregandoMais(false)
    }
  }

  const porMembro = useMemo(() => mapaDeMembros(membros), [membros])
  const porCategoria = useMemo(() => new Map(categorias.map((c) => [c.id, c])), [categorias])
  const categoriasDoTipo = useMemo(
    () => (kind ? categorias.filter((c) => c.kind === kind) : categorias),
    [categorias, kind],
  )
  const qtdFiltros = [categoria, membro, de, ate].filter(Boolean).length

  function limpar() {
    setTexto('')
    setCategoria('')
    setMembro('')
    setKind('')
    setDe('')
    setAte('')
  }

  // Na fileira de chips só o que muda a cada toque (tipo); o resto (categoria,
  // pessoa, período) mora num Sheet pra não empurrar os resultados pra baixo.
  const nomeCat = categoria ? porCategoria.get(categoria)?.nome : undefined
  const nomeMembro = membro === 'eu' ? 'eu' : membro ? nomeDoMembro(porMembro.get(membro)) : undefined
  const periodo = de || ate ? `${de ? ddmm(de) : '…'} – ${ate ? ddmm(ate) : '…'}` : undefined
  const temAlgo = !!texto.trim() || !!kind || qtdFiltros > 0

  return (
    <div>
      <CabecalhoTela selo="Lançamentos" titulo="Busca" descricao="Ache qualquer lançamento do orçamento" />

      <div className="relative mb-3">
        <span className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-tenue">
          <Icone n="search" className="h-5 w-5" />
        </span>
        <Campo
          type="search"
          value={texto}
          maxLength={100}
          // O usuário veio pra buscar: teclado já aberto economiza um toque.
          autoFocus
          enterKeyHint="search"
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Buscar na descrição"
          aria-label="Buscar na descrição"
          className="min-h-12 pl-11 pr-12 text-base"
        />
        {texto && (
          <span className="absolute right-0 top-1/2 -translate-y-1/2">
            <BotaoIcone rotulo="Limpar busca" onClick={() => setTexto('')}>
              <Icone n="x" className="h-4 w-4" />
            </BotaoIcone>
          </span>
        )}
      </div>

      <FileiraChips className="mb-4">
        {TIPOS.map((t) => (
          <Chip key={t.id || 'tudo'} ativo={kind === t.id} aoTocar={() => { setKind(t.id); setCategoria('') }}>
            {t.rotulo}
          </Chip>
        ))}
        <Chip
          ativo={qtdFiltros > 0}
          aoTocar={() => setAbertos(true)}
          icone={<Icone n="list" className="h-3.5 w-3.5" />}
        >
          Filtros{qtdFiltros ? <span className="ml-1 font-mono">{qtdFiltros}</span> : null}
        </Chip>
      </FileiraChips>

      {qtdFiltros > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          {nomeCat && <Badge tom="acento">{nomeCat}</Badge>}
          {nomeMembro && <Badge tom="acento">{nomeMembro}</Badge>}
          {periodo && <Badge tom="acento" mono>{periodo}</Badge>}
          <button type="button" onClick={limpar} className="min-h-9 px-2 text-xs font-semibold text-acento">
            Limpar
          </button>
        </div>
      )}

      {erro && (
        <Aviso className="mb-3" aoTentarDeNovo={() => void recarregar()}>
          {erro}
        </Aviso>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3">
        <Cartao>
          <Selo>Entrou</Selo>
          <Valor centavos={totais.entrou} tipo="entrada" tamanho="lg" ocultar={ocultar} className="mt-1 block" />
        </Cartao>
        <Cartao>
          <Selo>Saiu</Selo>
          <Valor centavos={totais.saiu} tipo="saida" tamanho="lg" ocultar={ocultar} className="mt-1 block" />
        </Cartao>
      </div>

      {carregando ? (
        <EsqueletoLista linhas={5} />
      ) : itens.length === 0 ? (
        <Vazio
          icone="search"
          titulo={temAlgo ? 'Nada bate com essa busca.' : 'Nenhum lançamento neste orçamento ainda.'}
          descricao={temAlgo ? 'Tente uma palavra mais curta ou afrouxe os filtros.' : undefined}
          acao={
            temAlgo ? (
              <Botao variante="secundario" onClick={limpar}>
                Limpar busca e filtros
              </Botao>
            ) : undefined
          }
        />
      ) : (
        // Sem cascata: a lista muda a cada tecla e a animação viraria tremedeira.
        <Lista>
          {itens.map((e) => {
            const cat = e.category_id ? porCategoria.get(e.category_id) : undefined
            const dono = nomeDoMembro(porMembro.get(e.paid_by ?? e.created_by), usuarioId)
            return (
              <LinhaLista
                key={e.id}
                inicio={<IconeCategoria categoria={cat} />}
                titulo={e.descricao || cat?.nome || (e.kind === 'income' ? 'Entrada' : 'Saída')}
                subtitulo={
                  <>
                    <span className="font-mono">{ddmm(e.occurred_on)}</span>
                    {cat && e.descricao ? ` · ${cat.nome}` : ''} · {dono}
                  </>
                }
                fim={
                  <Valor
                    centavos={e.amount_cents}
                    tipo={e.kind === 'income' ? 'entrada' : 'saida'}
                    ocultar={ocultar}
                    tamanho="sm"
                  />
                }
              />
            )
          })}
        </Lista>
      )}

      {proximo && !carregando && (
        <div className="mt-4 flex justify-center">
          <Botao variante="fantasma" carregando={carregandoMais} onClick={() => void carregarMais()}>
            Carregar mais
          </Botao>
        </div>
      )}

      <AvisosDeMeta />

      <Sheet
        aberto={abertos}
        aoFechar={() => setAbertos(false)}
        selo="Busca"
        titulo="Filtros"
        rodape={
          <>
            <Botao variante="fantasma" className="flex-1" onClick={limpar}>
              Limpar
            </Botao>
            <Botao className="flex-1" onClick={() => setAbertos(false)}>
              Ver resultados
            </Botao>
          </>
        }
      >
        <div className="space-y-4">
          <Select rotulo="Categoria" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            <option value="">todas</option>
            {categoriasDoTipo.map((c) => (
              <option key={c.id} value={c.id}>
                {c.emoji ? `${c.emoji} ` : ''}
                {c.nome}
              </option>
            ))}
          </Select>
          <Select rotulo="De quem" value={membro} onChange={(e) => setMembro(e.target.value)}>
            <option value="">todos</option>
            <option value="eu">eu</option>
            {membros
              .filter((m) => m.user_id !== usuarioId)
              .map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {nomeDoMembro(m)}
                </option>
              ))}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="De" type="date" value={de} onChange={(e) => setDe(e.target.value)} className="font-mono" />
            <Campo rotulo="Até" type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="font-mono" />
          </div>
        </div>
      </Sheet>
    </div>
  )
}

const TEXTO_ESTADO: Record<EstadoPush, string> = {
  'sem-suporte': 'Este navegador não recebe avisos (no iPhone, instale o app na tela inicial).',
  'desligado-servidor': 'Avisos indisponíveis no servidor.',
  bloqueado: 'Notificações bloqueadas nas configurações do navegador.',
  inativo: 'Receba um aviso quando uma categoria chegar a 80% ou estourar a meta.',
  ativo: 'Avisos de meta ligados neste aparelho.',
}

/** Liga/desliga o push de meta. Exportado porque o Perfil mostra o mesmo cartão. */
export function AvisosDeMeta() {
  const [estado, setEstado] = useState<EstadoPush | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    estadoPush()
      .then((s) => vivo && setEstado(s))
      .catch(() => vivo && setEstado('desligado-servidor'))
    return () => {
      vivo = false
    }
  }, [])

  async function alternar() {
    setOcupado(true)
    setErro(null)
    try {
      setEstado(estado === 'ativo' ? await desativarPush() : await ativarPush())
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu pra mudar os avisos.')
    } finally {
      setOcupado(false)
    }
  }

  if (!estado) return null
  const podeAlternar = estado === 'ativo' || estado === 'inativo'
  return (
    <Cartao className="mt-6 flex items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-tinta-acento text-acento">
        <Icone n="bell" className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-texto">Avisos de meta</p>
        <p className={erro ? 'text-xs text-perigo' : 'text-xs text-suave'}>{erro ?? TEXTO_ESTADO[estado]}</p>
      </div>
      {podeAlternar && (
        <Botao
          tamanho="sm"
          variante={estado === 'ativo' ? 'secundario' : 'primario'}
          carregando={ocupado}
          onClick={() => void alternar()}
          className="shrink-0"
        >
          {estado === 'ativo' ? 'Desligar' : 'Ativar avisos'}
        </Botao>
      )}
    </Cartao>
  )
}
