-- ============================================================
-- Ізоляція по парах, крок A (ADR-0229): портал стає багатопарним.
-- ------------------------------------------------------------
-- До цієї міграції з 41 таблиці ознаку пари несла одна
-- (`wishlist_items.couple_id`); брама ADR-0228 відрізняла «члена пари» від
-- «незнайомця», але не пару від пари. Друга зареєстрована пара бачила б
-- спогади, плани й гроші першої.
--
-- Крок A — ДОДАВАЛЬНИЙ: після нього старий клієнт працює як працював.
--   1. `couple_id` на кожній таблиці даних; наявні рядки — пара, яка є
--      в базі зараз (Діма й Лєна); нові рядки отримують пару того, хто
--      пише (`default public.current_couple_id()`), тож клієнтові не треба
--      передавати її жодним запитом.
--   2. Унікальні ключі «на пару» ПОРУЧ зі старими глобальними. Старі
--      (settings.key, memory_days.memory_date, …) прибирає крок B після
--      того, як клієнт перейде на нові `onConflict`.
--   3. Обмежувальна (restrictive) політика на кожній таблиці: рядок лише
--      своєї пари. Вона накладається на наявні дозвільні, не переписуючи їх.
--   4. Роль `portal_rpc` без BYPASSRLS — власник security-definer функцій.
--      `postgres` у Supabase має BYPASSRLS, тож функції від його імені
--      бачили всі пари; від імені `portal_rpc` на них діють політики пари,
--      і 58 функцій не треба переписувати поодинці.
--   5. Сховище: нові файли кладуться під `c<пара>/…`; старі файли без
--      префікса належать наявній парі.
--
-- Тригери вимкнено на час заповнення `couple_id`: UPDATE інакше смикнув би
-- вебхуки db-notify і розіслав би в Telegram сповіщення про «зміни».
-- ============================================================

-- ── 0. Передумова: рівно одна пара ─────────────────────────
do $$
begin
  if (select count(*) from public.couples) <> 1 then
    raise exception 'couple isolation A: очікувалась рівно одна пара, знайдено %', (select count(*) from public.couples);
  end if;
end $$;

