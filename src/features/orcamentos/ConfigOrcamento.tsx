import { useCallback, useEffect, useMemo, useState } from 'react'
import { ouvirOrcamento } from '@/lib/eventos'
import { nomeDoMembro } from '@/lib/membros'
import type { Categoria, ContextoOrcamento, Convite, Especie, Membro } from '@/lib/tipos'
import {
  Aviso,
  Badge,
  Botao,
  BotaoIcone,
  CabecalhoTela,
  Campo,
  Cartao,
  EsqueletoLista,
  Icone,
  IconeCategoria,
  LinhaLista,
  Lista,
  Sheet,
  Tabs,
  TituloSecao,
  Vazio,
  useToast,
  vibrar, Avatar,
} from '@/design'
import { CartaoConvite } from './CartaoConvite'
import {
  arquivarCategoria,
  cancelarConvite,
  convitesPendentes,
  criarCategoria,
  criarConvite,
  editarCategoria,
  mudarMeuApelido,
  removerMembro,
  renomearOrcamento,
  reordenarCategorias,
  todasCategorias,
} from './orcamentos.queries'

export type Props = ContextoOrcamento & {
  /** nome/membros/categorias mudaram: o App relê tudo do orçamento */
  aoMudar: () => void
  /** você saiu (ou foi removido) deste orçamento: o App troca pra outro */
  aoSair: () => void
}

function msg(e: unknown, padrao: string) {
  return e instanceof Error ? e.message : padrao
}

// As props são fixadas pelo App.tsx (fundação): não mude a assinatura.
export function ConfigOrcamento({ orcamento, usuarioId, membros, aoMudar, aoSair }: Props) {
  const [erro, setErro] = useState<string | null>(null)

  /** Toda ação passa por aqui: erro na tela em vez de promessa solta. */
  const agir = useCallback(async (fn: () => Promise<unknown>, padrao = 'Não deu certo.') => {
    setErro(null)
    try {
      await fn()
      return true
    } catch (e) {
      setErro(msg(e, padrao))
      vibrar('erro')
      return false
    }
  }, [])

  return (
    <div className="mx-auto max-w-xl">
      <CabecalhoTela selo={orcamento.nome} titulo="Configurações" descricao="Nome, quem participa e as categorias deste orçamento." />
      {erro && (
        <Aviso className="mb-4 animate-fade" aoTentarDeNovo={() => setErro(null)}>
          {erro}
        </Aviso>
      )}
      <div className="cascata space-y-8">
        <SecaoNome key={orcamento.id + orcamento.nome} {...{ orcamento, usuarioId, membros, agir, aoMudar }} />
        <SecaoMembros {...{ orcamento, usuarioId, membros, agir, aoMudar, aoSair }} />
        <SecaoCategorias ledgerId={orcamento.id} agir={agir} aoMudar={aoMudar} />
      </div>
    </div>
  )
}

type Agir = (fn: () => Promise<unknown>, padrao?: string) => Promise<boolean>

// --- nome + meu apelido --------------------------------------------------------

