import { useMemo, useState } from 'react'
import { formatarSeco, paraCentavos } from '@/lib/dinheiro'
import { nomeDoMembro } from '@/lib/membros'
import { editarLancamento } from './lancamentos.queries'
import { Aviso, Botao, Campo, Icone, Select, Sheet, Tabs, useToast, vibrar } from '@/design'
import type { Categoria, EdicaoLancamento, Especie, Membro } from '@/lib/tipos'

/** O mínimo de um lançamento que dá pra editar (serve Lancamento e a Linha do mês). */
export type Editavel = {
  id: string
  category_id: string | null
  kind: Especie
  amount_cents: number
  occurred_on: string
  descricao: string | null
  paid_by: string | null
  created_by: string
  updated_by: string | null
}

type Props = {
  lancamento: Editavel
  categorias: Categoria[]
  membros: Map<string, Membro>
  usuarioId: string
  aoFechar: () => void
  aoSalvar: () => void | Promise<void>
  /**
   * Opcional: quem passa ganha o botão "Apagar" com confirmação dentro do sheet.
   * Fica aqui (e não na linha) porque apagar sem passar por uma tela de detalhe
   * é fácil demais de fazer sem querer no celular.
   */
  aoApagar?: () => Promise<void>
}

/**
 * Editar em bottom sheet. Manda só o que mudou: o servidor registra antes/depois
 * no histórico, e campo intocado não deve aparecer lá como "editado".
 */
