import { useMemo, useState } from 'react'
import { mesDe, mesPorExtenso } from '@/lib/datas'
import { mapaDeMembros } from '@/lib/membros'
import { useMes } from '@/features/mes/useMes'
import type { Linha } from '@/features/mes/useMes'
import { LinhaLancamento } from '@/features/mes/Dashboard'
import { EditarLancamento } from '@/features/lancamentos/EditarLancamento'
import { arquivarLancamento } from '@/features/lancamentos/lancamentos.queries'
import {
  Aviso,
  BarraProgresso,
  CabecalhoTela,
  Cartao,
  Esqueleto,
  EsqueletoLista,
  Icone,
  IconeCategoria,
  Lista,
  Selo,
  TituloSecao,
  Valor,
  Vazio,
} from '@/design'
import type { ContextoOrcamento } from '@/lib/tipos'

// Início: a tela de "como estamos este mês" em um olhar. Saldo grande, entrou e
// saiu, só as metas que pedem atenção (as tranquilas ficam no Mês) e os últimos
// lançamentos. Tudo do mesmo useMes do Mês, pra os números baterem.

export type Props = ContextoOrcamento

/** A partir daqui a meta aparece no Início: mesmo limiar do âmbar da BarraProgresso. */
const PERTO_DO_LIMITE = 0.85
const ULTIMOS = 5

export function Inicio({ orcamento, categorias, membros, usuarioId, ocultar }: Props) {
  const mes = useMemo(() => mesDe(), [])
  const { linhas, totais, porCategoria, carregando, erro, recarregar } = useMes(orcamento.id, mes, categorias)
  const [editando, setEditando] = useState<Linha | null>(null)

  const mapaMembros = useMemo(() => mapaDeMembros(membros), [membros])
  const porId = useMemo(() => new Map(categorias.map((c) => [c.id, c])), [categorias])
  const ultimos = useMemo(() => linhas.slice(0, ULTIMOS), [linhas])
  const apertadas = useMemo(
    () =>
      porCategoria
        .filter((r) => r.meta !== null && r.meta > 0 && r.gasto / r.meta >= PERTO_DO_LIMITE)
        .sort((a, b) => b.gasto / (b.meta ?? 1) - a.gasto / (a.meta ?? 1)),
    [porCategoria],
  )
  const gastoPct = totais.entrou > 0 ? (totais.saiu / totais.entrou) * 100 : 0

  return (
    <div>
      <CabecalhoTela selo={orcamento.nome} titulo="Início" descricao={<span className="capitalize">{mesPorExtenso(mes)}</span>} />
      {erro && (
        <Aviso className="mb-4" aoTentarDeNovo={() => void recarregar()}>
          {erro}
        </Aviso>
      )}

      <div className="cascata space-y-3">
        <Cartao>
          <Selo className="mb-2">Saldo do mês</Selo>
          {carregando ? (
            <Esqueleto className="h-10 w-48" />
          ) : (
            <Valor centavos={totais.saldo} tipo="auto" tamanho="heroi" ocultar={ocultar} animar />
          )}
          {totais.entrou > 0 && (
            <BarraProgresso className="mt-4" percentual={gastoPct} tom="acento" rotulo="das entradas já saiu" />
          )}
        </Cartao>

        <div className="grid grid-cols-2 gap-3">
          <Cartao>
            <Selo className="mb-2">Entrou</Selo>
            {carregando ? <Esqueleto className="h-7 w-24" /> : <Valor centavos={totais.entrou} tipo="entrada" tamanho="lg" ocultar={ocultar} />}
          </Cartao>
          <Cartao>
            <Selo className="mb-2">Saiu</Selo>
            {carregando ? <Esqueleto className="h-7 w-24" /> : <Valor centavos={totais.saiu} tipo="saida" tamanho="lg" ocultar={ocultar} />}
          </Cartao>
        </div>
      </div>

      {apertadas.length > 0 && (
        <section className="mt-6">
          <TituloSecao selo="Atenção" titulo="Metas perto do limite" className="mb-3" />
          <Cartao>
            <ul className="cascata space-y-4">
              {apertadas.map((r) => (
                <li key={r.categoria.id} className="flex items-center gap-3">
                  <IconeCategoria categoria={r.categoria} tamanho="sm" />
                  <BarraProgresso
                    className="flex-1"
                    percentual={((r.gasto / (r.meta ?? 1)) * 100)}
                    rotulo={r.categoria.nome}
                    direita={
                      <span className="flex items-baseline gap-1">
                        <Valor centavos={r.gasto} tamanho="sm" ocultar={ocultar} semMoeda />
                        <span className="text-tenue">/</span>
                        <Valor centavos={r.meta ?? 0} tamanho="sm" ocultar={ocultar} semMoeda className="text-tenue" />
                      </span>
                    }
                  />
                </li>
              ))}
            </ul>
          </Cartao>
        </section>
      )}

      <section className="mt-6">
        <TituloSecao selo="Recentes" titulo="Últimos lançamentos" className="mb-3" />
        {carregando ? (
          <EsqueletoLista linhas={3} />
        ) : ultimos.length === 0 ? (
          <Cartao>
            <Vazio
              compacto
              icone="wallet"
              titulo="O mês está em branco."
              descricao={
                <span className="inline-flex items-center gap-1">
                  Toque no <Icone n="plus" className="h-3.5 w-3.5 text-acento" /> pra lançar o primeiro gasto.
                </span>
              }
            />
          </Cartao>
        ) : (
          <Lista cascata>
            {ultimos.map((l) => (
              <LinhaLancamento
                key={l.id}
                linha={l}
                categoria={l.category_id ? porId.get(l.category_id) : undefined}
                membros={mapaMembros}
                usuarioId={usuarioId}
                ocultar={ocultar}
                mostrarData
                aoTocar={l.pendente ? undefined : () => setEditando(l)}
              />
            ))}
          </Lista>
        )}
      </section>

      {editando && (
        <EditarLancamento
          lancamento={editando}
          categorias={categorias}
          membros={mapaMembros}
          usuarioId={usuarioId}
          aoFechar={() => setEditando(null)}
          aoSalvar={async () => {
            setEditando(null)
            await recarregar()
          }}
          aoApagar={async () => {
            await arquivarLancamento(editando.id)
            setEditando(null)
            await recarregar()
          }}
        />
      )}
    </div>
  )
}
