# O que falta

Orçamento conjunto: PWA (GitHub Pages) + API própria em Hono/Bun na VPS.

- front: `https://orcamento.jaopd.dev` (GitHub Pages, branch `gh-pages`)
- API: `https://orcamento.api.jaopd.dev` → Caddy → `127.0.0.1:8001` → binário `orcamento-api`
- banco: Postgres `orcamento` na VPS, socket unix + peer auth (sem senha)
- e-mail do código: Resend, domínio `orcamento.jaopd.dev`

---

## 1. Rodar local

```bash
# API (precisa de um Postgres; o jeito fácil é o dos testes)
cd api
./testes/rodar.sh                 # 35 testes de integração contra Postgres 17 no Docker
DATABASE_URL=postgres://... ORIGEM=http://localhost:5173 \
  EMAILS_PERMITIDOS=voce@x.com bun --hot src/index.ts

# front
cp .env.example .env              # VITE_API_URL=http://localhost:8001
pnpm dev
```

Sem `RESEND_API_KEY` o pedido de código falha com 502 — em dev, olhe o código
direto no banco não dá (só o hash é gravado); use uma chave de teste do Resend.

## 2. Verificar antes de confiar

```bash
pnpm verificar          # data/fuso, dinheiro em centavos, CSV
pnpm fumaca             # monta as 4 telas em jsdom com a rede stubada
pnpm build              # tsc + vite + service worker
cd api && ./testes/rodar.sh
```

O que os testes da API cobrem: estranho recebe 404 em todo endpoint de orçamento
alheio; convite de uso único, com validade e aceite idempotente; fila idempotente
e autoria vinda da sessão; código de login de uso único e morto após 5 chutes;
sessão expirada; CSRF (Origin + JSON obrigatórios nas escritas).

## 3. Deploy da API

```bash
cd api
bun build --compile --target=bun-linux-x64 src/index.ts --outfile dist/orcamento-api
scp dist/orcamento-api jaopd:~/
```

Um binário só (~110 MB, com o runtime do Bun dentro), sem Node nem Bun na VPS.
Na VPS, como root:

```bash
install -m 755 /home/jaopd/orcamento-api /srv/orcamento/orcamento-api
sudo -u orcamento /srv/orcamento/orcamento-api migrar
systemctl restart orcamento
```

Unit: `/etc/systemd/system/orcamento.service`. Segredos: `/etc/orcamento/env`
(`RESEND_API_KEY`, `EMAILS_PERMITIDOS`, `ORIGEM`, `PORT`).

## 4. Deploy do front

```bash
pnpm deploy   # build + gh-pages -d dist
```

O `public/CNAME` já leva `orcamento.jaopd.dev`.

---

## 5. O que ainda não existe

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

## 6. Mapa rápido do código

```
src/lib/
  api.ts        fetch com cookie de sessão; 401 no meio do uso volta pro login
  datas.ts      fuso e virada de mês
  dinheiro.ts   centavos inteiros
  fila.ts       reenvio offline, só INSERT, idempotente pelo UUIDv7
  uuidv7.ts     id gerado no cliente, ordenável no tempo
  csv.ts        export; separador ';' porque a vírgula é o decimal
src/features/   auth, orcamentos, lancamentos, mes
api/
  src/app.ts        Hono: CORS, CSRF, rotas
  src/auth.ts       código por e-mail, sessão em cookie HttpOnly (só o hash no banco)
  src/rotas/        orçamentos (com exigeMembro), lançamentos, convites
  src/migrar.ts     aplica migrations/ (embutidas no binário)
  migrations/       0001 schema, 0002 funções (criar orçamento, convite)
  testes/           rodar.sh + api.test.ts
```