export function EditarLancamento({ lancamento: l, categorias, membros, usuarioId, aoFechar, aoSalvar, aoApagar }: Props) {
  const toast = useToast()
  const [kind, setKind] = useState<Especie>(l.kind)
  const [valor, setValor] = useState(formatarSeco(l.amount_cents))
  const [descricao, setDescricao] = useState(l.descricao ?? '')
  const [categoriaId, setCategoriaId] = useState(l.category_id ?? '')
  const [data, setData] = useState(l.occurred_on)
  const [pagou, setPagou] = useState(l.paid_by ?? '')
  const [salvando, setSalvando] = useState(false)
  const [confirmandoApagar, setConfirmandoApagar] = useState(false)
  const [apagando, setApagando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const doTipo = useMemo(() => categorias.filter((c) => c.kind === kind), [categorias, kind])
  const listaMembros = useMemo(() => [...membros.values()], [membros])

  const centavos = paraCentavos(valor)

  const mudancas = useMemo((): EdicaoLancamento => {
    const m: EdicaoLancamento = {}
    const cat = categoriaId || null
    const desc = descricao.trim() || null
    if (kind !== l.kind) m.kind = kind
    if (centavos !== null && centavos !== l.amount_cents) m.amount_cents = centavos
    if (cat !== l.category_id) m.category_id = cat
    if (data !== l.occurred_on) m.occurred_on = data
    if (desc !== l.descricao) m.descricao = desc
    if ((pagou || null) !== l.paid_by) m.paid_by = pagou || null
    return m
  }, [kind, centavos, categoriaId, data, descricao, pagou, l])

  const valido = centavos !== null && centavos > 0 && /^\d{4}-\d{2}-\d{2}$/.test(data)
  const pode = valido && Object.keys(mudancas).length > 0 && !salvando

  function trocarKind(k: Especie) {
    setKind(k)
    // categoria de gasto numa entrada o servidor recusa; melhor limpar já
    if (categoriaId && !categorias.some((c) => c.id === categoriaId && c.kind === k)) setCategoriaId('')
  }

  function offline() {
    return typeof navigator !== 'undefined' && navigator.onLine === false
  }

  async function salvar() {
    if (!pode) return
    if (offline()) {
      setErro('Editar precisa de internet. Tente de novo quando voltar.')
      return
    }
    setSalvando(true)
    setErro(null)
    try {
      await editarLancamento(l.id, mudancas)
      vibrar('sucesso')
      toast.mostrar('Lançamento salvo', { tom: 'sucesso' })
      await aoSalvar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu pra salvar.')
      vibrar('erro')
      setSalvando(false)
    }
  }

  async function apagar() {
    if (!aoApagar) return
    if (offline()) {
      setErro('Apagar precisa de internet. Tente de novo quando voltar.')
      return
    }
    setApagando(true)
    setErro(null)
    try {
      await aoApagar()
      vibrar('aviso')
      toast.mostrar('Apagado', { tom: 'info' })
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu pra apagar.')
      setApagando(false)
      setConfirmandoApagar(false)
    }
  }

  const criador = nomeDoMembro(membros.get(l.created_by), usuarioId)
  const editor = l.updated_by ? nomeDoMembro(membros.get(l.updated_by), usuarioId) : null

  // O rodapé troca de papel na confirmação: em vez de um diálogo por cima do
  // sheet (dois níveis de modal no celular é ruim), a mesma faixa pergunta.
  const rodape = confirmandoApagar ? (
    <>
      <Botao variante="fantasma" className="flex-1" onClick={() => setConfirmandoApagar(false)}>
        Manter
      </Botao>
      <Botao variante="perigo" className="flex-1" carregando={apagando} onClick={() => void apagar()} icone={<Icone n="trash" />}>
        Apagar mesmo
      </Botao>
    </>
  ) : (
    <>
      {aoApagar && (
        <Botao variante="perigo" onClick={() => setConfirmandoApagar(true)} icone={<Icone n="trash" />} aria-label="Apagar lançamento">
          <span className="sr-only sm:not-sr-only">Apagar</span>
        </Botao>
      )}
      <Botao variante="fantasma" className="flex-1" onClick={aoFechar}>
        Cancelar
      </Botao>
      <Botao className="flex-1" carregando={salvando} disabled={!pode} onClick={() => void salvar()}>
        Salvar
      </Botao>
    </>
  )

  return (
    <Sheet aberto aoFechar={aoFechar} selo={`lançado por ${criador}${editor ? ` · editado por ${editor}` : ''}`} titulo="Editar lançamento" rodape={rodape}>
      <div className="space-y-4">
        {confirmandoApagar && (
          <Aviso tom="atencao">Apagar este lançamento? Ele sai do mês e dos totais.</Aviso>
        )}

        <Tabs
          cheio
          abas={[
            { id: 'expense', rotulo: 'Despesa' },
            { id: 'income', rotulo: 'Receita' },
          ]}
          ativa={kind}
          aoTrocar={trocarKind}
          tom={kind === 'expense' ? 'saida' : 'entrada'}
        />

        <div className="grid grid-cols-2 gap-3">
          <Campo
            rotulo="Valor"
            value={valor}
            inputMode="decimal"
            onChange={(e) => setValor(e.target.value)}
            className="text-right font-mono tabular-nums"
            erro={valor && (centavos === null || centavos <= 0) ? 'Valor inválido' : undefined}
          />
          <Campo rotulo="Data" type="date" value={data} onChange={(e) => setData(e.target.value)} className="font-mono" />
        </div>

        <Campo rotulo="Descrição" value={descricao} maxLength={200} onChange={(e) => setDescricao(e.target.value)} placeholder="opcional" />

        <Select rotulo="Categoria" value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
          <option value="">sem categoria</option>
          {doTipo.map((c) => (
            <option key={c.id} value={c.id}>
              {c.emoji ? `${c.emoji} ` : ''}
              {c.nome}
            </option>
          ))}
          {/* categoria arquivada não vem na lista: mantém a atual selecionável */}
          {l.category_id && categoriaId === l.category_id && !doTipo.some((c) => c.id === l.category_id) && (
            <option value={l.category_id}>(categoria arquivada)</option>
          )}
        </Select>

        <Select rotulo="Quem pagou" value={pagou} onChange={(e) => setPagou(e.target.value)}>
          <option value="">quem lançou ({criador})</option>
          {listaMembros.map((m) => (
            <option key={m.user_id} value={m.user_id}>
              {nomeDoMembro(m, usuarioId)}
            </option>
          ))}
        </Select>

        {erro && <Aviso>{erro}</Aviso>}
      </div>
    </Sheet>
  )
}
