import { useMemo, useState } from 'react'
import { formatarSeco, empurrarDigito, apagarDigito } from '@/lib/dinheiro'
import { hoje, diaMes } from '@/lib/datas'
import { uuidv7 } from '@/lib/uuidv7'
import { enfileirar } from '@/lib/fila'
import type { Categoria, Especie, LancamentoNovo } from '@/lib/tipos'

// A tela mais importante do app. Meta dura: 3 toques, menos de 4 segundos,
// funcionando sem sinal. Se lançar der preguiça, ninguém usa em duas semanas.
//
// O valor é digitado estilo caixa eletrônico (dígito empurra pela direita), então
// nunca existe uma string de dinheiro meio-parseada: é sempre inteiro de centavos.

type Props = {
  ledgerId: string
  categorias: Categoria[]
  usuarioId: string
  aoLancar: (l: LancamentoNovo) => void
}

const TECLAS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫']

export function Lancar({ ledgerId, categorias, usuarioId, aoLancar }: Props) {
  const [especie, setEspecie] = useState<Especie>('expense')
  const [centavos, setCentavos] = useState(0)
  const [categoriaId, setCategoriaId] = useState<string | null>(null)
  const [data, setData] = useState(hoje())
  const [descricao, setDescricao] = useState('')
  const [salvando, setSalvando] = useState(false)

  const visiveis = useMemo(
    () => categorias.filter((c) => c.kind === especie),
    [categorias, especie],
  )

  const podeSalvar = centavos > 0 && categoriaId !== null && !salvando

  async function salvar() {
    if (!podeSalvar) return
    setSalvando(true)

    const novo: LancamentoNovo = {
      id: uuidv7(),
      ledger_id: ledgerId,
      category_id: categoriaId,
      kind: especie,
      amount_cents: centavos,
      // data LOCAL explícita: o default do banco é só rede de segurança, porque
      // o Postgres roda em UTC e uma compra às 21h30 de 31/01 cairia em fevereiro.
      occurred_on: data,
      descricao: descricao.trim() || null,
      paid_by: usuarioId,
      created_by: usuarioId,
      client_created_at: new Date().toISOString(),
    }

    // Enfileira e devolve o controle na hora. A UI nunca espera rede: sem sinal,
    // o lançamento fica pendente e sobe quando a rede voltar.
    aoLancar(novo)
    await enfileirar(novo)

    setCentavos(0)
    setCategoriaId(null)
    setDescricao('')
    setData(hoje())
    setSalvando(false)
  }

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <div className="p-4">
        <div className="flex gap-1 rounded-lg border border-borda bg-painel p-1">
          {(['expense', 'income'] as const).map((k) => (
            <button
              key={k}
              onClick={() => {
                setEspecie(k)
                setCategoriaId(null)
              }}
              className={`flex-1 rounded-md py-2 text-sm font-semibold transition-colors ${
                especie === k
                  ? `bg-fundo shadow-sm ${k === 'expense' ? 'text-saida' : 'text-entrada'}`
                  : 'text-apagado'
              }`}
            >
              {k === 'expense' ? 'Saiu' : 'Entrou'}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 py-2 text-right">
        <span className="text-sm text-apagado">R$ </span>
        <span
          className={`text-5xl font-light tabular-nums ${
            centavos === 0 ? 'text-apagado' : especie === 'expense' ? 'text-saida' : 'text-entrada'
          }`}
        >
          {formatarSeco(centavos)}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-2 overflow-y-auto px-4 py-3">
        {visiveis.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategoriaId(c.id === categoriaId ? null : c.id)}
            className={`flex flex-col items-center gap-1 rounded-lg border py-3 text-[11px] leading-tight transition-colors ${
              categoriaId === c.id
                ? 'border-primaria bg-painel text-texto ring-1 ring-primaria'
                : 'border-borda text-apagado'
            }`}
          >
            <span className="text-xl">{c.emoji ?? '•'}</span>
            <span className="px-1 text-center">{c.nome}</span>
          </button>
        ))}
      </div>

      <div className="mt-auto">
        <div className="flex items-center gap-2 px-4 pb-2">
          <input
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Descrição (opcional)"
            className="min-w-0 flex-1 rounded-lg border border-borda bg-painel px-3 py-2 text-sm outline-none focus:border-primaria"
          />
          <label className="shrink-0 rounded-lg border border-borda bg-painel px-3 py-2 text-sm text-apagado">
            {data === hoje() ? 'hoje' : diaMes(data)}
            <input
              type="date"
              value={data}
              max={hoje()}
              onChange={(e) => e.target.value && setData(e.target.value)}
              className="sr-only"
            />
          </label>
        </div>

        <div className="grid grid-cols-3 gap-px bg-borda">
          {TECLAS.map((t) => (
            <button
              key={t}
              onClick={() => {
                if (t === '⌫') setCentavos(apagarDigito(centavos))
                else if (t !== '.') setCentavos(empurrarDigito(centavos, t))
              }}
              disabled={t === '.'}
              className="bg-fundo py-4 text-2xl font-light active:bg-painel disabled:opacity-0"
            >
              {t}
            </button>
          ))}
        </div>

        <button
          onClick={salvar}
          disabled={!podeSalvar}
          className="w-full bg-primaria py-4 text-lg font-semibold text-white disabled:bg-painel disabled:text-apagado"
        >
          {centavos === 0
            ? 'Digite o valor'
            : categoriaId === null
              ? 'Escolha a categoria'
              : 'Lançar'}
        </button>
      </div>
    </div>
  )
}