function SecaoNome({
  orcamento,
  usuarioId,
  membros,
  agir,
  aoMudar,
}: Pick<Props, 'orcamento' | 'usuarioId' | 'membros' | 'aoMudar'> & { agir: Agir }) {
  const toast = useToast()
  const eu = membros.find((m) => m.user_id === usuarioId)
  const [nome, setNome] = useState(orcamento.nome)
  const [apelido, setApelido] = useState(eu?.apelido ?? '')
  const [salvando, setSalvando] = useState(false)

  // Membros chegam depois do primeiro render em alguns casos; sincroniza o campo.
  useEffect(() => setApelido(eu?.apelido ?? ''), [eu?.apelido])

  const mudou = nome.trim() !== orcamento.nome || (apelido.trim() || null) !== (eu?.apelido ?? null)

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    const ok = await agir(async () => {
      if (nome.trim() !== orcamento.nome) await renomearOrcamento(orcamento.id, nome.trim())
      if ((apelido.trim() || null) !== (eu?.apelido ?? null)) await mudarMeuApelido(orcamento.id, apelido.trim() || null)
    })
    setSalvando(false)
    if (ok) {
      vibrar('sucesso')
      toast.mostrar('Salvo', { tom: 'sucesso' })
      aoMudar()
    }
  }

  return (
    <section>
      <TituloSecao selo="Orçamento" titulo="Nome e apelido" />
      <Cartao>
        <form onSubmit={salvar} className="space-y-4">
          <Campo rotulo="Nome" required maxLength={80} value={nome} onChange={(e) => setNome(e.target.value)} />
          <Campo
            rotulo="Como você aparece aqui (apelido)"
            maxLength={40}
            value={apelido}
            onChange={(e) => setApelido(e.target.value)}
            placeholder={eu?.nome || eu?.email.split('@')[0] || ''}
          />
          <div className="flex justify-end">
            <Botao type="submit" carregando={salvando} disabled={!mudou || !nome.trim()}>
              {salvando ? 'Salvando…' : 'Salvar'}
            </Botao>
          </div>
        </form>
      </Cartao>
    </section>
  )
}

// --- membros + convites --------------------------------------------------------

function SecaoMembros({
  orcamento,
  usuarioId,
  membros,
  agir,
  aoMudar,
  aoSair,
}: Pick<Props, 'orcamento' | 'usuarioId' | 'membros' | 'aoMudar' | 'aoSair'> & { agir: Agir }) {
  const toast = useToast()
  const [convites, setConvites] = useState<Convite[]>([])
  const [confirmando, setConfirmando] = useState<Membro | null>(null)
  const [removendo, setRemovendo] = useState(false)
  const [gerando, setGerando] = useState(false)

  const recarregar = useCallback(async () => {
    try {
      setConvites(await convitesPendentes(orcamento.id))
    } catch {
      // lista de convite é acessória: sem ela a tela continua útil
    }
  }, [orcamento.id])

  useEffect(() => {
    void recarregar()
  }, [recarregar])

  // Convite aceito em outro aparelho some da lista de pendentes sem F5.
  useEffect(
    () =>
      ouvirOrcamento(orcamento.id, (tipo) => {
        if (tipo === 'membros') void recarregar()
      }),
    [orcamento.id, recarregar],
  )

  async function remover(userId: string) {
    setRemovendo(true)
    const ok = await agir(() => removerMembro(orcamento.id, userId), 'Não consegui remover.')
    setRemovendo(false)
    setConfirmando(null)
    if (!ok) return
    vibrar('aviso')
    if (userId === usuarioId) aoSair()
    else {
      toast.mostrar('Membro removido', { tom: 'info' })
      aoMudar()
    }
  }

  async function gerar() {
    setGerando(true)
    const ok = await agir(async () => {
      await criarConvite(orcamento.id)
      await recarregar()
    }, 'Não consegui gerar o código.')
    setGerando(false)
    if (ok) {
      vibrar('sucesso')
      toast.mostrar('Convite criado. Toque no código pra copiar.', { tom: 'sucesso' })
    }
  }

  const souEuConfirmando = confirmando?.user_id === usuarioId

  return (
    <section>
      <TituloSecao selo="Membros" titulo="Quem participa" acao={<Badge mono>{membros.length}</Badge>} />
      <Lista cascata className="mb-3">
        {membros.map((m) => {
          const souEu = m.user_id === usuarioId
          return (
            <LinhaLista
              key={m.user_id}
              inicio={<Avatar nome={nomeDoMembro(m)} destaque={souEu} />}
              titulo={nomeDoMembro(m, usuarioId)}
              subtitulo={m.email}
              acoes={
                souEu ? (
                  <Botao variante="fantasma" tamanho="sm" onClick={() => setConfirmando(m)}>
                    Sair
                  </Botao>
                ) : (
                  <BotaoIcone rotulo={`Remover ${nomeDoMembro(m)}`} onClick={() => setConfirmando(m)}>
                    <Icone n="trash" />
                  </BotaoIcone>
                )
              }
            />
          )
        })}
      </Lista>

      <div className="space-y-3">
        {convites.map((c) => (
          <CartaoConvite
            key={c.code}
            convite={c}
            aoCancelar={() =>
              agir(async () => {
                await cancelarConvite(c.code)
                await recarregar()
                toast.mostrar('Convite cancelado', { tom: 'info' })
              })
            }
          />
        ))}
        <Botao cheio variante="secundario" carregando={gerando} icone={<Icone n="plus" />} onClick={() => void gerar()}>
          {gerando ? 'Gerando…' : 'Convidar alguém'}
        </Botao>
        <p className="text-xs text-tenue">
          A pessoa entra no app, escolhe “Tenho um código” e cola. Vale 7 dias e serve uma vez só.
        </p>
      </div>

      <Sheet
        aberto={!!confirmando}
        aoFechar={() => setConfirmando(null)}
        selo="Membros"
        titulo={souEuConfirmando ? 'Sair deste orçamento?' : `Remover ${confirmando ? nomeDoMembro(confirmando) : ''}?`}
        largura="sm"
        rodape={
          <>
            <Botao variante="fantasma" className="flex-1" onClick={() => setConfirmando(null)}>
              Cancelar
            </Botao>
            <Botao
              variante="perigo"
              className="flex-1"
              carregando={removendo}
              onClick={() => confirmando && void remover(confirmando.user_id)}
            >
              {souEuConfirmando ? 'Sair mesmo' : 'Remover'}
            </Botao>
          </>
        }
      >
        <p className="text-sm text-suave">
          {souEuConfirmando
            ? 'Você deixa de ver os lançamentos daqui. Pra voltar, alguém precisa te mandar um código novo.'
            : 'A pessoa deixa de ver este orçamento. Os lançamentos que ela fez continuam.'}
        </p>
      </Sheet>
    </section>
  )
}

