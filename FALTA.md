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
pnpm fumaca             # monta as 4 telas em jsdom com a rede stubada
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

### Cortado de propósito (não é esquecimento)

| O quê | Por que ficou fora |
|---|---|
| **Parcelamento de cartão** | Voltar é coluna `installment_group_id` + expandir em N linhas no cliente. |
| **Realtime** | São duas pessoas. Reler ao ganhar foco é indistinguível na prática. |
| **Editar lançamento** | Só apagar (soft delete) e lançar de novo. Estorno é linha negativa. |
| **Editar offline** | A fila é só-INSERT: elimina o bug de reenvio tardio sobrescrever edição nova. |
| **Categorias customizáveis** | As 13 semeadas resolvem o primeiro mês. |
| **Gráficos** | Depois de um mês de uso real. |
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
src/features/   auth, orcamentos, lancamentos, mes
```