-- ── 1. Чия пара кличе ─────────────────────────────────────
create or replace function public.current_couple_id()
returns bigint
language sql
stable
security definer
set search_path = public, auth
as $$
  select cm.couple_id
  from public.couple_members cm
  join public.users u on u.id = cm.user_id
  where lower(u.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  limit 1;
$$;
revoke all on function public.current_couple_id() from public;
grant execute on function public.current_couple_id() to anon, authenticated;

-- «Хто я» тепер каже й пару: клієнт кладе файли під її префікс.
drop function if exists public.portal_me();
create function public.portal_me()
returns table (id integer, name text, couple_id bigint)
language sql
stable
security definer
set search_path = public, auth
as $$
  select u.id, u.name::text, cm.couple_id
  from public.users u
  join public.couple_members cm on cm.user_id = u.id
  where lower(u.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  limit 1;
$$;
revoke all on function public.portal_me() from public, anon;
grant execute on function public.portal_me() to authenticated;

-- ── 2. couple_id на кожній таблиці даних ──────────────────
do $$
declare
  legacy bigint := (select id from public.couples);
  t text;
  tables text[] := array[
    'app_notifications', 'daily_question_log', 'dates', 'dishes', 'events', 'free_limit',
    'location_history', 'map_pins', 'media_items', 'memories', 'memory_days', 'memory_links',
    'memory_moments', 'personal_wishes', 'photo_calendar', 'piggy_bank_balance', 'plan_links',
    'plan_tasks', 'plans', 'savings_goal_comments', 'savings_goal_contributions',
    'savings_goal_pauses', 'savings_goals', 'settings', 'shopping_items', 'swipe_sessions',
    'swipe_votes', 'time_capsules', 'user_locations', 'user_sizes', 'wishlist_gift_completions',
    'wishlist_history', 'wishlist_reservations', 'wishlist_storage_cleanup_runs', 'work_schedule'
  ];
begin
  foreach t in array tables loop
    execute format('alter table public.%I add column if not exists couple_id bigint', t);
    execute format('alter table public.%I disable trigger user', t);
    execute format('update public.%I set couple_id = %s where couple_id is null', t, legacy);
    execute format('alter table public.%I enable trigger user', t);
    execute format('alter table public.%I alter column couple_id set default public.current_couple_id()', t);
    execute format('alter table public.%I alter column couple_id set not null', t);
    if not exists (select 1 from pg_constraint where conname = t || '_couple_id_fkey') then
      execute format(
        'alter table public.%I add constraint %I foreign key (couple_id) references public.couples(id) on delete cascade',
        t, t || '_couple_id_fkey');
    end if;
    execute format('create index if not exists %I on public.%I (couple_id)', t || '_couple_idx', t);
  end loop;
end $$;

-- Вішліст уже мав пару; бракувало лише значення за замовчуванням.
alter table public.wishlist_items alter column couple_id set default public.current_couple_id();

-- ── 3. Унікальні ключі «на пару» (старі глобальні — у кроці B) ──
create unique index if not exists settings_couple_key_uidx on public.settings (couple_id, key);
create unique index if not exists memory_days_couple_date_uidx on public.memory_days (couple_id, memory_date);
create unique index if not exists daily_question_log_couple_date_uidx on public.daily_question_log (couple_id, date);
create unique index if not exists events_one_marriage_per_couple
  on public.events (couple_id, significance) where (significance = 'marriage'::event_significance);
create unique index if not exists events_one_relationship_start_per_couple
  on public.events (couple_id, significance) where (significance = 'relationship_start'::event_significance);

-- Скарбничка й вільний ліміт — «один рядок на пару», а не на портал.
-- Первинний ключ переходить з `id` (у кожної пари там 1) на `couple_id`:
-- інакше друга пара впала б на ключі ще до `on conflict (couple_id)`.
-- Ці таблиці пише лише сервер (функції нижче), тож старий клієнт не
-- помічає зміни.
alter table public.free_limit drop constraint if exists free_limit_pkey;
alter table public.free_limit add constraint free_limit_pkey primary key (couple_id);
alter table public.piggy_bank_balance drop constraint if exists piggy_bank_balance_pkey;
alter table public.piggy_bank_balance add constraint piggy_bank_balance_pkey primary key (couple_id);
drop index if exists public.free_limit_couple_uidx;
drop index if exists public.piggy_bank_balance_couple_uidx;
do $$
declare
  f record;
  src text;
begin
  for f in
    select p.oid, pg_get_functiondef(p.oid) as def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('finance_set_piggy_bank_balance_v1', 'finance_propose_free_limit_v1')
  loop
    src := replace(f.def, 'on conflict (id) do update', 'on conflict (couple_id) do update');
    if src = f.def then
      raise exception 'couple isolation A: у % не знайдено on conflict (id)', f.oid::regprocedure;
    end if;
    execute src;
  end loop;
end $$;

-- ── 4. Обмежувальна політика: лише своя пара ──────────────
do $$
declare
  t text;
begin
  for t in
    select c.relname
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attname = 'couple_id' and not a.attisdropped
    where n.nspname = 'public' and c.relkind = 'r' and c.relname <> 'couple_members'
  loop
    execute format('drop policy if exists couple_scope on public.%I', t);
    execute format(
      'create policy couple_scope on public.%I as restrictive for all to authenticated '
      || 'using (couple_id = (select public.current_couple_id())) '
      || 'with check (couple_id = (select public.current_couple_id()))', t);
  end loop;
end $$;

-- Імена: лише своєї пари. Список усіх імен для анонімів був потрібен екрану
-- входу за PIN, якого більше немає (ADR-0228).
drop policy if exists "anon select users" on public.users;
drop policy if exists users_same_couple on public.users;
create policy users_same_couple on public.users for select to authenticated
  using (id in (select cm.user_id from public.couple_members cm where cm.couple_id = (select public.current_couple_id())));

-- ── 5. Сховище: файл належить парі свого префікса ─────────
do $$
begin
  -- Файли, покладені до ADR-0229, — без префікса; усі вони наявної пари.
  execute format($fn$
    create or replace function public.storage_object_couple(object_name text)
    returns bigint
    language sql
    immutable
    as $body$
      select case
        when object_name ~ '^c[0-9]+/' then substring(object_name from '^c([0-9]+)/')::bigint
        else %s::bigint
      end;
    $body$;
  $fn$, (select id from public.couples));
end $$;
grant execute on function public.storage_object_couple(text) to anon, authenticated;

drop policy if exists storage_couple_scope on storage.objects;
create policy storage_couple_scope on storage.objects as restrictive for all to authenticated
  using (bucket_id = 'wishlist-memories' or public.storage_object_couple(name) = (select public.current_couple_id()))
  with check (bucket_id = 'wishlist-memories' or public.storage_object_couple(name) = (select public.current_couple_id()));

-- ── 6. portal_rpc: власник функцій, на якого діють політики пари ──
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'portal_rpc') then
    create role portal_rpc nologin noinherit nobypassrls;
  end if;
end $$;
grant portal_rpc to postgres;
grant usage on schema public to portal_rpc;
-- Власник функції мусить мати CREATE на її схему (ALTER FUNCTION … OWNER).
-- Роль без входу: створювати щось від її імені нікому.
grant create on schema public to portal_rpc;
grant usage on schema auth to portal_rpc;
grant usage on schema app_private to portal_rpc;
grant select, insert, update, delete on all tables in schema public to portal_rpc;
grant usage, select on all sequences in schema public to portal_rpc;
grant execute on all functions in schema public to portal_rpc;
grant execute on all functions in schema app_private to portal_rpc;

-- Дозвільні політики для portal_rpc: рядки своєї пари. Обмежувальна
-- `couple_scope` стоїть лише для authenticated, тож тут пара — сама умова.
do $$
declare
  t text;
begin
  for t in
    select c.relname
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attname = 'couple_id' and not a.attisdropped
    where n.nspname = 'public' and c.relkind = 'r'
  loop
    execute format('drop policy if exists rpc_couple on public.%I', t);
    execute format(
      'create policy rpc_couple on public.%I for all to portal_rpc '
      || 'using (couple_id = (select public.current_couple_id())) '
      || 'with check (couple_id = (select public.current_couple_id()))', t);
  end loop;
end $$;
drop policy if exists rpc_couple on public.users;
create policy rpc_couple on public.users for all to portal_rpc
  using (id in (select cm.user_id from public.couple_members cm where cm.couple_id = (select public.current_couple_id())));
drop policy if exists rpc_couple on public.couples;
create policy rpc_couple on public.couples for select to portal_rpc
  using (id = (select public.current_couple_id()));
drop policy if exists rpc_catalog on public.daily_questions;
create policy rpc_catalog on public.daily_questions for select to portal_rpc using (true);

-- Функції, які клієнт кличе, переходять до portal_rpc. Лишаються в
-- postgres: ті, що визначають саму пару й членство (їм треба бачити всі
-- пари), тригерні (пишуть за рядком, що їх збудив) і службові.
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and p.prokind = 'f'
      and p.prorettype <> 'trigger'::regtype
      and has_function_privilege('authenticated', p.oid, 'execute')
      and p.proname not in (
        'is_portal_member', 'current_couple_id', 'portal_me', 'storage_object_couple',
        'app_notification_recipient_allowed', 'wishlist_memory_read_allowed',
        'wishlist_memory_upload_allowed', 'wishlist_memory_delete_allowed'
      )
  loop
    execute format('alter function %s owner to portal_rpc', f.sig);
  end loop;
end $$;
