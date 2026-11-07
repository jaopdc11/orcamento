import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Aviso,
  Botao,
  CabecalhoTela,
  Chip,
  EsqueletoLista,
  FileiraChips,
  Icone,
  Selo,
  Vazio,
  cx,
  type NomeIcone,
} from '@/design'
import { comAtraso, ouvirOrcamento } from '@/lib/eventos'
import { mapaDeMembros, nomeDoMembro } from '@/lib/membros'
import { formatar } from '@/lib/dinheiro'
import { buscarHistorico } from './historico.queries'
import type { Atividade, ContextoOrcamento, TipoAtividade } from '@/lib/tipos'

export type Props = ContextoOrcamento

const POR_PAGINA = 50

/** Verbo da frase "<quem> <verbo> <resumo>" e ícone, por tipo. */
const FRASE: Record<TipoAtividade, { verbo: string; icone: NomeIcone }> = {
  'orcamento.criado': { verbo: 'criou o orçamento', icone: 'wallet' },
  'orcamento.renomeado': { verbo: 'renomeou o orçamento', icone: 'pencil' },
  'membro.entrou': { verbo: 'entrou', icone: 'users' },
  'membro.saiu': { verbo: 'saiu', icone: 'logOut' },
  'membro.removido': { verbo: 'removeu', icone: 'users' },
  'membro.proporcao': { verbo: 'mudou a proporção', icone: 'scale' },
  'convite.criado': { verbo: 'gerou um convite', icone: 'users' },
  'lancamento.criado': { verbo: 'lançou', icone: 'plus' },
  'lancamento.editado': { verbo: 'editou', icone: 'pencil' },
  'lancamento.apagado': { verbo: 'apagou', icone: 'trash' },
  'categoria.criada': { verbo: 'criou a categoria', icone: 'grid' },
  'categoria.editada': { verbo: 'editou a categoria', icone: 'grid' },
  'categoria.arquivada': { verbo: 'arquivou a categoria', icone: 'grid' },
  'categoria.desarquivada': { verbo: 'reativou a categoria', icone: 'grid' },
  'categorias.reordenadas': { verbo: 'reordenou as categorias', icone: 'list' },
  'meta.definida': { verbo: 'definiu a meta', icone: 'target' },
  'meta.removida': { verbo: 'removeu a meta', icone: 'target' },
  'metas.copiadas': { verbo: 'copiou as metas', icone: 'target' },
  'economia.definida': { verbo: 'definiu a meta de economia', icone: 'wallet' },
  'economia.removida': { verbo: 'removeu a meta de economia', icone: 'wallet' },
  'recorrente.criado': { verbo: 'criou o recorrente', icone: 'repeat' },
  'recorrente.editado': { verbo: 'editou o recorrente', icone: 'repeat' },
  'recorrente.removido': { verbo: 'removeu o recorrente', icone: 'repeat' },
}

// O resumo vem pronto do servidor com o valor dentro ("Saída de R$ 40,00 em
// Mercado"); com o olho fechado o valor tem que sumir dele também.
const VALOR = /-?R\$\s?[\d.]+,\d{2}/g
const esconder = (txt: string, ocultar: boolean) => (ocultar ? txt.replace(VALOR, 'R$ ••••') : txt)

/** Família de atividade: dá o filtro por tipo e a tinta do ícone. */
type Familia = 'lancamento' | 'meta' | 'categoria' | 'recorrente' | 'pessoas'
const familia = (t: string): Familia => {
  if (t.startsWith('lancamento')) return 'lancamento'
  if (t.startsWith('meta') || t.startsWith('economia')) return 'meta'
  if (t.startsWith('categoria')) return 'categoria'
  if (t.startsWith('recorrente')) return 'recorrente'
  return 'pessoas' // membro, convite, orçamento: quem está no grupo e como ele se chama
}
const FAMILIAS: Array<{ id: Familia | ''; rotulo: string }> = [
  { id: '', rotulo: 'Tudo' },
  { id: 'lancamento', rotulo: 'Lançamentos' },
  { id: 'meta', rotulo: 'Metas' },
  { id: 'categoria', rotulo: 'Categorias' },
  { id: 'recorrente', rotulo: 'Recorrentes' },
  { id: 'pessoas', rotulo: 'Pessoas' },
]

/** Tinta do ícone: apagar é o único evento que merece chamar atenção. */
function tintaDoIcone(t: string): string {
  if (t === 'lancamento.apagado' || t.endsWith('removido') || t.endsWith('removida') || t === 'membro.saiu')
    return 'bg-tinta-perigo text-perigo'
  if (t === 'lancamento.criado') return 'bg-tinta-acento text-acento'
  return 'bg-superficie-alta text-suave'
}

