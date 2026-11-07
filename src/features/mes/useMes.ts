import { useCallback, useEffect, useMemo, useState } from 'react'
import { buscarLancamentosDoMes } from '@/features/lancamentos/lancamentos.queries'
import { buscarMetas } from './mes.queries'
import { intervaloDoMes } from '@/lib/datas'
import { aoMudarFila } from '@/lib/fila'
import { comAtraso, ouvirOrcamento } from '@/lib/eventos'
import type { Categoria, Lancamento, LancamentoNovo, Meta } from '@/lib/tipos'

/** Uma linha da lista: do servidor, ou ainda na fila esperando rede. */
export type Linha = {
  id: string
  category_id: string | null
  kind: 'expense' | 'income'
  amount_cents: number
  signed_cents: number
  occurred_on: string
  descricao: string | null
  paid_by: string | null
  pendente: boolean
}

export type ResumoCategoria = {
  categoria: Categoria
  gasto: number
  meta: number | null
}

function daFila(l: LancamentoNovo): Linha {
  return {
    id: l.id,
    category_id: l.category_id,
    kind: l.kind,
    amount_cents: l.amount_cents,
    // o banco calcula isso numa coluna gerada; aqui reproduzimos pro pendente
    // aparecer no total com o sinal certo.
    signed_cents: l.kind === 'income' ? l.amount_cents : -l.amount_cents,
    occurred_on: l.occurred_on,
    descricao: l.descricao,
    paid_by: l.paid_by,
    pendente: true,
  }
}

function doServidor(l: Lancamento): Linha {
  return { ...l, pendente: false }
}

/**
 * O "sync" do app: relê o mês inteiro quando ganha foco. Não é diff nem merge —
 * um mês de um casal são centenas de linhas, e complicar isso seria inventar
 * problema. Ver a seção "Como o sync funciona" no plano.
 */
export function useMes(ledgerId: string, mes: string, categorias: Categoria[]) {
  const [doBanco, setDoBanco] = useState<Lancamento[]>([])
  const [metas, setMetas] = useState<Meta[]>([])
  const [pendentes, setPendentes] = useState<LancamentoNovo[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => aoMudarFila(setPendentes), [])

  const recarregar = useCallback(async () => {
    try {
      const [ls, ms] = await Promise.all([
        buscarLancamentosDoMes(ledgerId, mes),
        buscarMetas(ledgerId, mes),
      ])
      setDoBanco(ls)
      setMetas(ms)
      setErro(null)
    } catch (e) {
      // Offline é estado normal aqui: mantém o que já tem na tela.
      setErro(e instanceof Error ? e.message : 'Falhou ao carregar o mês.')
    } finally {
      setCarregando(false)
    }
  }, [ledgerId, mes])

  useEffect(() => {
    setCarregando(true)
    void recarregar()
  }, [recarregar])

  // Tempo real: o outro lançou/apagou/mudou meta → relê. Membros não afeta o mês.
  useEffect(() => {
    const releitura = comAtraso(() => void recarregar())
    const parar = ouvirOrcamento(ledgerId, (tipo) => {
      if (tipo !== 'membros') releitura.chamar()
    })
    return () => {
      parar()
      releitura.cancelar()
    }
  }, [ledgerId, recarregar])

  useEffect(() => {
    const aoFocar = () => {
      if (document.visibilityState === 'visible') void recarregar()
    }
    document.addEventListener('visibilitychange', aoFocar)
    window.addEventListener('online', aoFocar)
    return () => {
      document.removeEventListener('visibilitychange', aoFocar)
      window.removeEventListener('online', aoFocar)
    }
  }, [recarregar])

  const linhas = useMemo(() => {
    const { inicio, fim } = intervaloDoMes(mes)
    const jaNoBanco = new Set(doBanco.map((l) => l.id))

    const daFilaDoMes = pendentes
      .filter(
        (p) =>
          p.ledger_id === ledgerId &&
          p.occurred_on >= inicio &&
          p.occurred_on < fim &&
          // se já subiu entre o fetch e o render, o do servidor manda
          !jaNoBanco.has(p.id),
      )
      .map(daFila)

    return [...daFilaDoMes, ...doBanco.map(doServidor)].sort((a, b) =>
      a.occurred_on === b.occurred_on
        ? b.id.localeCompare(a.id) // UUIDv7 desempata por horário de criação
        : b.occurred_on.localeCompare(a.occurred_on),
    )
  }, [doBanco, pendentes, ledgerId, mes])

  const porDia = useMemo(() => {
    const mapa = new Map<string, Linha[]>()
    for (const l of linhas) {
      const atual = mapa.get(l.occurred_on)
      if (atual) atual.push(l)
      else mapa.set(l.occurred_on, [l])
    }
    return [...mapa.entries()]
  }, [linhas])

  const totais = useMemo(() => {
    let saiu = 0
    let entrou = 0
    for (const l of linhas) {
      if (l.kind === 'expense') saiu += l.amount_cents
      else entrou += l.amount_cents
    }
    return { saiu, entrou, saldo: entrou - saiu }
  }, [linhas])

  const porCategoria = useMemo((): ResumoCategoria[] => {
    const gasto = new Map<string, number>()
    for (const l of linhas) {
      if (l.kind !== 'expense' || !l.category_id) continue
      gasto.set(l.category_id, (gasto.get(l.category_id) ?? 0) + l.amount_cents)
    }
    const limite = new Map(metas.map((m) => [m.category_id, m.limit_cents]))

    return categorias
      .filter((c) => c.kind === 'expense')
      .map((categoria) => ({
        categoria,
        gasto: gasto.get(categoria.id) ?? 0,
        meta: limite.get(categoria.id) ?? null,
      }))
      // quem tem movimento ou meta primeiro; o resto some do caminho
      .filter((r) => r.gasto > 0 || r.meta !== null)
      .sort((a, b) => b.gasto - a.gasto)
  }, [linhas, metas, categorias])

  return { linhas, porDia, totais, porCategoria, metas, carregando, erro, recarregar }
}
