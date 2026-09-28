-- ============================================================
-- Брама членства (ADR-0228) на мініатюрі схеми порталу.
-- Запуск: bash supabase/tests/run-membership-gate.sh
-- ------------------------------------------------------------
-- Відтворює ті самі діри, що стоять у живій базі (виміряно
-- pg_policies 2026-09-28): таблиця для будь-якого `authenticated`,
-- таблиця для `public` (dates), сховище для `authenticated`, імена
-- користувачів для всіх. Потім накладає міграцію й перевіряє:
-- член пари бачить усе, зареєстрований незнайомець — нічого.
-- ============================================================
\set ON_ERROR_STOP on

create role anon nologin;
create role authenticated nologin;
create role supabase_auth_admin nologin;
create schema auth;
create schema storage;
create function auth.jwt() returns jsonb language sql stable as
  $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create function auth.role() returns text language sql stable as $$ select auth.jwt() ->> 'role' $$;

create table public.users (id int primary key, name text, email text);
create table public.couple_members (couple_id int, user_id int references public.users(id));
create table public.memories (id int primary key, note text);
create table public.dates (id int primary key, title text);
create table storage.objects (id int primary key, bucket_id text, name text);
grant usage on schema public, storage to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema storage to anon, authenticated;

alter table public.users enable row level security;
alter table public.memories enable row level security;
alter table public.dates enable row level security;
alter table storage.objects enable row level security;
create policy "anon select users" on public.users for select to public using (true);
create policy memories_authenticated on public.memories for all to authenticated using (true) with check (true);
create policy auth_only on public.dates for all to public using (true) with check (true);
create policy shared_select on storage.objects for select to authenticated using (bucket_id = 'family_photos');
create policy shared_insert on storage.objects for insert to authenticated with check (bucket_id = 'family_photos');

create function public.finance_get_piggy_bank_v1() returns int language sql security definer as $$ select 42 $$;
grant execute on function public.finance_get_piggy_bank_v1() to anon, authenticated;

insert into public.users values (1, 'Діма', 'dima@example.com'), (2, 'Лєна', 'c1m2@portal.app');
insert into public.couple_members values (1, 1), (1, 2);
insert into public.memories values (1, 'перше побачення');
insert into public.dates values (1, 'річниця');
insert into storage.objects values (1, 'family_photos', 'a.jpg');

\i :migration
-- Повторний запуск не ламається й не дописує браму вдруге.
\i :migration

create function pg_temp.as_user(p_role text, p_email text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', p_role, 'email', p_email)::text, false);
  execute format('set role %I', p_role);
end $$;

do $$
declare n int;
begin
  -- Член пари бачить і пише все, як до міграції.
  perform pg_temp.as_user('authenticated', 'dima@example.com');
  select count(*) into n from public.memories; assert n = 1, 'член пари мусить бачити спогади';
  select count(*) into n from public.dates; assert n = 1, 'член пари мусить бачити дати';
  select count(*) into n from storage.objects; assert n = 1, 'член пари мусить бачити фото';
  insert into public.memories values (2, 'нове');
  select count(*) into n from public.portal_me(); assert n = 1, 'portal_me для члена';
  reset role;

  -- Незнайомець, що зареєструвався поштою: жодного рядка й жодного запису.
  perform pg_temp.as_user('authenticated', 'stranger@example.com');
  select count(*) into n from public.memories; assert n = 0, 'незнайомець не бачить спогадів';
  select count(*) into n from public.dates; assert n = 0, 'незнайомець не бачить дат';
  select count(*) into n from storage.objects; assert n = 0, 'незнайомець не бачить фото';
  select count(*) into n from public.portal_me(); assert n = 0, 'portal_me для незнайомця порожній';
  begin
    insert into public.memories values (3, 'чуже');
    raise exception 'незнайомець зміг записати спогад';
  exception when insufficient_privilege then null;
  end;
  reset role;

  -- Аноніми: дати більше не відкриті, скарбничка закрита, імена — так.
  perform pg_temp.as_user('anon', '');
  select count(*) into n from public.dates; assert n = 0, 'аноніми не бачать дат';
  select count(*) into n from public.users; assert n = 2, 'імена для старого входу лишаються';
  begin
    perform public.finance_get_piggy_bank_v1();
    raise exception 'аноніми досі кличуть скарбничку';
  exception when insufficient_privilege then null;
  end;
  reset role;
end $$;

-- Хук: член лишається authenticated, незнайомець стає anon.
do $$
declare out jsonb;
begin
  out := public.portal_access_token_hook('{"claims":{"role":"authenticated","email":"DIMA@example.com"}}');
  assert out #>> '{claims,role}' = 'authenticated', 'хук не мусить понижувати члена';
  out := public.portal_access_token_hook('{"claims":{"role":"authenticated","email":"stranger@example.com"}}');
  assert out #>> '{claims,role}' = 'anon', 'хук мусить понижувати незнайомця';
end $$;

select 'membership gate: ok' as result;
