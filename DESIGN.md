# DESIGN — regras pras telas

Este arquivo é a ÚNICA coordenação entre quem refaz telas. Se algo não está aqui
nem em `src/design/`, não invente um padrão novo na sua tela: use o mais próximo
que existe.

Identidade: **escuro sóbrio** (o do projeto fono). Escuro é o tema principal; o
claro é derivado dos mesmos papéis. Nada de confete, glow, gradiente chamativo,
fundo de aurora/blob. A graça vem de tipografia, espaçamento e movimento curto.

---

## 0. Regras duras

1. **Importe só de `@/design`** (que também reexporta `Icone`). Não importe nada
   de `@/lib/ui` (legado, vai morrer).
2. **Nunca cor literal** nas telas: nada de `gray-500`, `red-400`, `#fff`,
   `dark:...`, `bg-white`. Só os tokens de papel abaixo. O tema troca sozinho;
   se você escreveu `dark:` alguma coisa, está errado.
3. **Todo dinheiro passa por `<Valor/>`** (mono, tabular, sinal e cor por tipo,
   respeita `ocultar`). Nunca `formatar()` solto num `<span>` em tela nova.
4. **Datas curtas, contagens e percentuais em `font-mono`.**
5. Não mexa em `*.queries.ts`, `lib/api.ts`, `lib/fila.ts`, `lib/eventos.ts`,
   `useMes.ts` nem em lógica de negócio. Trabalho é só apresentação.
6. **Título da tela** (o `titulo` do `CabecalhoTela`) tem que continuar sendo o
   texto que `src/dev/fumaca.tsx` procura (ex.: "Histórico", "Acerto de contas",
   "Configurações", "Orçamento Mensal" no Dashboard). Se precisar mudar, edite
   só a linha da SUA tela na fumaça.
7. Checagens antes de entregar: `pnpm typecheck && pnpm fumaca && pnpm build`.

## 1. Mapa de propriedade (quem edita o quê)

| Grupo | Pode editar |
|---|---|
| G1 Início + Mês + editar | `src/features/inicio/Inicio.tsx`, `src/features/mes/Dashboard.tsx`, `src/features/mes/Mes.tsx`, `src/features/lancamentos/EditarLancamento.tsx` |
| G2 Análises + Acerto | `src/features/analises/Analises.tsx`, `src/features/acerto/Acerto.tsx` |
| G3 Metas + Recorrentes | `src/features/metas/Metas.tsx`, `src/features/recorrentes/Recorrentes.tsx`, `src/features/recorrentes/SeloRecorrente.tsx` |
| G4 Histórico + Busca | `src/features/historico/Historico.tsx`, `src/features/busca/Busca.tsx` |
| G5 Config + Membros + Perfil + Login + Começar | `src/features/orcamentos/ConfigOrcamento.tsx`, `Membros.tsx`, `Comecar.tsx`, `Seletor.tsx`, `src/features/perfil/Perfil.tsx`, `src/features/auth/Login.tsx` |

Ninguém edita: `src/design/*`, `src/shell/*`, `src/App.tsx`, `src/index.css`,
`tailwind.config.js`, `src/lib/*`, `src/features/lancamentos/Lancar.tsx`.
Precisa de algo novo no design? Faça LOCAL na sua tela (componente privado no
mesmo arquivo, usando tokens) e anote no relatório pra ser promovido depois.
Arquivos novos só dentro da sua pasta de feature.

Props exportadas das telas (`Props`, assinatura do componente) **não mudam**:
o `App.tsx` e a fumaça dependem delas.

## 2. Tokens (cores por papel)

Classes Tailwind (`bg-X`, `text-X`, `border-X`, aceitam `/opacidade`):

| Papel | Uso |
|---|---|
| `fundo` | fundo da página (o shell já pinta) |
| `superficie` | cartão, sheet, lista |
| `superficie-alta` | pressionado, trilho de barra, chip neutro, hover |
| `campo` | input, select, segmented (um degrau ABAIXO do cartão) |
| `borda` / `borda-forte` | fio de cartão e divisória / hover e destaque |
| `texto` | texto principal |
| `suave` | texto secundário (`text-suave`) |
| `tenue` | rótulo, legenda, placeholder (`text-tenue`) |
| `acento` / `acento-suave` / `sobre-acento` | teal: ação primária, ativo, link / hover / texto em cima do acento |
| `entrada` | receita, dinheiro que entra, positivo |
| `saida` | despesa, dinheiro que sai, estourou |
| `atencao` | aviso, pendente, perto do limite |
| `perigo` | destrutivo, erro |
| `tinta-acento`, `tinta-entrada`, `tinta-saida`, `tinta-atencao`, `tinta-perigo` | fundo tintado do estado (badge, faixa, ícone) — par com `text-<estado>` |

Outros: `rounded-card` (14px), `rounded-sheet` (20px), `shadow-card`,
`shadow-flutuante`, `ease-suave`, espaçamentos `h-nav`, `h-topo`, `w-sidebar`.

