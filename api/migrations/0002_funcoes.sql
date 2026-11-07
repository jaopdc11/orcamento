-- 0002_funcoes.sql — criar orçamento, convidar e aceitar convite.
--
-- Portado de supabase/migrations/0002_rpc.sql. Antes eram SECURITY DEFINER pra
-- furar o RLS; agora não existe RLS, então são funções comuns que recebem o
-- usuário logado em p_uid (vindo da sessão, nunca do corpo da requisição).
-- Continuam no banco porque cada uma é uma transação atômica de várias escritas.

-- ============================================================================
-- gerador de código
--
-- Alfabeto sem 0/O/1/I/L: o código é ditado por voz e lido em print de WhatsApp.
-- 8 caracteres num alfabeto de 31 ≈ 40 bits, com validade de 7 dias e uso único.
-- gen_random_bytes em vez de random(): random() não é criptograficamente seguro.
-- ============================================================================

create extension if not exists pgcrypto;

create function gerar_codigo_convite()
returns text
language plpgsql
volatile
as $$
declare
  v_alfabeto constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_bytes bytea;
  v_codigo text;
  v_tentativa int := 0;
begin
  loop
    v_bytes := gen_random_bytes(8);
    v_codigo := '';
    for i in 0..7 loop
      -- 256 % 31 ≠ 0 dá um viés minúsculo (≈1,2%) pros primeiros 8 símbolos;
      -- irrelevante pra um código de uso único que vence em 7 dias.
      v_codigo := v_codigo || substr(v_alfabeto, 1 + (get_byte(v_bytes, i) % 31), 1);
    end loop;

    exit when not exists (select 1 from ledger_invites i where i.code = v_codigo);

    v_tentativa := v_tentativa + 1;
    if v_tentativa > 20 then
      raise exception 'Não consegui gerar um código livre.';
    end if;
  end loop;

  return v_codigo;
end;
$$;

-- ============================================================================
-- criar_orcamento
-- ============================================================================

create function criar_orcamento(p_uid uuid, p_nome text, p_apelido text default null)
returns uuid
language plpgsql
volatile
as $$
declare
  v_ledger uuid;
begin
  if coalesce(trim(p_nome), '') = '' then
    raise exception 'O orçamento precisa de um nome.';
  end if;

  insert into ledgers (nome) values (trim(p_nome))
  returning id into v_ledger;

  insert into ledger_members (ledger_id, user_id, apelido)
  values (v_ledger, p_uid, nullif(trim(coalesce(p_apelido, '')), ''));

  -- Categorias iniciais. Customizar categoria é tela que ninguém usa no primeiro
  -- mês; ter um conjunto decente na hora zero é o que faz o app ser usável já.
  insert into categories (ledger_id, nome, kind, emoji, ordem) values
    (v_ledger, 'Mercado',    'expense', '🛒', 10),
    (v_ledger, 'Comer fora', 'expense', '🍔', 20),
    (v_ledger, 'Transporte', 'expense', '🚌', 30),
    (v_ledger, 'Moradia',    'expense', '🏠', 40),
    (v_ledger, 'Contas',     'expense', '💡', 50),
    (v_ledger, 'Saúde',      'expense', '💊', 60),
    (v_ledger, 'Lazer',      'expense', '🎬', 70),
    (v_ledger, 'Compras',    'expense', '👕', 80),
    (v_ledger, 'Pet',        'expense', '🐾', 90),
    (v_ledger, 'Presentes',  'expense', '🎁', 100),
    (v_ledger, 'Outros',     'expense', '❓', 999),
    (v_ledger, 'Salário',    'income',  '💰', 10),
    (v_ledger, 'Extra',      'income',  '✨', 20);

  return v_ledger;
end;
$$;

-- ============================================================================
-- criar_convite — a API já conferiu que p_uid é membro (middleware), mas a
-- função confere de novo: é barato e não depende de quem chama lembrar.
-- ============================================================================

create function criar_convite(p_uid uuid, p_ledger_id uuid)
returns text
language plpgsql
volatile
as $$
declare
  v_codigo text;
begin
  if not exists (
    select 1 from ledger_members m
    where m.ledger_id = p_ledger_id and m.user_id = p_uid
  ) then
    raise exception 'Você não participa deste orçamento.';
  end if;

  v_codigo := gerar_codigo_convite();

  insert into ledger_invites (code, ledger_id, criado_por)
  values (v_codigo, p_ledger_id, p_uid);

  return v_codigo;
end;
$$;

-- ============================================================================
-- aceitar_convite — chamado por quem AINDA NÃO é membro
-- ============================================================================

create function aceitar_convite(p_uid uuid, p_codigo text)
returns uuid
language plpgsql
volatile
as $$
declare
  v_convite ledger_invites%rowtype;
  v_limpo   text;
begin
  -- aceita 'abcd-1234', 'ABCD 1234', 'abcd1234' — o código é digitado a partir
  -- de um print ou de alguém ditando, então normalizar aqui evita erro bobo.
  v_limpo := upper(regexp_replace(coalesce(p_codigo, ''), '[^a-zA-Z0-9]', '', 'g'));

  -- for update: dois aceites simultâneos do mesmo código não passam os dois.
  select * into v_convite
  from ledger_invites i
  where i.code = v_limpo
  for update;

  if not found then
    raise exception 'Código não existe.';
  end if;

  -- Idempotente de propósito: dois toques no mesmo botão são inevitáveis, e
  -- "você já está neste orçamento" não é erro nenhum do ponto de vista de quem usa.
  if exists (
    select 1 from ledger_members m
    where m.ledger_id = v_convite.ledger_id and m.user_id = p_uid
  ) then
    return v_convite.ledger_id;
  end if;

  if v_convite.used_at is not null then
    raise exception 'Este código já foi usado.';
  end if;
  if v_convite.expires_at <= now() then
    raise exception 'Este código venceu. Peça outro.';
  end if;

  insert into ledger_members (ledger_id, user_id)
  values (v_convite.ledger_id, p_uid);

  update ledger_invites
     set used_at = now(), used_by = p_uid
   where code = v_convite.code;

  return v_convite.ledger_id;
end;
$$;
