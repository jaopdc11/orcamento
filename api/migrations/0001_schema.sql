-- 0001_schema.sql — orçamento conjunto (pote comum, 2 pessoas)
--
-- Portado de supabase/migrations/0001_schema_rls.sql. O que mudou:
--   - Sem auth.users / auth.uid(): usuário e sessão são tabelas nossas.
--   - Sem RLS: a autorização é feita pela API (middleware de membro em toda rota
--     com :ledgerId). O banco só é alcançável pelo socket unix, como o usuário
--     de sistema `orcamento` — não existe "anon key" pública aqui.
--
-- Princípios mantidos:
--   - Dinheiro SEMPRE em centavos inteiros (bigint). Nunca float.
--   - occurred_on (date) é a data do gasto e fecha o mês; created_at é só auditoria.
--   - Nada é apagado de verdade: deleted_at. Estorno é linha nova com valor negativo.
--   - O id de entries vem do CLIENTE (UUIDv7) — é o que torna o reenvio da fila idempotente.

-- ============================================================================
-- identidade
-- ============================================================================

create table users (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique check (email = lower(email)),
  created_at timestamptz not null default now()
);

-- Código de login: guardamos só o sha256. Um dump do banco não entrega código válido.
-- Uma linha por e-mail: pedir código novo invalida o anterior.
create table login_codes (
  email      text primary key check (email = lower(email)),
  code_hash  text not null,
  expires_at timestamptz not null,
  tentativas int not null default 0,
  created_at timestamptz not null default now()
);

-- Sessão: o cookie carrega o token cru; aqui só o sha256.
create table sessions (
  token_hash   text primary key,
  user_id      uuid not null references users on delete cascade,
  expires_at   timestamptz not null,
  last_seen_at timestamptz not null default now(),
  created_at   timestamptz not null default now()
);
create index on sessions (user_id);

-- ============================================================================
-- domínio
-- ============================================================================

create table ledgers (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  created_at timestamptz not null default now()
);

create table ledger_members (
  ledger_id uuid not null references ledgers on delete cascade,
  user_id   uuid not null references users on delete cascade,
  apelido   text,
  primary key (ledger_id, user_id)
);
create index on ledger_members (user_id);

create table categories (
  id          uuid primary key default gen_random_uuid(),
  ledger_id   uuid not null references ledgers on delete cascade,
  nome        text not null,
  kind        text not null check (kind in ('expense','income')),
  emoji       text,
  cor         text,
  ordem       int  not null default 0,
  archived_at timestamptz
);
create index on categories (ledger_id, ordem);

create table entries (
  id           uuid primary key,                       -- gerado no cliente (UUIDv7)
  ledger_id    uuid not null references ledgers on delete cascade,
  category_id  uuid references categories on delete restrict,
  kind         text not null check (kind in ('expense','income')),
  amount_cents bigint not null check (amount_cents <> 0),
  -- saldo = sum(signed_cents). Evita espalhar `case` pelo TypeScript.
  signed_cents bigint generated always as
    (case when kind = 'income' then amount_cents else -amount_cents end) stored,
  -- default é só rede de segurança: o cliente manda a data local explicitamente.
  -- O servidor roda em America/Sao_Paulo, mas o `at time zone` deixa isso explícito
  -- e imune a quem mexer no timezone do Postgres depois.
  occurred_on  date not null default ((now() at time zone 'America/Sao_Paulo')::date),
  descricao    text,
  paid_by      uuid references users,
  created_by   uuid not null references users,
  client_created_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);
create index on entries (ledger_id, occurred_on desc);

create table budgets (
  ledger_id   uuid not null references ledgers on delete cascade,
  category_id uuid not null references categories on delete cascade,
  month       date not null check (month = date_trunc('month', month)::date),
  limit_cents bigint not null check (limit_cents >= 0),
  primary key (ledger_id, category_id, month)
);

-- Convite: é o que carrega a identidade de quem entra.
-- Uso único + validade curta: um código vazado num print de grupo não vira
-- porta permanente.
create table ledger_invites (
  code       text primary key,
  ledger_id  uuid not null references ledgers on delete cascade,
  criado_por uuid not null references users,
  expires_at timestamptz not null default now() + interval '7 days',
  used_at    timestamptz,
  used_by    uuid references users,
  created_at timestamptz not null default now()
);
create index on ledger_invites (ledger_id) where used_at is null;

-- ============================================================================
-- triggers
-- ============================================================================

create function touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  -- autoria é imutável: nem o dono muda depois.
  new.created_by := old.created_by;
  return new;
end;
$$;

create trigger entries_touch
  before update on entries
  for each row execute function touch_updated_at();
