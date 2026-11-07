import { useCallback, useEffect, useMemo, useState } from 'react'
import { CabecalhoTela } from '@/lib/ui'
import { Icone } from '@/lib/icones'
import { formatar, formatarSeco, paraCentavos } from '@/lib/dinheiro'
import { comAtraso, ouvirOrcamento } from '@/lib/eventos'
import { mapaDeMembros, nomeDoMembro } from '@/lib/membros'
import type { ContextoOrcamento, Especie, Recorrente } from '@/lib/tipos'
import {
  apagarRecorrente,
  criarRecorrente,
  editarRecorrente,
  listarRecorrentes,
  type DadosRecorrente,
} from './recorrentes.queries'

export type Props = ContextoOrcamento

const OCULTO = 'R$ ••••'

const msg = (e: unknown) => (e instanceof Error ? e.message : 'Não deu certo.')

export function Recorrentes({ orcamento, usuarioId, membros, categorias, ocultar }: Props) {
  const ledgerId = orcamento.id
  const [lista, setLista] = useState<Recorrente[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  // null = nenhum formulário; 'novo' = criando; senão o recorrente em edição
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
  const nomeCategoria = useMemo(() => new Map(categorias.map((c) => [c.id, c])), [categorias])

  // Quanto já está "comprometido" todo mês: é a pergunta que faz alguém abrir esta tela.
  const totais = useMemo(() => {
    const ativos = (lista ?? []).filter((r) => r.ativo)
    return {
      saida: ativos.filter((r) => r.kind === 'expense').reduce((s, r) => s + r.amount_cents, 0),
      entrada: ativos.filter((r) => r.kind === 'income').reduce((s, r) => s + r.amount_cents, 0),
    }
  }, [lista])

  const dinheiro = (c: number) => (ocultar ? OCULTO : formatar(c))

  async function alternar(r: Recorrente) {
    try {
      await editarRecorrente(ledgerId, r.id, { ativo: !r.ativo })
      await recarregar()
    } catch (e) {
      setErro(msg(e))
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <CabecalhoTela titulo="Recorrentes" subtitulo="Contas que se repetem todo mês entram sozinhas no mês" />

      {erro && (
        <div className="mb-4 rounded-lg border border-saida/40 p-3 text-sm text-saida">
          {erro}{' '}
          <button onClick={() => void recarregar()} className="underline">
            tentar de novo
          </button>
        </div>
      )}

      {lista && lista.length > 0 && (
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-borda bg-painel p-3">
            <p className="text-xs text-apagado">Saídas fixas / mês</p>
            <p className="text-base font-semibold text-saida">{dinheiro(totais.saida)}</p>
          </div>
          <div className="rounded-lg border border-borda bg-painel p-3">
            <p className="text-xs text-apagado">Entradas fixas / mês</p>
            <p className="text-base font-semibold text-entrada">{dinheiro(totais.entrada)}</p>
          </div>
        </div>
      )}

      {editando === 'novo' ? (
        <Formulario
          {...{ ledgerId, membros, categorias, usuarioId }}
          aoFechar={() => setEditando(null)}
          aoSalvar={async () => {
            setEditando(null)
            await recarregar()
          }}
        />
      ) : (
        <button
          onClick={() => setEditando('novo')}
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg bg-primaria px-4 py-2.5 text-sm font-semibold text-white"
        >
          <Icone n="plus" /> Novo recorrente
        </button>
      )}

      {!lista ? (
        !erro && <p className="py-8 text-center text-sm text-apagado">carregando…</p>
      ) : lista.length === 0 ? (
        <div className="rounded-lg border border-borda bg-painel py-10 text-center">
          <Icone n="repeat" className="mx-auto mb-2 h-5 w-5 text-apagado" />
          <p className="text-sm text-apagado">Nada recorrente ainda. Aluguel, internet, salário…</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {lista.map((r) =>
            editando !== 'novo' && editando?.id === r.id ? (
              <li key={r.id}>
                <Formulario
                  {...{ ledgerId, membros, categorias, usuarioId }}
                  atual={r}
                  aoFechar={() => setEditando(null)}
                  aoSalvar={async () => {
                    setEditando(null)
                    await recarregar()
                  }}
                />
              </li>
            ) : (
              <Linha
                key={r.id}
                r={r}
                categoria={r.category_id ? nomeCategoria.get(r.category_id) : undefined}
                pagador={r.paid_by ? nomeDoMembro(porMembro.get(r.paid_by), usuarioId) : null}
                valor={dinheiro(r.amount_cents)}
                aoEditar={() => setEditando(r)}
                aoAlternar={() => void alternar(r)}
                aoApagar={async () => {
                  try {
                    await apagarRecorrente(ledgerId, r.id)
                    await recarregar()
                  } catch (e) {
                    setErro(msg(e))
                  }
                }}
              />
            ),
          )}
        </ul>
      )}
    </div>
  )
}

function Linha({
  r,
  categoria,
  pagador,
  valor,
  aoEditar,
  aoAlternar,
  aoApagar,
}: {
  r: Recorrente
  categoria: { nome: string; emoji: string | null } | undefined
  pagador: string | null
  valor: string
  aoEditar: () => void
  aoAlternar: () => void
  aoApagar: () => Promise<void>
}) {
  // confirmação dentro da linha: o viewer/PWA não garante confirm() nativo
  const [confirmando, setConfirmando] = useState(false)

  return (
    <li className={`rounded-lg border border-borda bg-painel p-3 ${r.ativo ? '' : 'opacity-60'}`}>
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-md bg-fundo text-xs leading-none">
          <span className="text-[10px] text-apagado">dia</span>
          <span className="font-semibold">{r.dia_do_mes}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{r.descricao}</p>
          <p className="truncate text-xs text-apagado">
            {categoria ? `${categoria.emoji ?? ''} ${categoria.nome}`.trim() : 'sem categoria'}
            {pagador && ` · pago por ${pagador}`}
            {!r.ativo && ' · pausado'}
          </p>
        </div>
        <p className={`shrink-0 text-sm font-semibold ${r.kind === 'income' ? 'text-entrada' : 'text-saida'}`}>
          {r.kind === 'income' ? '+' : '−'}
          {valor}
        </p>
      </div>

      <div className="mt-2 flex flex-wrap justify-end gap-1 text-xs">
        {confirmando ? (
          <>
            <span className="mr-auto self-center text-apagado">Apagar? Os lançamentos já gerados ficam.</span>
            <button onClick={() => setConfirmando(false)} className="rounded px-2 py-1 text-apagado">
              cancelar
            </button>
            <button onClick={() => void aoApagar()} className="rounded bg-saida px-2 py-1 font-semibold text-white">
              apagar
            </button>
          </>
        ) : (
          <>
            <button onClick={aoAlternar} className="rounded px-2 py-1 text-apagado hover:text-current">
              {r.ativo ? 'pausar' : 'retomar'}
            </button>
            <button onClick={aoEditar} className="flex items-center gap-1 rounded px-2 py-1 text-apagado hover:text-current">
              <Icone n="pencil" className="h-3 w-3" /> editar
            </button>
            <button
              onClick={() => setConfirmando(true)}
              className="flex items-center gap-1 rounded px-2 py-1 text-apagado hover:text-saida"
              aria-label="apagar"
            >
              <Icone n="trash" className="h-3 w-3" />
            </button>
          </>
        )}
      </div>
    </li>
  )
}

function Formulario({
  ledgerId,
  membros,
  categorias,
  usuarioId,
  atual,
  aoFechar,
  aoSalvar,
}: Pick<Props, 'membros' | 'categorias' | 'usuarioId'> & {
  ledgerId: string
  atual?: Recorrente
  aoFechar: () => void
  aoSalvar: () => Promise<void>
}) {
  const [descricao, setDescricao] = useState(atual?.descricao ?? '')
  const [valor, setValor] = useState(atual ? formatarSeco(atual.amount_cents) : '')
  const [kind, setKind] = useState<Especie>(atual?.kind ?? 'expense')
  const [categoria, setCategoria] = useState<string>(atual?.category_id ?? '')
  const [pagador, setPagador] = useState<string>(atual?.paid_by ?? '')
  const [dia, setDia] = useState(atual?.dia_do_mes ?? 5)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const opcoes = useMemo(() => categorias.filter((c) => c.kind === kind), [categorias, kind])

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    const centavos = paraCentavos(valor)
    if (!descricao.trim()) return setErro('Dê um nome.')
    if (!centavos || centavos <= 0) return setErro('Valor inválido.')
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
      await aoSalvar()
    } catch (e) {
      setErro(msg(e))
      setSalvando(false)
    }
  }

  const campo = 'w-full rounded-md border border-borda bg-fundo px-3 py-2 text-sm'

  return (
    <form onSubmit={salvar} className="mb-4 flex flex-col gap-3 rounded-lg border border-borda bg-painel p-3">
      <div className="flex rounded-md border border-borda p-0.5 text-sm">
        {(['expense', 'income'] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`flex-1 rounded px-3 py-1.5 ${kind === k ? 'bg-primaria font-semibold text-white' : 'text-apagado'}`}
          >
            {k === 'expense' ? 'Saída' : 'Entrada'}
          </button>
        ))}
      </div>

      <label className="text-xs text-apagado">
        Nome
        <input
          className={campo}
          value={descricao}
          maxLength={200}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Aluguel"
          autoFocus
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs text-apagado">
          Valor (R$)
          <input
            className={campo}
            inputMode="decimal"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="0,00"
          />
        </label>
        <label className="text-xs text-apagado">
          Todo dia
          <select className={campo} value={dia} onChange={(e) => setDia(Number(e.target.value))}>
            {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="text-xs text-apagado">
        Categoria
        <select className={campo} value={categoria} onChange={(e) => setCategoria(e.target.value)}>
          <option value="">sem categoria</option>
          {opcoes.map((c) => (
            <option key={c.id} value={c.id}>
              {`${c.emoji ?? ''} ${c.nome}`.trim()}
            </option>
          ))}
        </select>
      </label>

      <label className="text-xs text-apagado">
        Quem paga
        <select className={campo} value={pagador} onChange={(e) => setPagador(e.target.value)}>
          <option value="">o pote (ninguém em especial)</option>
          {membros.map((m) => (
            <option key={m.user_id} value={m.user_id}>
              {nomeDoMembro(m, usuarioId)}
            </option>
          ))}
        </select>
      </label>

      {atual && <p className="text-xs text-apagado">A mudança vale para os meses que ainda não foram gerados.</p>}
      {erro && <p className="text-xs text-saida">{erro}</p>}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={aoFechar} className="rounded-md px-3 py-2 text-sm text-apagado">
          cancelar
        </button>
        <button
          type="submit"
          disabled={salvando}
          className="rounded-md bg-primaria px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {salvando ? 'salvando…' : atual ? 'Salvar' : 'Criar'}
        </button>
      </div>
    </form>
  )
}
