import { useCallback, useEffect, useMemo, useState } from 'react'
import { CabecalhoTela } from '@/lib/ui'
import { Icone, type NomeIcone } from '@/lib/icones'
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

  return (
    <div>
      <CabecalhoTela titulo="Histórico" subtitulo="Quem fez o quê neste orçamento" />

      {erro && (
        <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
          {erro}
        </p>
      )}

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-2 dark:border-gray-800 dark:bg-gray-900 sm:p-3">
        {carregando ? (
          <p className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">carregando…</p>
        ) : itens.length === 0 ? (
          <div className="py-10 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-300 dark:bg-gray-800 dark:text-gray-600">
              <Icone n="history" className="h-5 w-5" />
            </div>
            <p className="text-sm text-gray-400 dark:text-gray-500">Nada por aqui ainda</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-gray-800">
            {itens.map((a) => {
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
                <li key={a.id} className="flex gap-3 px-2 py-2.5">
                  <span
                    className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                      a.tipo === 'lancamento.apagado'
                        ? 'bg-red-50 text-red-500 dark:bg-red-950 dark:text-red-400'
                        : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                    }`}
                  >
                    <Icone n={frase.icone} className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-800 dark:text-gray-200">
                      <span className="font-medium">{quem}</span> {frase.verbo}{' '}
                      <span className="text-gray-600 dark:text-gray-400">{esconder(a.resumo, ocultar)}</span>
                    </p>
                    {detalhe && (
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{detalhe}</p>
                    )}
                    <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">{quando(a.created_at)}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {proximo && !carregando && (
          <button
            onClick={() => void carregarMais()}
            disabled={carregandoMais}
            className="mt-2 w-full rounded-md py-2 text-sm font-medium text-blue-600 transition-colors hover:bg-gray-100 disabled:opacity-50 dark:text-blue-400 dark:hover:bg-gray-800"
          >
            {carregandoMais ? 'Carregando…' : 'Carregar mais'}
          </button>
        )}
      </div>
    </div>
  )
}