Aliases antigos (`painel`, `painel-forte`, `apagado`, `primaria`) existem só pras
telas não refeitas não quebrarem. **Não use em tela nova.**

Gráficos (recharts): `CORES_GRAFICO` (`entrada`, `saida`, `acento`, `atencao`,
`grade`, `eixo`, `texto`, `superficie`) — são `rgb(var(--x))`, trocam de tema
sozinhos. Série por categoria: `corDaCategoria(cat.id, cat.cor).cor`. Eixos:
`stroke={CORES_GRAFICO.eixo}`, `tick={{ fill: CORES_GRAFICO.eixo, fontSize: 11, fontFamily: 'JetBrains Mono Variable' }}`,
grade `stroke={CORES_GRAFICO.grade}` tracejada, sem linha de eixo. Tooltip:
`contentStyle={{ background: 'rgb(var(--superficie-alta))', border: '1px solid rgb(var(--borda))', borderRadius: 12, color: 'rgb(var(--texto))' }}`.
Barras com `radius={[6,6,0,0]}`, sem animação maluca (`animationDuration={600}`).

## 3. Tipografia

- `font-display` (Space Grotesk): títulos de tela (`CabecalhoTela` já usa), título de seção, nome de cartão grande.
- `font-sans` (Inter, padrão): todo o resto.
- `font-mono` (JetBrains Mono): **todo valor em dinheiro** (via `<Valor/>`), datas curtas (`12/11`, `hoje`), contagens, percentuais, códigos de convite.
- Escala: título de tela `text-2xl`; seção `text-base font-semibold`; corpo `text-sm`; legenda `text-xs`; selo 10px uppercase (use `<Selo/>`).
- Valor herói (o número principal da tela): `<Valor tamanho="heroi" animar />` — **um por tela**.

## 4. Espaçamento e layout

- O shell já dá o gutter (`px-4`, `sm:px-6`), largura máx. (`max-w-5xl`),
  topo e o espaço da nav inferior. A tela começa direto no `CabecalhoTela`.
- Entre blocos: `space-y-3` (cartões relacionados) / `space-y-6` ou `mt-6` (seções).
- Dentro do cartão: `p-4` (padrão do `Cartao`). Grade de cartões: `grid grid-cols-2 gap-3`, `lg:grid-cols-3/4`.
- Mobile-first: escreva pro celular (≈380px) e só então `sm:`/`lg:`.
- Alvos de toque ≥ 44px (`min-h-11`). `Botao md/lg`, `BotaoIcone`, `LinhaLista`, `Campo` já garantem.

## 5. Componentes (`@/design`)

| Componente | Quando usar |
|---|---|
| `CabecalhoTela` | topo de TODA tela: `selo` (contexto, ex. nome do mês), `titulo`, `descricao`, `acao` |
| `Selo` / `TituloSecao` | microrrótulo uppercase / cabeçalho de seção dentro da tela |
| `Cartao` | bloco com borda fina. `aoTocar` → vira botão com `active:scale`. `semPadding` pra lista/gráfico de borda a borda |
| `Botao` | `primario` (1 por contexto), `secundario`, `fantasma`, `perigo`; `tamanho` sm/md/lg; `carregando`; `cheio`; `icone` |
| `BotaoIcone` | ação só de ícone (44×44, `rotulo` obrigatório = aria-label) |
| `Valor` | dinheiro. `tipo` entrada/saida/neutro/auto (saldo), `tamanho` sm/md/lg/heroi, `ocultar={ocultar}` SEMPRE, `animar` só no herói, `semMoeda` pra coluna |
| `Contador` | número genérico que corre (não-dinheiro) |
| `Campo` / `Select` / `Textarea` / `Rotulo` | formulário; `rotulo`, `ajuda`, `erro` embutidos |
| `Chip` / `FileiraChips` | filtro/seleção tocável (fileira rola na horizontal) |
| `Badge` | etiqueta NÃO tocável: `tom` neutro/acento/entrada/saida/atencao/perigo |
| `Tabs` | segmented de 2–4 vistas da mesma coisa (`cheio`, `tom`) |
| `BarraProgresso` | progresso/meta; enche do zero; `>100` vira `saida` (excedido), `>= avisoEm` (85) vira `atencao` |
| `Sheet` | todo formulário/detalhe por cima (editar, criar, confirmar). Bottom sheet no celular, caixa no desktop. `rodape` pros botões (já tem safe-area) |
| `useToast().mostrar(txt, {tom, acao})` | confirmação depois de salvar/apagar. `acao: {rotulo:'Desfazer', aoTocar}` quando der |
| `vibrar('sucesso' \| 'aviso' \| 'leve' \| 'erro')` | `sucesso` ao salvar/lançar, `aviso` ao apagar |
| `Vazio` | estado vazio: ícone + UMA frase boa + ação. `compacto` dentro de cartão |
| `Aviso` | faixa de erro/aviso na tela, com `aoTentarDeNovo` |
| `Lista` / `LinhaLista` | lista padrão em cartão: `inicio` (ícone), `titulo`, `subtitulo`, `fim` (Valor), `aoTocar`, `acoes`, `apagada` |
| `Esqueleto` / `EsqueletoLista` | carregando: forma do conteúdo, não spinner |
| `IconeCategoria` | emoji da categoria num quadrado tintado pela cor estável dela |
| `corDaCategoria(id, cor?)` | `{cor, tinta}` estáveis por categoria (gráfico, legenda, ponto) |
| `TecladoValor` | teclado de caixa registradora pra valor em centavos (`tom`, `rotulo`, `vazio`) |
| `CaixasCodigo` | código de 6 dígitos em caixas mono (um input só por baixo: OTP e colar funcionam) |
| `Avatar` / `iniciais()` | avatar de iniciais de membro |
| `corDoMembro(i)` | cor estável de membro pela posição no orçamento (gráficos, legendas) |
| `CORES_GRAFICO` / `TOOLTIP_GRAFICO` / `TICK_GRAFICO` | cores, tooltip e eixo do recharts via CSS var (tema troca sozinho) |
| `cx(...)` | juntar classes condicionais |