// --- categorias ----------------------------------------------------------------

function SecaoCategorias({ ledgerId, agir, aoMudar }: { ledgerId: string; agir: Agir; aoMudar: () => void }) {
  const toast = useToast()
  const [lista, setLista] = useState<Categoria[] | null>(null)
  const [kind, setKind] = useState<Especie>('expense')
  const [editando, setEditando] = useState<Categoria | 'nova' | null>(null)
  const [verArquivadas, setVerArquivadas] = useState(false)

  const recarregar = useCallback(async () => {
    try {
      setLista(await todasCategorias(ledgerId))
    } catch {
      setLista((l) => l ?? [])
    }
  }, [ledgerId])

  useEffect(() => {
    void recarregar()
  }, [recarregar])

  useEffect(
    () =>
      ouvirOrcamento(ledgerId, (tipo) => {
        if (tipo === 'categorias') void recarregar()
      }),
    [ledgerId, recarregar],
  )

  const ativas = useMemo(
    () => (lista ?? []).filter((c) => c.kind === kind && !c.archived_at).sort((a, b) => a.ordem - b.ordem),
    [lista, kind],
  )
  const arquivadas = useMemo(() => (lista ?? []).filter((c) => c.kind === kind && c.archived_at), [lista, kind])

  async function depois(fn: () => Promise<unknown>) {
    const ok = await agir(fn)
    if (ok) {
      await recarregar()
      aoMudar()
    }
    return ok
  }

  function mover(i: number, delta: -1 | 1) {
    const ids = ativas.map((c) => c.id)
    const j = i + delta
    if (j < 0 || j >= ids.length) return
    ;[ids[i], ids[j]] = [ids[j]!, ids[i]!]
    vibrar('leve')
    // Otimista: a seta responde na hora; o servidor confirma em seguida.
    setLista((l) => l && l.map((c) => (ids.includes(c.id) ? { ...c, ordem: (ids.indexOf(c.id) + 1) * 10 } : c)))
    void depois(() => reordenarCategorias(ledgerId, ids))
  }

  async function arquivar(c: Categoria, sim: boolean) {
    const ok = await depois(() => arquivarCategoria(ledgerId, c.id, sim))
    if (!ok) return
    if (sim) {
      vibrar('aviso')
      toast.mostrar(`${c.nome} arquivada`, {
        tom: 'info',
        acao: { rotulo: 'Desfazer', aoTocar: () => void depois(() => arquivarCategoria(ledgerId, c.id, false)) },
      })
    } else toast.mostrar(`${c.nome} de volta`, { tom: 'sucesso' })
  }

  const rotuloTipo = kind === 'expense' ? 'saída' : 'entrada'

  return (
    <section>
      <TituloSecao selo="Categorias" titulo="Onde o dinheiro vai e de onde vem" />
      <Tabs
        cheio
        className="mb-3"
        tom={kind === 'expense' ? 'saida' : 'entrada'}
        abas={[
          { id: 'expense', rotulo: 'Saídas' },
          { id: 'income', rotulo: 'Entradas' },
        ]}
        ativa={kind}
        aoTrocar={(k) => {
          setKind(k)
          setEditando(null)
        }}
      />

      {lista === null ? (
        <EsqueletoLista />
      ) : ativas.length === 0 ? (
        <Cartao>
          <Vazio
            compacto
            icone="list"
            titulo={`Nenhuma categoria de ${rotuloTipo}. Crie a primeira e o teclado de lançar já mostra.`}
          />
        </Cartao>
      ) : (
        // key por tipo: trocar a aba remonta e a cascata toca de novo
        <Lista cascata key={kind}>
          {ativas.map((c, i) => (
            <LinhaLista
              key={c.id}
              inicio={<IconeCategoria categoria={c} />}
              titulo={c.nome}
              aoTocar={() => setEditando(c)}
              acoes={
                <>
                  <BotaoIcone rotulo={`subir ${c.nome}`} disabled={i === 0} onClick={() => mover(i, -1)} className="disabled:opacity-30">
                    <span className="font-mono text-base">↑</span>
                  </BotaoIcone>
                  <BotaoIcone
                    rotulo={`descer ${c.nome}`}
                    disabled={i === ativas.length - 1}
                    onClick={() => mover(i, 1)}
                    className="disabled:opacity-30"
                  >
                    <span className="font-mono text-base">↓</span>
                  </BotaoIcone>
                  <BotaoIcone rotulo={`arquivar ${c.nome}`} onClick={() => void arquivar(c, true)}>
                    <Icone n="inbox" />
                  </BotaoIcone>
                </>
              }
            />
          ))}
        </Lista>
      )}

      <Botao cheio variante="secundario" className="mt-3" icone={<Icone n="plus" />} onClick={() => setEditando('nova')}>
        Nova categoria de {rotuloTipo}
      </Botao>

      {arquivadas.length > 0 && (
        <div className="mt-4">
          <Botao variante="fantasma" tamanho="sm" onClick={() => setVerArquivadas((v) => !v)}>
            {verArquivadas ? 'Esconder' : 'Ver'} arquivadas <span className="font-mono">({arquivadas.length})</span>
          </Botao>
          {verArquivadas && (
            <Lista className="mt-2 animate-fade">
              {arquivadas.map((c) => (
                <LinhaLista
                  key={c.id}
                  apagada
                  inicio={<IconeCategoria categoria={c} />}
                  titulo={c.nome}
                  acoes={
                    <Botao variante="fantasma" tamanho="sm" onClick={() => void arquivar(c, false)}>
                      Desarquivar
                    </Botao>
                  }
                />
              ))}
            </Lista>
          )}
        </div>
      )}

      <SheetCategoria
        aberto={editando !== null}
        inicial={editando === 'nova' ? undefined : editando ?? undefined}
        rotuloTipo={rotuloTipo}
        aoFechar={() => setEditando(null)}
        aoSalvar={async (d) => {
          const alvo = editando
          const ok =
            alvo === 'nova'
              ? await depois(() => criarCategoria(ledgerId, { ...d, kind }))
              : alvo
                ? await depois(() => editarCategoria(ledgerId, alvo.id, d))
                : false
          if (ok) {
            vibrar('sucesso')
            toast.mostrar(alvo === 'nova' ? 'Categoria criada' : 'Categoria salva', { tom: 'sucesso' })
            setEditando(null)
          }
        }}
      />
    </section>
  )
}