/** Rótulo do grupo do dia: 'Hoje', 'Ontem' ou 'qua, 03/11'. */
function rotuloDoDia(dia: string, agora = new Date()): string {
  const ontem = new Date(agora)
  ontem.setDate(agora.getDate() - 1)
  if (dia === diaLocal(agora)) return 'Hoje'
  if (dia === diaLocal(ontem)) return 'Ontem'
  const [a, m, d] = dia.split('-').map(Number)
  const data = new Date(a!, m! - 1, d!)
  const semana = data.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
  const curta = data.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    ...(a !== agora.getFullYear() ? { year: '2-digit' } : {}),
  })
  return `${semana}, ${curta}`
}

const horaDe = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

const diaLocal = (d: Date) => d.toLocaleDateString('en-CA')

/** 'hoje 21:03' | 'ontem 21:03' | '03/11 21:03' (fuso do aparelho). */
export function quando(iso: string, agora = new Date()): string {
  const d = new Date(iso)
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const ontem = new Date(agora)
  ontem.setDate(agora.getDate() - 1)
  if (diaLocal(d) === diaLocal(agora)) return `hoje ${hora}`
  if (diaLocal(d) === diaLocal(ontem)) return `ontem ${hora}`
  const data = d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    ...(d.getFullYear() !== agora.getFullYear() ? { year: '2-digit' } : {}),
  })
  return `${data} ${hora}`
}

const ROTULO_CAMPO: Record<string, string> = {
  amount_cents: 'valor',
  kind: 'tipo',
  category_id: 'categoria',
  occurred_on: 'data',
  descricao: 'descrição',
  paid_by: 'quem pagou',
}

/** "valor R$ 10,00 → R$ 40,00 · descrição pão → feira" a partir de dados.antes/depois. */
function detalheDaEdicao(
  a: Atividade,
  ctx: { ocultar: boolean; categoria: (id: string) => string; membro: (id: string) => string },
): string | null {
  const dados = a.dados as { antes?: Record<string, unknown>; depois?: Record<string, unknown> } | null
  if (!dados?.antes || !dados.depois) return null
  const mostrar = (campo: string, v: unknown): string => {
    if (v === null || v === undefined || v === '') return '—'
    if (campo === 'amount_cents') return ctx.ocultar ? 'R$ ••••' : formatar(Number(v))
    if (campo === 'kind') return v === 'income' ? 'entrada' : 'saída'
    if (campo === 'category_id') return ctx.categoria(String(v))
    if (campo === 'paid_by') return ctx.membro(String(v))
    if (campo === 'occurred_on') {
      const [, m, d] = String(v).split('-')
      return `${d}/${m}`
    }
    return String(v)
  }
  const partes = Object.keys(dados.depois).map(
    (campo) =>
      `${ROTULO_CAMPO[campo] ?? campo} ${mostrar(campo, dados.antes![campo])} → ${mostrar(campo, dados.depois![campo])}`,
  )
  return partes.length ? partes.join(' · ') : null
}

