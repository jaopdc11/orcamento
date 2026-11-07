# Redesign — home baseada no Cashly

Objetivo: deixar o orçamento com a **cara do Cashly** (`https://cashly.jaopd.dev`),
**baseado nele, não réplica pixel a pixel**. O Cashly é um dashboard de desktop com
sidebar; o orçamento adotou essa linguagem, adaptada às features que ele tem de fato.

Estado: **funciona e builda** (`pnpm build` verde). Falta validar o visual no olho e
decidir uns cortes (abaixo).

---

## O que já foi feito

### Base visual
- **Fonte Inter** (igual o Cashly) — `index.html` + `src/index.css` (com `font-feature-settings` e antialias).
- **Dark mode por CLASSE** (`.dark` no `<html>`), não mais por media-query — `tailwind.config.js` (`darkMode: 'class'`).
  - Script anti-flash no `<head>` do `index.html` aplica o tema antes do render.
  - `src/lib/tema.ts`: `temaAtual()`, `alternarTema()`, `aplicarTema()`. Padrão segue o sistema até o usuário escolher; escolha vai pro `localStorage` (`orcamento:tema`).
  - Os tokens antigos (`fundo/painel/borda/texto/apagado/saida/entrada`) agora seguem o `.dark` (definidos em `:root` e `.dark` no `index.css`), então as telas que ainda usam token continuam trocando de tema junto.
- Paleta = a do Cashly: **blue-600** primário, **emerald** receita, **red** despesa, cinzas neutros, **amber** aviso.

### Estrutura nova
- **`src/App.tsx`** (reescrito) — shell:
  - **Sidebar fixa** no desktop (`aside`, `hidden lg:flex w-56`): nome do orçamento, menu (Orçamento, Membros, Outro orçamento) e ações no rodapé (Tema, Ocultar valores, Sair).
  - **Top bar** no mobile (`lg:hidden`) com os mesmos atalhos em ícones.
  - Conteúdo em `main.lg:pl-56` > `max-w-6xl mx-auto px-4 sm:px-6 py-6`.
  - Estado `ocultar` (hide values) e `tema` vivem aqui.
- **`src/features/mes/Dashboard.tsx`** (novo) — a home "Orçamento Mensal":
  - Navegador de mês, 4 cards de resumo (Receitas, Despesas, Saldo, Metas), colunas **Receitas/Despesas** com "+ Adicionar" (form inline) e **estado vazio** no estilo Cashly, card de **Metas do mês** com barras.
  - Dados vêm do `useMes` (o mesmo do resto do app); adicionar passa pela **fila offline** (`enfileirar`); apagar é soft-delete (`arquivarLancamento`). **Nada da lógica de dados mudou.**
- **`src/lib/icones.tsx`** (novo) — ícones inline estilo lucide (sem dependência).

### Telas centralizadas (não esticam mais)
- **Login** (`max-w-sm`), **Começar/Outro orçamento** (`max-w-sm`), **Membros** (`max-w-xl`), Dashboard (`max-w-6xl`).
- Bug de fundo consertado: o projeto usa **Tailwind 3.3.2**, onde `min-h-dvh` **não existe** (só 3.4+). Estava quebrado silenciosamente (login grudava no topo). Trocado por `min-h-[100dvh]` (valor arbitrário, funciona no 3.3).

### Rodar desplugado do Supabase (pra ver o design)
- Sem `.env`, o app usa um **cliente local em localStorage** — `src/lib/supabaseLocal.ts`, escolhido em `src/lib/supabase.ts`. Login aceita **qualquer e-mail + qualquer código de 6 dígitos**. Dados em chaves `local:*`. Produção (com `.env`) não é afetada.

---

## Pendências / decisões pra tocar depois

1. **Telas órfãs**: `src/features/lancamentos/Lancar.tsx` (teclado de caixa) e `src/features/mes/Mes.tsx` (mês detalhado + edição de metas) **não são mais usadas**. Decisão: apagar de vez, ou reaproveitar (ex: lançamento rápido no mobile / tela de Extrato). Hoje só o Dashboard existe na navegação.
2. **Editar metas**: o Dashboard **mostra** metas (barras) mas não deixa **editar** — isso vivia no `Mes.tsx`. Se for manter, portar o editor pra dentro do Dashboard ou pra uma view "Metas".
3. **Extrato detalhado**: o Cashly tem "Extrato" e "Relatório". O orçamento tinha a lista por dia no `Mes.tsx`. Decidir se vira uma view separada na sidebar.
4. **Mobile**: hoje o mobile é uma top bar com ícones. O Cashly usa um drawer. Avaliar se vale um menu lateral deslizante.
5. **Ícones do app (PWA)**: `public/icon-192/512.png` e `apple-touch-icon.png` ainda estão na paleta velha (gerados por `scripts/gerar-icones.py`, precisa de PIL). `favicon.svg` já foi pro azul. Regenerar os PNGs quando fechar a paleta.
6. **Ajustes finos de visual**: densidade dos cards, espaçamento, cor do saldo, o "Metas" como 4º card (é o que o orçamento tem no lugar de "Investido" do Cashly). Validar no olho e afinar.

---

## Referência do Cashly (pra não rebaixar os assets de novo)

Fonte: `Inter` (400–700). Layout: auth em `max-w-md/sm` centralizado; app em `max-w-6xl`. Dark por classe (`dark:`). Raios: `rounded-lg`/`rounded-md`. Cores: `blue-600` primário, `emerald-500/600` receita, `red-500` despesa, `gray-50/900` superfícies, `gray-200/800` bordas.

Sidebar (nav real do Cashly, adaptamos pro que existe): `[{id:'budget',label:'Orçamento'},{id:'invest',label:'Investimentos'},{id:'simulator',label:'Simulador'},{id:'dashboard',label:'Dashboard'},{id:'schedule',label:'Agenda'},{id:'report',label:'Relatório'},{id:'extrato',label:'Extrato'}]`.

Classe do item de nav ativo: `bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-medium shadow-sm`. Card de resumo: `p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800`, label `text-[10px] font-medium uppercase tracking-wide`, valor `text-lg font-semibold tabular-nums`. Estado vazio: círculo `w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800` + ícone + "Nenhuma X registrada" + 'Clique em "Adicionar" para começar'.

---

## Como testar

```bash
pnpm dev        # sem .env → modo local; login = qualquer e-mail + código de 6 dígitos
pnpm build      # tsc + vite + PWA (verde)
pnpm fumaca     # monta as telas em jsdom (injeta URL fake → cliente real stubado)
```

(Ver `FALTA.md` pro plugar no Supabase de verdade, deploy e backup.)
