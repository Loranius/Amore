-- ============================================================
-- Брама членства (ADR-0228): вхід за поштою відкритий для всіх, дані —
-- лише для пари.
-- ------------------------------------------------------------
-- ЧОМУ. Власник відкриває реєстрацію за поштою «для всіх без винятків».
-- До цієї міграції майже кожна таблиця пускала БУДЬ-ЯКИЙ залогінений
-- акаунт (`to authenticated using (true)`), а `dates` — навіть анонімів
-- (`to public using (true)`); 24 security-definer RPC фінансів і вішліста
-- не питали, хто їх кличе. Тобто перший-ліпший, хто зареєструвався б
-- поштою, читав би й стирав спогади, фото, локації й гроші пари.
--
-- ДВА ЗАМКИ, БО ДІРИ ДВОХ ВИДІВ.
--   1) Політики. До кожної політики `public` і `storage` (крім імен
--      користувачів — їх читає екран старого входу за PIN) дописується
--      `public.is_portal_member()`. Ролі `public` звужуються до
--      `authenticated`.
--   2) Хук токена доступу. RPC з `security definer` обходять політики,
--      тож їх закриває роль: для акаунта, якого немає серед членів пари,
--      хук видає токен із роллю `anon`, і PostgREST виконує все від імені
--      аноніма, якому ці RPC не видані. Хук вмикає власник у панелі
--      Supabase (Authentication → Hooks → Custom Access Token →
--      `public.portal_access_token_hook`).
--
-- Дані пари не змінюються: міграція лише звужує, ХТО їх бачить. Члени
-- пари (users.email є в couple_members) бачать усе, як і раніше.
-- ============================================================

-- ── Хто член пари ───────────────────────────────────────────
create or replace function public.is_portal_member()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.couple_members cm
    join public.users u on u.id = cm.user_id
    where lower(u.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function public.is_portal_member() from public;
grant execute on function public.is_portal_member() to anon, authenticated;

-- ── Хто я: для відновлення сесії без довіри до localStorage ──
create or replace function public.portal_me()
returns table (id integer, name text)
language sql
stable
security definer
set search_path = public, auth
as $$
  select u.id, u.name::text
  from public.users u
  join public.couple_members cm on cm.user_id = u.id
  where lower(u.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  limit 1;
$$;

revoke all on function public.portal_me() from public, anon;
grant execute on function public.portal_me() to authenticated;

-- ── Замок 1: кожна політика вимагає членства ────────────────
do $$
declare
  p record;
  gate constant text := '(select public.is_portal_member())';
  sql text;
begin
  for p in
    select schemaname, tablename, policyname, cmd, roles, qual, with_check
    from pg_policies
    where schemaname in ('public', 'storage')
      -- Імена (без пошти й PIN — ці колонки закриті окремо) потрібні
      -- екрану старого входу, де Діма й Лєна обирають себе до входу.
      and not (schemaname = 'public' and tablename = 'users' and policyname = 'anon select users')
      -- Повторний запуск міграції не дописує брамy вдруге.
      and coalesce(qual, '') not like '%is_portal_member%'
      and coalesce(with_check, '') not like '%is_portal_member%'
  loop
    sql := format('alter policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    if 'public' = any (p.roles) then
      sql := sql || ' to authenticated';
    end if;
    if p.qual is not null then
      sql := sql || format(' using ((%s) and %s)', p.qual, gate);
    end if;
    if p.cmd in ('INSERT', 'UPDATE', 'ALL') then
      sql := sql || format(' with check ((%s) and %s)', coalesce(p.with_check, p.qual, 'true'), gate);
    end if;
    execute sql;
  end loop;
end $$;

-- ── Замок 2: не-член отримує токен аноніма ───────────────────
create or replace function public.portal_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  claims jsonb := event -> 'claims';
  member boolean;
begin
  if coalesce(claims ->> 'role', '') <> 'authenticated' then
    return event;
  end if;
  select exists (
    select 1
    from public.couple_members cm
    join public.users u on u.id = cm.user_id
    where lower(u.email) = lower(coalesce(claims ->> 'email', ''))
  ) into member;
  if not member then
    -- Акаунт живий (може підтвердити пошту, змінити пароль, прив'язати
    -- місце в парі через Edge-функцію), але до даних пари не торкається.
    claims := jsonb_set(claims, '{role}', '"anon"');
    event := jsonb_set(event, '{claims}', claims);
  end if;
  return event;
end;
$$;

revoke all on function public.portal_access_token_hook(jsonb) from public, anon, authenticated;
grant execute on function public.portal_access_token_hook(jsonb) to supabase_auth_admin;
grant usage on schema public to supabase_auth_admin;

-- ── Скарбничка була відкрита анонімам ───────────────────────
-- Дві функції скарбнички виконувались роллю `anon`, тобто будь-ким із
-- публічним ключем, без входу: читали й ПЕРЕПИСУВАЛИ баланс пари.
-- Після хука не-члени мають саме роль `anon`, тож закрити їх треба тут.
do $$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('finance_get_piggy_bank_v1', 'finance_set_piggy_bank_balance_v1')
  loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
