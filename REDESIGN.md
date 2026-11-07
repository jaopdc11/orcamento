# Redesign — "escuro sóbrio"

Identidade portada do projeto fono (escuro principal, acento teal, entrada verde,
saída rosa-vermelho) com a estrutura de tokens do agenda. Regras de uso das telas
em `DESIGN.md`. Só visual/UX: API, queries, `lib/api.ts`, `lib/fila.ts`,
`lib/eventos.ts` e lógica de negócio não mudaram.

## O que foi feito

- **Tokens semânticos** (`src/index.css`, `:root` claro + `.dark` escuro, mesmas
  variáveis nos dois) e `tailwind.config.js` só com eles. Os aliases antigos
  (`painel`, `painel-forte`, `apagado`, `primaria`) foram removidos.
- **Fontes self-hosted** via @fontsource: Space Grotesk (títulos), Inter (texto),
  JetBrains Mono (dinheiro, datas curtas, contagens).
- **Sistema de design** em `src/design` (ver tabela no `DESIGN.md`). Promovidos
  nesta rodada: `TecladoValor` (era de Metas), `CaixasCodigo` (era de auth),
  `Avatar`/`iniciais` (era de perfil), `TOOLTIP_GRAFICO`, `TICK_GRAFICO` e
  `corDoMembro` (eram locais das Análises).
- **Shell**: barra inferior Início · Mês · (+) · Análises · Mais; (+) abre o
  teclado de lançar num Sheet; sidebar no desktop; seletor de orçamento em Sheet.
- **Telas refeitas**: Início, Mês (Dashboard), Editar lançamento (Sheet), Lançar,
  Análises, Acerto, Metas, Recorrentes, Histórico, Busca, Configurações, Perfil,
  Login e Começar.
- **Código morto removido**: `features/mes/Mes.tsx`, `features/orcamentos/Seletor.tsx`
  (o shell usa `SeletorSheet`), `features/orcamentos/Membros.tsx` (membros vivem
  na Configuração) e `lib/ui.tsx`.
- **Fumaça**: monta tudo acima com dados vazios; lê o `body` inteiro porque o
  Sheet renderiza em portal. O teste do seletor agora monta o `SeletorSheet`.

## O que ficou

- Ninguém olhou num navegador/celular ainda. Conferir principalmente: caixas do
  código (foco, colar, autofill OTP no iOS), Sheet com teclado aberto, tema claro.
- `PALETA_CATEGORIAS` é uma paleta só, afinada pro escuro; no claro o âmbar e o
  teal claro ficam fracos como texto (como fundo/ponto funcionam).
- Início não tem botão próprio de lançar (o vazio aponta pro +). Pra ter, o shell
  precisa expor `aoLancar` por contexto.
- Busca não abre edição de lançamento; dava pra reaproveitar o `EditarLancamento`.
- Lançamento pendente (na fila) não abre edição nem apagar; apagar exige internet.
- `Lancar.tsx` tem o próprio teclado (layout diferente: valor no topo, teclas
  embaixo); dá pra unificar com `TecladoValor` se ele ganhar modo "só teclas".
- `LinhaLancamento`/`RotuloDia` ainda moram em `features/mes/Dashboard.tsx`
  (dependem do tipo `Linha` do `useMes`); Histórico e Busca têm cópias parecidas.
- Ícones que faltam em `lib/icones`: filtro, setas, arquivar, copiar (hoje usam
  `list`, `inbox` e caracteres ↑ ↓).
- `BarraProgresso` sem modo "não excede" (Acerto contorna limitando a 100).
- Ícones PNG do PWA: conferir se batem com a paleta nova.
- Antes de publicar: rodar em build **release** pra julgar fluidez; nada de
  concluir "tá lento" pelo `pnpm dev`.
