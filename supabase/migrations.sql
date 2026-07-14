-- ============================================================
-- Amore — журнал міграцій Supabase (довідково; застосовуються вручну
-- через SQL Editor у Supabase Dashboard, автодеплою з цього репо немає).
-- Нові блоки додаються знизу в хронологічному порядку.
-- ============================================================

-- ------------------------------------------------------------
-- 2026-07-14: map_pins.city — групування місць на карті за містом
-- ------------------------------------------------------------
alter table public.map_pins add column if not exists city text;

-- ------------------------------------------------------------
-- 2026-07-14: rate-limit на невдалі спроби PIN (крок 1 з 2 фіксу
-- логіну — сама лише ця частина безпечна й нічого не ламає, бо
-- клієнт її ще не використовує).
-- ------------------------------------------------------------
create table public.pin_attempts (
  user_id integer primary key references public.users(id),
  fail_count integer not null default 0,
  locked_until timestamptz,
  last_attempt_at timestamptz not null default now()
);
alter table public.pin_attempts enable row level security;
-- Жодних policy: anon/authenticated не мають доступу зовсім.
-- service_role (використовується лише в Edge Function auth-pin) має
-- власний, окремий від RLS, default grant на всі таблиці/колонки —
-- тому працює без policy. Це НЕ BYPASSRLS (той стосується лише
-- рядкових policy) — то окремий механізм GRANT, важливо не плутати.

create or replace function public.register_pin_attempt(p_user_id integer, p_success boolean)
returns table(is_locked boolean, retry_after_seconds integer)
language plpgsql security definer set search_path = public as $$
declare
  v_row public.pin_attempts%rowtype;
begin
  insert into public.pin_attempts as pa (user_id) values (p_user_id)
    on conflict (user_id) do nothing;

  select * into v_row from public.pin_attempts where user_id = p_user_id for update;

  if v_row.locked_until is not null and v_row.locked_until > now() then
    return query select true, ceil(extract(epoch from (v_row.locked_until - now())))::int;
    return;
  end if;

  if p_success then
    update public.pin_attempts set fail_count = 0, locked_until = null, last_attempt_at = now()
      where user_id = p_user_id;
    return query select false, 0;
  else
    update public.pin_attempts set
      fail_count = v_row.fail_count + 1,
      locked_until = case when v_row.fail_count + 1 >= 5 then now() + interval '15 minutes' else null end,
      last_attempt_at = now()
      where user_id = p_user_id;
    return query select (v_row.fail_count + 1 >= 5), (case when v_row.fail_count + 1 >= 5 then 900 else 0 end);
  end if;
end;
$$;

-- ------------------------------------------------------------
-- КРОК 2 — застосовано. ВАЖЛИВО: колонковий revoke сам по собі не
-- спрацював — у anon/authenticated був табличний (не колонковий) grant
-- ALL на users (relacl: anon=arwdDxtm/postgres), а табличний SELECT
-- дає доступ до всіх колонок незалежно від колонкових revoke. Довелось
-- зняти табличний SELECT і видати назад лише на потрібні колонки:
revoke select on public.users from anon, authenticated;
grant select (id, name) on public.users to anon, authenticated;

-- Rollback, якщо щось піде не так:
-- grant select on public.users to anon, authenticated;

-- ------------------------------------------------------------
-- Побічна знахідка через get_advisors: SECURITY DEFINER функції за
-- замовчуванням отримують EXECUTE від PUBLIC (тому й register_pin_attempt
-- був викликаний напряму через /rest/v1/rpc/... будь-ким — це дозволило б
-- скинути собі лічильник блокування в обхід auth-pin). Закрито:
revoke execute on function public.register_pin_attempt(integer, boolean) from public, anon, authenticated;
-- Лишається виконуваною лише для service_role (використовується
-- виключно з Edge Function auth-pin).
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- 2026-07-14: pg_net — прибрати EXECUTE від PUBLIC (звідси й anon/
-- authenticated). extension_in_public (get_advisors) пропонує перенести
-- розширення в окрему схему, але pg_net має relocatable=false — ALTER
-- EXTENSION ... SET SCHEMA падає з "does not support SET SCHEMA".
-- DROP+CREATE ризикований (db-notify, ймовірно, лежить на pg_net під
-- капотом Database Webhooks). Реальна ціль лінтера — не дати anon/
-- authenticated самим викликати net.http_post/http_get (SSRF-вектор),
-- а не саму назву схеми. Робимо це напряму, без переносу розширення:
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'net'
  loop
    execute format('revoke execute on function %s from public', r.sig);
  end loop;
end $$;
-- Webhook-тригери (SECURITY DEFINER, власник — не PUBLIC) продовжують
-- працювати — це знімає лише неявний грант "усім".

-- ------------------------------------------------------------
-- 2026-07-14: СПРОБА звузити листинг у storage.objects — СКАСОВАНО,
-- не відтворювати без переробки шляхів завантаження фото.
--
-- Задум був: прибрати SELECT-policy для map-photos/media-posters/
-- photo-calendar/wishlist-photos (лишити тільки insert/update/delete),
-- бо клієнт ніколи не викликає .list() на них — лише upload/getPublicUrl
-- по відомому шляху. Мотив — wishlist-photos: без листингу власник
-- подарунка не зміг би підглянути фото заброньованого сюрпризу.
--
-- Зламало продакшн двічі: upload(..., {upsert:true}) в Supabase Storage
-- це `INSERT ... ON CONFLICT (bucket_id, name) DO UPDATE`, а Postgres RLS
-- для визначення "чи є конфлікт" перевіряє видимість наявного рядка саме
-- через SELECT-policy (не через UPDATE-policy, як здавалось логічним).
-- Без SELECT-policy будь-яке повторне завантаження на той самий шлях
-- (заміна фото існуючого піна/бажання) падало з "new row violates
-- row-level security policy".
--
-- Звузити SELECT так, щоб дозволити upsert-конфлікт-чек, але заборонити
-- .list(), не вийде без зміни коду: RLS policy фільтрує РЯДКИ за умовою
-- (bucket_id in (...)), а не залежить від того, як сформований запит —
-- та сама policy, що дозволяє перевірку одного відомого шляху, однаково
-- дозволить і повний листинг бакету. Щоб це розв'язати по-справжньому,
-- шлях завантаження фото мав би включати owner_id і policy звужувалась
-- би по ньому — окрема задача, що чіпає modules/*.js, а не лише SQL.
--
-- Відкачено назад до єдиної policy на всі бакети (як було до цього
-- пункту):
-- drop policy if exists family_photos_full on storage.objects;
-- drop policy if exists other_buckets_write on storage.objects;
-- drop policy if exists other_buckets_update on storage.objects;
-- drop policy if exists other_buckets_delete on storage.objects;
-- create policy auth_storage_full on storage.objects
--   for all to authenticated using (true) with check (true);
-- ------------------------------------------------------------