export function Historico({ orcamento, usuarioId, membros, categorias, ocultar }: Props) {
  const ledgerId = orcamento.id
  const [itens, setItens] = useState<Atividade[]>([])
  const [proximo, setProximo] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [carregandoMais, setCarregandoMais] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const porMembro = useMemo(() => mapaDeMembros(membros), [membros])
  // Categoria arquivada não vem no contexto (só ativas): cai no genérico.
  const nomeCategoria = useMemo(() => {
    const m = new Map(categorias.map((c) => [c.id, c.nome]))
    return (id: string) => m.get(id) ?? 'outra categoria'
  }, [categorias])

  // Relê só a primeira página: quem já rolou e carregou mais perde o resto,
  // mas o que importa num feed ao vivo é o topo.
  const recarregar = useCallback(async () => {
    try {
      const p = await buscarHistorico(ledgerId, { limite: POR_PAGINA })
      setItens(Array.isArray(p?.itens) ? p.itens : [])
      setProximo(p?.proximo ?? null)
      setErro(null)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falhou ao carregar o histórico.')
    } finally {
      setCarregando(false)
    }
  }, [ledgerId])

  useEffect(() => {
    setCarregando(true)
    setItens([])
    void recarregar()
  }, [recarregar])

  useEffect(() => {
    const releitura = comAtraso(() => void recarregar())
    const parar = ouvirOrcamento(ledgerId, (tipo) => {
      if (tipo === 'historico') releitura.chamar()
    })
    return () => {
      parar()
      releitura.cancelar()
    }
  }, [ledgerId, recarregar])

  async function carregarMais() {
    if (!proximo || carregandoMais) return
    setCarregandoMais(true)
    try {
      const p = await buscarHistorico(ledgerId, { antes: proximo, limite: POR_PAGINA })
      setItens((atual) => {
        const vistos = new Set(atual.map((a) => a.id))
        return [...atual, ...(p.itens ?? []).filter((a) => !vistos.has(a.id))]
      })
      setProximo(p.proximo ?? null)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falhou ao carregar mais.')
    } finally {
      setCarregandoMais(false)
    }
  }

  const [filtroFamilia, setFiltroFamilia] = useState<Familia | ''>('')
  const [filtroMembro, setFiltroMembro] = useState('')

  // O filtro é local, sobre o que já veio: a API do histórico não filtra e não
  // vamos mexer no contrato. "Carregar mais" continua trazendo do servidor.
  const grupos = useMemo(() => {
    const filtrados = itens.filter(
      (a) => (!filtroFamilia || familia(a.tipo) === filtroFamilia) && (!filtroMembro || a.user_id === filtroMembro),
    )
    const porDia: Array<{ dia: string; itens: Atividade[] }> = []
    for (const a of filtrados) {
      const dia = diaLocal(new Date(a.created_at))
      const ultimo = porDia[porDia.length - 1]
      if (ultimo?.dia === dia) ultimo.itens.push(a)
      else porDia.push({ dia, itens: [a] })
    }
    return porDia
  }, [itens, filtroFamilia, filtroMembro])

  const filtrando = !!filtroFamilia || !!filtroMembro

  return (
    <div>
      <CabecalhoTela selo="Atividade" titulo="Histórico" descricao="Quem fez o quê neste orçamento" />

      <div className="mb-4 space-y-2">
        <FileiraChips>
          {FAMILIAS.map((f) => (
            <Chip key={f.id || 'tudo'} ativo={filtroFamilia === f.id} aoTocar={() => setFiltroFamilia(f.id)}>
              {f.rotulo}
            </Chip>
          ))}
        </FileiraChips>
        {membros.length > 1 && (
          <FileiraChips>
            <Chip ativo={!filtroMembro} aoTocar={() => setFiltroMembro('')} icone={<Icone n="users" className="h-3.5 w-3.5" />}>
              Todos
            </Chip>
            {membros.map((m) => (
              <Chip key={m.user_id} ativo={filtroMembro === m.user_id} aoTocar={() => setFiltroMembro(m.user_id)}>
                {nomeDoMembro(m, usuarioId)}
              </Chip>
            ))}
          </FileiraChips>
        )}
      </div>

      {erro && (
        <Aviso className="mb-4" aoTentarDeNovo={() => void recarregar()}>
          {erro}
        </Aviso>
      )}

      {carregando ? (
        <EsqueletoLista linhas={6} />
      ) : grupos.length === 0 ? (
        filtrando ? (
          <Vazio
            icone="history"
            titulo="Nada com esse filtro no que já carregou."
            descricao={proximo ? 'Pode estar mais pra trás: carregue mais ou limpe o filtro.' : undefined}
            acao={
              <Botao
                variante="secundario"
                onClick={() => {
                  setFiltroFamilia('')
                  setFiltroMembro('')
                }}
              >
                Limpar filtros
              </Botao>
            }
          />
        ) : (
          <Vazio icone="history" titulo="Nada aconteceu por aqui ainda. O primeiro lançamento já aparece neste feed." />
        )
      ) : (
        <div className="cascata space-y-5">
          {grupos.map((g) => (
            <section key={g.dia}>
              <div className="mb-2 flex items-baseline justify-between px-1">
                <Selo>{rotuloDoDia(g.dia)}</Selo>
                <span className="font-mono text-[11px] text-tenue">{g.itens.length}</span>
              </div>
              <ul className="divide-y divide-borda overflow-hidden rounded-card border border-borda bg-superficie shadow-card">
                {g.itens.map((a) => {
                  const frase = FRASE[a.tipo] ?? { verbo: a.tipo, icone: 'history' as NomeIcone }
                  const quem = nomeDoMembro(porMembro.get(a.user_id), usuarioId)
                  const detalhe =
                    a.tipo === 'lancamento.editado'
                      ? detalheDaEdicao(a, {
                          ocultar,
                          categoria: nomeCategoria,
                          membro: (id) => nomeDoMembro(porMembro.get(id)),
                        })
                      : null
                  return (
                    <li key={a.id} className="flex min-h-14 gap-3 px-4 py-3">
                      <span
                        className={cx(
                          'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                          tintaDoIcone(a.tipo),
                        )}
                      >
                        <Icone n={frase.icone} className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-texto">
                          <span className="font-semibold">{quem}</span> {frase.verbo}{' '}
                          <span className="text-suave">{esconder(a.resumo, ocultar)}</span>
                        </p>
                        {detalhe && <p className="mt-0.5 text-xs text-suave">{detalhe}</p>}
                      </div>
                      <time
                        dateTime={a.created_at}
                        title={quando(a.created_at)}
                        className="mt-0.5 shrink-0 font-mono text-[11px] text-tenue"
                      >
                        {horaDe(a.created_at)}
                      </time>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {proximo && !carregando && (
        <div className="mt-4 flex justify-center">
          <Botao variante="fantasma" carregando={carregandoMais} onClick={() => void carregarMais()}>
            Carregar mais antigos
          </Botao>
        </div>
      )}
    </div>
  )
}
