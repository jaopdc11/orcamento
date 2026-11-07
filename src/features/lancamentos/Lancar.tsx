import { useMemo, useState } from 'react'
import { formatarSeco, empurrarDigito, apagarDigito } from '@/lib/dinheiro'
import { hoje, diaMes } from '@/lib/datas'
import { uuidv7 } from '@/lib/uuidv7'
import { enfileirar } from '@/lib/fila'
import { Botao, Icone, IconeCategoria, Tabs, Vazio, cx, useToast, vibrar } from '@/design'
import type { Categoria, Especie, LancamentoNovo } from '@/lib/tipos'

// A tela mais importante do app. Meta dura: 3 toques, menos de 4 segundos,
// funcionando sem sinal. Se lançar der preguiça, ninguém usa em duas semanas.
//
// O valor é digitado estilo caixa registradora (dígito empurra pela direita), então
// nunca existe uma string de dinheiro meio-parseada: é sempre inteiro de centavos.
// Mora dentro de um Sheet aberto pelo (+) da nav; ocupa a altura que o pai der.

type Props = {
  ledgerId: string
  categorias: Categoria[]
  usuarioId: string
  aoLancar: (l: LancamentoNovo) => void
}

// "00" no lugar da vírgula: em caixa registradora ninguém digita vírgula,
// e R$ 50 vira 5-0-00 em vez de 5-0-0-0.
const TECLAS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', '⌫'] as const

export function Lancar({ ledgerId, categorias, usuarioId, aoLancar }: Props) {
  const toast = useToast()
  const [especie, setEspecie] = useState<Especie>('expense')
  const [centavos, setCentavos] = useState(0)
  const [categoriaId, setCategoriaId] = useState<string | null>(null)
  const [data, setData] = useState(hoje())
  const [descricao, setDescricao] = useState('')
  const [salvando, setSalvando] = useState(false)

  const visiveis = useMemo(() => categorias.filter((c) => c.kind === especie), [categorias, especie])

  const podeSalvar = centavos > 0 && categoriaId !== null && !salvando
  const corValor = centavos === 0 ? 'text-tenue' : especie === 'expense' ? 'text-saida' : 'text-entrada'

  function tecla(t: (typeof TECLAS)[number]) {
    vibrar('leve')
    if (t === '⌫') setCentavos((c) => apagarDigito(c))
    else if (t === '00') setCentavos((c) => empurrarDigito(empurrarDigito(c, '0'), '0'))
    else setCentavos((c) => empurrarDigito(c, t))
  }

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
    vibrar('sucesso')
    const cat = categorias.find((c) => c.id === categoriaId)
    toast.mostrar(
      <>
        {especie === 'expense' ? 'Saída' : 'Entrada'} de <span className="font-mono">R$ {formatarSeco(centavos)}</span>
        {cat ? ` em ${cat.nome}` : ''} lançada
      </>,
    )

    setCentavos(0)
    setCategoriaId(null)
    setDescricao('')
    setData(hoje())
    setSalvando(false)
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 px-4 pt-1">
        <Tabs
          cheio
          tom={especie === 'expense' ? 'saida' : 'entrada'}
          ativa={especie}
          aoTrocar={(k) => {
            setEspecie(k)
            setCategoriaId(null)
          }}
          abas={[
            { id: 'expense', rotulo: 'Saiu' },
            { id: 'income', rotulo: 'Entrou' },
          ]}
        />

        {/* valor herói: mono, grande, à direita como numa calculadora */}
        <div className="flex items-baseline justify-end gap-2 px-1 pb-2 pt-4" aria-live="polite">
          <span className="font-mono text-lg text-tenue">R$</span>
          <span className={cx('font-mono text-5xl font-semibold tracking-tight tabular-nums transition-colors', corValor)}>
            {formatarSeco(centavos)}
          </span>
        </div>
      </div>

      {/* grade de categorias: a única parte que rola */}
      <div className="rolagem-fina min-h-0 flex-1 overflow-y-auto px-4 py-2">
        {visiveis.length === 0 ? (
          <Vazio compacto icone="grid" titulo="Nenhuma categoria deste tipo ainda." descricao="Crie nas configurações do orçamento." />
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {visiveis.map((c) => {
              const sel = categoriaId === c.id
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={sel}
                  onClick={() => {
                    vibrar('leve')
                    setCategoriaId(sel ? null : c.id)
                  }}
                  className={cx(
                    'flex min-h-[4.75rem] flex-col items-center justify-center gap-1.5 rounded-card border px-1 py-2 text-[11px] leading-tight transition-[transform,background-color,border-color,color] duration-150 ease-suave active:scale-[0.95]',
                    sel ? 'border-acento bg-tinta-acento text-texto' : 'border-transparent text-suave hover:bg-superficie-alta',
                  )}
                >
                  <IconeCategoria categoria={c} tamanho="sm" />
                  <span className="line-clamp-2 w-full text-center">{c.nome}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-borda">
        <div className="flex items-center gap-2 px-4 py-2.5">
          <input
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Descrição (opcional)"
            className="min-h-11 min-w-0 flex-1 rounded-card border border-borda bg-campo px-3 text-base text-texto outline-none placeholder:text-tenue focus:border-acento sm:text-sm"
          />
          <label className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-card border border-borda bg-campo px-3 text-sm text-suave">
            <Icone n="calendar" className="h-4 w-4" />
            <span className="font-mono">{data === hoje() ? 'hoje' : diaMes(data)}</span>
            <input
              type="date"
              value={data}
              max={hoje()}
              onChange={(e) => e.target.value && setData(e.target.value)}
              className="sr-only"
            />
          </label>
        </div>

        {/* teclado grande: alvos de ~56px, o polegar acerta sem olhar */}
        <div className="grid grid-cols-3 gap-1.5 px-3 pb-2">
          {TECLAS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => tecla(t)}
              aria-label={t === '⌫' ? 'Apagar' : t}
              className="flex h-14 items-center justify-center rounded-card bg-superficie-alta/60 font-mono text-2xl text-texto transition-[transform,background-color] duration-100 ease-suave active:scale-[0.95] active:bg-superficie-alta"
            >
              {t === '⌫' ? <Icone n="backspace" className="h-6 w-6 text-suave" /> : t}
            </button>
          ))}
        </div>

        <div className="px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-1">
          <Botao cheio tamanho="lg" onClick={salvar} disabled={!podeSalvar} carregando={salvando} className="h-14 text-base font-semibold">
            {centavos === 0 ? 'Digite o valor' : categoriaId === null ? 'Escolha a categoria' : 'Lançar'}
          </Botao>
        </div>
      </div>
    </div>
  )
}