## 6. Padrões

**Linha de lançamento** (todas as listas de lançamento iguais):
```tsx
<LinhaLista
  inicio={<IconeCategoria categoria={cat} />}
  titulo={l.descricao ?? cat?.nome ?? 'Sem categoria'}
  subtitulo={<><span className="font-mono">{diaMes(l.occurred_on)}</span> · {quem}</>}
  fim={<Valor centavos={l.amount_cents} tipo={l.kind === 'income' ? 'entrada' : 'saida'} ocultar={ocultar} />}
  aoTocar={() => setEditando(l)}
  apagada={l.pendente}
/>
```
- Toque na linha = abrir/editar (num `Sheet`). Ações extras ficam **sempre
  visíveis** em `acoes` (`BotaoIcone`); **proibido** `opacity-0 group-hover:`.
- Apagar: confirmação dentro do Sheet (botão `perigo`) — `confirm()` não.
  Depois: `vibrar('aviso')` + `toast.mostrar('Apagado')`.
- Pendente de rede: `apagada` + `<Badge tom="atencao">pendente</Badge>`.

**Estados** — toda tela que busca dados tem os três:
- carregando → `EsqueletoLista` / `Esqueleto` no formato final;
- erro → `<Aviso aoTentarDeNovo={recarregar}>{erro}</Aviso>`;
- vazio → `<Vazio titulo="..." acao={<Botao>...</Botao>} />`. Frase boa:
  "Nenhuma meta ainda. Uma meta por categoria já ajuda." — não "Nenhum item".

**Formulário em Sheet**:
```tsx
<Sheet aberto={!!x} aoFechar={fechar} selo="Metas" titulo="Nova meta"
  rodape={<><Botao variante="fantasma" className="flex-1" onClick={fechar}>Cancelar</Botao>
           <Botao className="flex-1" carregando={salvando} onClick={salvar}>Salvar</Botao></>}>
  <div className="space-y-4"><Campo rotulo="Nome" ... /></div>
</Sheet>
```

**Resumo em cartões**: `Selo` + `Valor tamanho="lg"` dentro de `Cartao`, em `grid grid-cols-2 gap-3`.

## 7. Movimento

Easing único `ease-suave` = `cubic-bezier(.16,1,.3,1)`.
- Troca de tela: o shell remonta por `key` e toca `animate-subir`. Não anime a tela inteira de novo.
- Listas/painéis na primeira carga: `cascata` no contêiner (`<Lista cascata>` ou `className="cascata space-y-3"`). Não em lista que muda a cada tecla (busca).
- Elemento que nasce (badge, check): `animate-pop`. Caixa/menu: `animate-scale-in`. Fade simples: `animate-fade`.
- Tocáveis: `active:scale-[0.97]` (os componentes já têm).
- Número herói: `Valor animar`. Barras: `BarraProgresso` já enche do zero.
- `prefers-reduced-motion` desliga tudo no CSS; não precisa tratar.

## 8. Shell (já pronto, só pra saber)

- Celular: `TopBar` sticky (orçamento → seletor em Sheet; ocultar; tema; seta de voltar nas subtelas do Mais) + `NavInferior` (Início · Mês · (+) · Análises · Mais). (+) abre `Lancar` num Sheet.
- Desktop (lg+): `Sidebar` com tudo; sem nav inferior.
- Vistas: `inicio`, `mes` (Dashboard), `analises`, `mais` e, dentro do Mais, `metas`, `acerto`, `recorrentes`, `historico`, `busca`, `config`, `perfil`.
- Toast global: `ProvedorToast` no App — `useToast()` funciona em qualquer tela (na fumaça vira no-op).
- Valores ocultos: venha pela prop `ocultar` do contexto; repasse pra `<Valor/>`.