type Dados = { nome: string; emoji: string | null; cor: string | null }

// Formulário de categoria num Sheet. Remonta por key a cada abertura pra o
// estado do formulário partir sempre da categoria certa.
function SheetCategoria({
  aberto,
  inicial,
  rotuloTipo,
  aoSalvar,
  aoFechar,
}: {
  aberto: boolean
  inicial?: Categoria
  rotuloTipo: string
  aoSalvar: (d: Dados) => Promise<void>
  aoFechar: () => void
}) {
  return (
    <Sheet
      aberto={aberto}
      aoFechar={aoFechar}
      selo="Categorias"
      titulo={inicial ? 'Editar categoria' : `Nova categoria de ${rotuloTipo}`}
      largura="sm"
    >
      {aberto && <FormCategoria key={inicial?.id ?? 'nova'} inicial={inicial} aoSalvar={aoSalvar} aoCancelar={aoFechar} />}
    </Sheet>
  )
}

function FormCategoria({
  inicial,
  aoSalvar,
  aoCancelar,
}: {
  inicial?: Categoria
  aoSalvar: (d: Dados) => Promise<void>
  aoCancelar: () => void
}) {
  const [nome, setNome] = useState(inicial?.nome ?? '')
  const [emoji, setEmoji] = useState(inicial?.emoji ?? '')
  const [cor, setCor] = useState(inicial?.cor ?? '')
  const [ocupado, setOcupado] = useState(false)

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setOcupado(true)
    await aoSalvar({ nome: nome.trim(), emoji: emoji.trim() || null, cor: cor || null })
    setOcupado(false)
  }

  // prévia ao vivo: o mesmo IconeCategoria que aparece na lista e no teclado
  const previa = { id: inicial?.id, nome: nome || 'categoria', emoji: emoji.trim() || null, cor: cor || null }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <div className="flex items-end gap-3">
        <IconeCategoria categoria={previa} tamanho="lg" />
        <Campo
          rotulo="Emoji"
          value={emoji}
          onChange={(e) => setEmoji(e.target.value)}
          maxLength={8}
          placeholder="🙂"
          classeCaixa="w-20 shrink-0"
          className="text-center text-xl"
        />
        <Campo
          rotulo="Nome"
          required
          autoFocus
          maxLength={40}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="ex: Mercado"
          classeCaixa="min-w-0 flex-1"
        />
      </div>
      <div className="flex min-h-11 flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs font-medium text-suave">
          Cor
          <input
            type="color"
            value={cor || '#888888'}
            onChange={(e) => setCor(e.target.value)}
            className="h-9 w-12 cursor-pointer rounded-card border border-borda bg-campo"
          />
        </label>
        {cor ? (
          <Botao type="button" variante="fantasma" tamanho="sm" onClick={() => setCor('')}>
            Usar cor automática
          </Botao>
        ) : (
          <span className="text-xs text-tenue">Sem cor: o app escolhe uma estável.</span>
        )}
      </div>
      <div className="flex gap-2 pt-2">
        <Botao type="button" variante="fantasma" className="flex-1" onClick={aoCancelar}>
          Cancelar
        </Botao>
        <Botao type="submit" className="flex-1" carregando={ocupado} disabled={!nome.trim()}>
          {ocupado ? 'Salvando…' : 'Salvar'}
        </Botao>
      </div>
    </form>
  )
}
