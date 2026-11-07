import { useCallback, useEffect, useMemo, useState } from 'react'
import { deslocarMes, mesDe, mesPorExtenso } from '@/lib/datas'
import { ouvirOrcamento } from '@/lib/eventos'
import { mapaDeMembros, nomeDoMembro } from '@/lib/membros'
import type { Acerto as TipoAcerto, ContextoOrcamento } from '@/lib/tipos'
import {
  Aviso,
  BarraProgresso,
  Botao,
  BotaoIcone,
  CabecalhoTela,
  Campo,
  Cartao,
  Esqueleto,
  Icone,
  Selo,
  Sheet,
  TituloSecao,
  Valor,
  Vazio,
  useToast,
  vibrar,
} from '@/design'
import { buscarAcerto, salvarProporcoes } from './acerto.queries'

export type Props = ContextoOrcamento & {
  /** proporções mudaram: o App relê os membros */
  aoMudar: () => void
}

export function Acerto({ orcamento, usuarioId, membros, ocultar, aoMudar }: Props) {
  const [mes, setMes] = useState(mesDe())
  const [dados, setDados] = useState<TipoAcerto | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [editando, setEditando] = useState(false)
  const porId = useMemo(() => mapaDeMembros(membros), [membros])
  const nome = (id: string) => nomeDoMembro(porId.get(id), usuarioId)

  const carregar = useCallback(() => {
    buscarAcerto(orcamento.id, mes)
      .then((a) => {
        setDados(a)
        setErro(null)
      })
      .catch((e: Error) => setErro(e.message))
  }, [orcamento.id, mes])

  useEffect(carregar, [carregar])
  // membros entra porque a proporção mudada pelo outro chega como evento 'membros'
  useEffect(
    () => ouvirOrcamento(orcamento.id, (t) => (t === 'lancamentos' || t === 'membros') && carregar()),
    [orcamento.id, carregar],
  )

  const somaPesos = membros.reduce((s, m) => s + m.proporcao, 0)
  const [principal, ...demais] = dados?.transferencias ?? []

  return (
    <div>
      <CabecalhoTela
        selo={mesPorExtenso(mes)}
        titulo="Acerto de contas"
        descricao="Só despesas. Quem pagou vs. a parte de cada um."
      />

      <div className="mb-4 flex items-center justify-between rounded-card border border-borda bg-superficie px-1">
        <BotaoIcone rotulo="mês anterior" onClick={() => setMes(deslocarMes(mes, -1))}>
          <Icone n="chevronLeft" />
        </BotaoIcone>
        <span className="text-sm font-semibold capitalize text-texto">{mesPorExtenso(mes)}</span>
        <BotaoIcone rotulo="próximo mês" onClick={() => setMes(deslocarMes(mes, 1))} disabled={mes >= mesDe()}>
          <Icone n="chevronRight" />
        </BotaoIcone>
      </div>

      {erro && (
        <Aviso className="mb-4" aoTentarDeNovo={carregar}>
          {erro}
        </Aviso>
      )}

      {!dados && !erro && (
        <div className="space-y-3">
          <Esqueleto className="h-36 rounded-card" />
          <Esqueleto className="h-48 rounded-card" />
        </div>
      )}

      {dados && (
        <div className="cascata space-y-3">
          {/* Herói: a resposta da tela é "quem paga quem". */}
          <Cartao>
            {principal ? (
              <>
                <Selo tom="acento">Pra zerar o mês</Selo>
                <p className="mt-2 text-sm text-suave">
                  <strong className="font-semibold text-texto">{nome(principal.de)}</strong> passa pra{' '}
                  <strong className="font-semibold text-texto">{nome(principal.para)}</strong>
                </p>
                <Valor centavos={principal.valor_cents} tamanho="heroi" tipo="neutro" animar ocultar={ocultar} className="mt-1 block" />
                {demais.length > 0 && (
                  <ul className="mt-4 space-y-2 border-t border-borda pt-3">
                    {demais.map((t) => (
                      <li key={`${t.de}-${t.para}`} className="flex items-center justify-between gap-3 text-sm">
                        <span className="min-w-0 truncate text-suave">
                          <span className="text-texto">{nome(t.de)}</span> → <span className="text-texto">{nome(t.para)}</span>
                        </span>
                        <Valor centavos={t.valor_cents} tamanho="sm" ocultar={ocultar} />
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : dados.total_cents === 0 ? (
              <Vazio compacto icone="scale" titulo="Nenhuma despesa neste mês." descricao="Quando alguém pagar algo, a conta aparece aqui." />
            ) : (
              <Vazio compacto icone="check" titulo="Tudo certo: ninguém deve nada." descricao="Cada um pagou exatamente a sua parte." />
            )}
            <div className="mt-4 flex items-baseline justify-between border-t border-borda pt-3 text-sm">
              <span className="text-tenue">Despesas do mês</span>
              <Valor centavos={dados.total_cents} tipo="saida" tamanho="sm" ocultar={ocultar} />
            </div>
          </Cartao>

          {dados.membros.length > 0 && (
            <section className="pt-3">
              <TituloSecao selo="Por membro" titulo="Pagou × parte" />
              <Cartao className="cascata mt-3 space-y-5">
                {dados.membros.map((m) => {
                  // Barra = quanto da conta do mês essa pessoa bancou; verde se pagou
                  // além da parte, vermelho se ficou devendo. Sem aviso de 85%: não é limite.
                  const pct = dados.total_cents > 0 ? (m.pagou_cents / dados.total_cents) * 100 : 0
                  return (
                    <div key={m.user_id}>
                      <div className="mb-2 flex items-baseline justify-between gap-3">
                        <span className="truncate text-sm font-medium text-texto">{nome(m.user_id)}</span>
                        <Valor centavos={m.saldo_cents} tipo="auto" sinal tamanho="sm" ocultar={ocultar} />
                      </div>
                      <BarraProgresso
                        percentual={Math.min(pct, 100)}
                        tom={m.saldo_cents < 0 ? 'saida' : 'entrada'}
                        avisoEm={null}
                      />
                      <div className="mt-1.5 flex justify-between gap-3 text-xs text-tenue">
                        <span>
                          pagou <Valor centavos={m.pagou_cents} tamanho="sm" ocultar={ocultar} className="text-xs text-suave" />
                        </span>
                        <span>
                          parte <Valor centavos={m.parte_cents} tamanho="sm" ocultar={ocultar} className="text-xs text-suave" />
                        </span>
                      </div>
                    </div>
                  )
                })}
              </Cartao>
            </section>
          )}
        </div>
      )}

      <section className="mt-6">
        <TituloSecao
          selo="Divisão"
          titulo="Proporções"
          acao={
            <Botao variante="secundario" tamanho="sm" onClick={() => setEditando(true)} icone={<Icone n="pencil" />}>
              Ajustar
            </Botao>
          }
        />
        <Cartao className="mt-3">
          <div className="flex h-2 overflow-hidden rounded-full bg-superficie-alta">
            {/* Barra empilhada só com acento/tenue alternados: 2 pessoas é o caso comum. */}
            {membros.map((m, i) => (
              <div
                key={m.user_id}
                className={i % 2 === 0 ? 'bg-acento' : 'bg-suave'}
                style={{ width: `${somaPesos > 0 ? (m.proporcao / somaPesos) * 100 : 0}%` }}
              />
            ))}
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {membros.map((m) => (
              <li key={m.user_id} className="flex items-baseline gap-1.5">
                <span className="text-texto">{nome(m.user_id)}</span>
                <span className="font-mono text-xs text-suave">
                  {somaPesos > 0 ? `${Math.round((m.proporcao / somaPesos) * 100)}%` : '—'}
                </span>
              </li>
            ))}
          </ul>
        </Cartao>
      </section>

      <EditorProporcoes
        key={membros.map((m) => `${m.user_id}:${m.proporcao}`).join()}
        aberto={editando}
        aoFechar={() => setEditando(false)}
        ledgerId={orcamento.id}
        membros={membros}
        nome={nome}
        aoSalvar={() => {
          setEditando(false)
          aoMudar()
          carregar()
        }}
      />
    </div>
  )
}

function EditorProporcoes({
  aberto,
  aoFechar,
  ledgerId,
  membros,
  nome,
  aoSalvar,
}: {
  aberto: boolean
  aoFechar: () => void
  ledgerId: string
  membros: ContextoOrcamento['membros']
  nome: (id: string) => string
  aoSalvar: () => void
}) {
  const toast = useToast()
  const [pesos, setPesos] = useState<Record<string, number>>(() =>
    Object.fromEntries(membros.map((m) => [m.user_id, m.proporcao])),
  )
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const soma = Object.values(pesos).reduce((a, b) => a + b, 0)
  const mudou = membros.some((m) => pesos[m.user_id] !== m.proporcao)

  async function salvar() {
    setSalvando(true)
    setErro(null)
    try {
      await salvarProporcoes(
        ledgerId,
        membros.map((m) => ({ user_id: m.user_id, proporcao: pesos[m.user_id] ?? 0 })),
      )
      vibrar('sucesso')
      toast.mostrar('Proporções salvas')
      aoSalvar()
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Sheet
      aberto={aberto}
      aoFechar={aoFechar}
      selo="Acerto"
      titulo="Proporções"
      rodape={
        <>
          <Botao variante="fantasma" className="flex-1" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao className="flex-1" carregando={salvando} disabled={!mudou || soma === 0} onClick={salvar}>
            Salvar proporções
          </Botao>
        </>
      }
    >
      <p className="mb-4 text-sm text-suave">Pesos: 1 e 1 é meio a meio; 2 e 1 divide em 2/3 e 1/3.</p>
      <div className="space-y-3">
        {membros.map((m) => {
          const p = pesos[m.user_id] ?? 0
          return (
            <div key={m.user_id} className="flex items-center gap-3">
              <span className="min-w-0 flex-1 truncate text-sm text-texto">{nome(m.user_id)}</span>
              <span className="w-10 text-right font-mono text-xs text-tenue">
                {soma > 0 ? `${Math.round((p / soma) * 100)}%` : '—'}
              </span>
              <Campo
                aria-label={`Peso de ${nome(m.user_id)}`}
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                value={p}
                onChange={(e) => {
                  const v = Math.max(0, Math.min(100, Math.trunc(Number(e.target.value) || 0)))
                  setPesos((at) => ({ ...at, [m.user_id]: v }))
                }}
                classeCaixa="w-20"
                className="text-right font-mono"
              />
            </div>
          )
        })}
      </div>
      {soma === 0 && <p className="mt-3 text-xs text-perigo">A soma precisa ser maior que zero.</p>}
      {erro && <p className="mt-3 text-xs text-perigo">{erro}</p>}
    </Sheet>
  )
}
