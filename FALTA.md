# O que falta

Orçamento conjunto: PWA (GitHub Pages) + API própria (repo `orcamento-api`) na VPS.

- front: `https://orcamento.jaopd.dev` (GitHub Pages, branch `gh-pages`)
- API: `https://orcamento.api.jaopd.dev` → Caddy → `127.0.0.1:8001` (repo `orcamento-api`)
- banco: Postgres `orcamento` na VPS, socket unix + peer auth (sem senha)
- e-mail do código: Resend, domínio `orcamento.jaopd.dev`

---

## 1. Rodar local

A API mora no repo **`orcamento-api`** (Hono + Bun + Prisma). Suba ela primeiro;
o README de lá diz como.

```bash
cp .env.example .env              # VITE_API_URL=http://localhost:8001
pnpm dev
```

## 2. Verificar antes de confiar

```bash
pnpm verificar          # data/fuso, dinheiro em centavos, CSV
pnpm fumaca             # monta todas as telas em jsdom com a API devolvendo vazio
pnpm build              # tsc + vite + service worker
```

A segurança (quem enxerga qual orçamento) é testada no `orcamento-api`.

## 3. Deploy do front

```bash
pnpm deploy   # build + gh-pages -d dist
```

O `public/CNAME` já leva `orcamento.jaopd.dev`.

---

## 4. O que ainda não existe

### Precisa fazer

| O quê | Por quê |
|---|---|
| **Testar no celular de verdade** | Build, tipos e render em jsdom passam; layout no celular, ninguém viu. |
| **Instalar a PWA nos dois aparelhos** | E confirmar o login por código **com o app na tela inicial**. |
| **Teste de modo avião** | Lançar 3 gastos sem rede, matar o app, reabrir, religar. Os 3 sobem, nenhum duplica. O app abre offline com a última identidade em cache (`orcamento:usuario`). |
| **Backup do banco** | Adiado de propósito. Antes de ter dado de verdade, `pg_dump` diário pra fora da VPS. |
| **Chaves VAPID na VPS** | Sem `VAPID_PUBLICA`/`VAPID_PRIVADA`/`VAPID_CONTATO` em `/etc/orcamento/env` o aviso de meta não sai. Gerar com `bunx web-push generate-vapid-keys`. |
| **Ver os gráficos a olho** | Análises (recharts) só foi testada em jsdom; claro e escuro não foram conferidos. |
| **Limpar telas velhas** | `features/mes/Mes.tsx` e `features/orcamentos/Membros.tsx` não são mais usados pelo App (Dashboard, Metas e ConfigOrcamento substituíram). Mes.tsx ainda roda na fumaça. |

### Cortado de propósito (não é esquecimento)

| O quê | Por que ficou fora |
|---|---|
| **Parcelamento de cartão** | Voltar é coluna `installment_group_id` + expandir em N linhas no cliente. |
| **Editar offline** | A fila é só-INSERT: elimina o bug de reenvio tardio sobrescrever edição nova. Editar exige rede. |
| **Dono/admin** | Todo membro pode tudo. `ledger_members.papel` é a evolução se precisar. |

---

## 5. Mapa rápido do código

```
src/lib/
  api.ts        fetch com cookie de sessão; 401 no meio do uso volta pro login
  datas.ts      fuso e virada de mês
  dinheiro.ts   centavos inteiros
  fila.ts       reenvio offline, só INSERT, idempotente pelo UUIDv7
  uuidv7.ts     id gerado no cliente, ordenável no tempo
  csv.ts        export; separador ';' porque a vírgula é o decimal
  eventos.ts    SSE: relê a tela quando o outro membro muda algo
src/features/
  auth  orcamentos (seletor, config, convites, categorias)  lancamentos (lançar, editar)
  mes (dashboard)  historico  metas  analises  acerto  recorrentes  busca  perfil
  notificacoes (push.ts; public/push-sw.js mostra o aviso)
```

## 6. O que existe agora

- Realtime por SSE, histórico com autoria, edição de lançamento (online).
- Categorias customizáveis (criar, editar, reordenar, arquivar).
- Metas por categoria + meta de economia; análises com gráficos e escopo eu/membro/conjunto.
- Acerto de contas com proporções; lançamentos recorrentes; busca; aviso de meta por push.
- Perfil: nome, troca de e-mail, tema, sair dos outros aparelhos.
