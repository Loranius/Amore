-- Тиша у вихідний: rollback-only інтеграційний набір.
-- Двоє автентифікованих користувачів, уся тимчасова робота відкочується.
--
-- Перевіряється рівно те, заради чого міграція існує:
--   1. Явне 'Х' + увімкнене налаштування → сповіщення НЕ створюється.
--   2. Порожня клітинка — це НЕВІДОМО, а не вихідний: сповіщення йде.
--      Без цього нагадування «заповни графік» замкнуло б себе.
--   3. 'Р' → сповіщення йде.
--   4. Вимкнене налаштування → вихідний нічого не змінює.
--   5. RPC нагадування каже правду ('recipient_off_duty'), а не
--      'already_sent'.
--   6. Чуже налаштування не редагується.

begin;

create temporary table quiet_test_results (
  test_name text primary key
) on commit drop;

create temporary table quiet_test_users on commit drop as
select
  row_number() over (order by u.id)::integer as slot,
  u.id as app_user_id,
  u.email,
  au.id as auth_user_id
from public.users u
join auth.users au on lower(au.email) = lower(u.email)
where u.email is not null
order by u.id
limit 2;

grant select, insert on pg_temp.quiet_test_results to authenticated;
grant select on pg_temp.quiet_test_users to authenticated;

create or replace function pg_temp.qt_assert(p_name text, p_condition boolean)
returns void
language plpgsql
as $$
begin
  if not coalesce(p_condition, false) then
    raise exception 'quiet_test_failed:%', p_name;
  end if;
  insert into pg_temp.quiet_test_results(test_name) values (p_name);
end;
$$;

create or replace function pg_temp.qt_set_actor(p_slot integer)
returns void
language plpgsql
as $$
declare
  v_email text;
  v_auth_id uuid;
begin
  select email, auth_user_id into v_email, v_auth_id
  from pg_temp.quiet_test_users where slot = p_slot;
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_auth_id, 'email', v_email, 'role', 'authenticated')::text,
    true
  );
end;
$$;

/** Спроба покласти сповіщення партнерові; вертає, скільки рядків лягло. */
create or replace function pg_temp.qt_try_notify(p_recipient integer, p_actor integer, p_key text)
returns integer
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_before bigint;
  v_after bigint;
begin
  select count(*) into v_before from public.app_notifications where recipient_id = p_recipient;
  perform app_private.enqueue_app_notification(
    p_recipient, p_actor, 'wishlist_new_wish',
    'Тест', null, '/wishlist', null, p_key
  );
  select count(*) into v_after from public.app_notifications where recipient_id = p_recipient;
  return (v_after - v_before)::integer;
end;
$$;

select pg_temp.qt_assert(
  'two_auth_users_available',
  (select count(*) = 2 from pg_temp.quiet_test_users)
);

-- ── Підготовка: слот 2 просить тишу у вихідний ────────────────
select pg_temp.qt_set_actor(2);
insert into public.user_notification_prefs (user_id, quiet_on_days_off)
select app_user_id, true from pg_temp.quiet_test_users where slot = 2
on conflict (user_id) do update set quiet_on_days_off = true;

-- 2. Порожня клітинка — не вихідний.
delete from public.work_schedule
where user_id = (select app_user_id from pg_temp.quiet_test_users where slot = 2)
  and date = timezone('Europe/Kyiv', now())::date;

select pg_temp.qt_assert(
  'unmarked_day_is_not_a_day_off',
  pg_temp.qt_try_notify(
    (select app_user_id from pg_temp.quiet_test_users where slot = 2),
    (select app_user_id from pg_temp.quiet_test_users where slot = 1),
    'quiet-test:unmarked'
  ) = 1
);

-- 3. Робочий день — сповіщення йде.
insert into public.work_schedule (user_id, date, mark)
select app_user_id, timezone('Europe/Kyiv', now())::date, 'Р'
from pg_temp.quiet_test_users where slot = 2
on conflict (date, user_id) do update set mark = 'Р';

select pg_temp.qt_assert(
  'working_day_still_receives',
  pg_temp.qt_try_notify(
    (select app_user_id from pg_temp.quiet_test_users where slot = 2),
    (select app_user_id from pg_temp.quiet_test_users where slot = 1),
    'quiet-test:working'
  ) = 1
);

-- 1. Вихідний — сповіщення не створюється.
update public.work_schedule set mark = 'Х'
where user_id = (select app_user_id from pg_temp.quiet_test_users where slot = 2)
  and date = timezone('Europe/Kyiv', now())::date;

select pg_temp.qt_assert(
  'day_off_receives_nothing',
  pg_temp.qt_try_notify(
    (select app_user_id from pg_temp.quiet_test_users where slot = 2),
    (select app_user_id from pg_temp.quiet_test_users where slot = 1),
    'quiet-test:day-off'
  ) = 0
);

-- 4. Вимкнене налаштування — вихідний нічого не змінює.
update public.user_notification_prefs set quiet_on_days_off = false
where user_id = (select app_user_id from pg_temp.quiet_test_users where slot = 2);

select pg_temp.qt_assert(
  'setting_off_ignores_day_off',
  pg_temp.qt_try_notify(
    (select app_user_id from pg_temp.quiet_test_users where slot = 2),
    (select app_user_id from pg_temp.quiet_test_users where slot = 1),
    'quiet-test:setting-off'
  ) = 1
);

-- 5. RPC каже правду, а не 'already_sent'.
update public.user_notification_prefs set quiet_on_days_off = true
where user_id = (select app_user_id from pg_temp.quiet_test_users where slot = 2);

select pg_temp.qt_set_actor(1);
select pg_temp.qt_assert(
  'reminder_reports_off_duty',
  public.send_schedule_fill_reminder(
    (select app_user_id from pg_temp.quiet_test_users where slot = 2),
    to_char(timezone('Europe/Kyiv', now()), 'YYYY-MM')
  ) = 'recipient_off_duty'
);

-- 6. Чуже налаштування не редагується.
--
-- Помилки тут НЕ БУДЕ, і саме тому перевіряється значення, а не виняток:
-- RLS не кричить, вона просто не дає рядка, і `update` чесно міняє нуль
-- рядків. Тест, який чекав би винятку, впав би на робочій політиці.
update public.user_notification_prefs set quiet_on_days_off = false
where user_id = (select app_user_id from pg_temp.quiet_test_users where slot = 2);

select pg_temp.qt_assert(
  'cannot_write_partner_preference',
  (
    select quiet_on_days_off
    from public.user_notification_prefs
    where user_id = (select app_user_id from pg_temp.quiet_test_users where slot = 2)
  ) is true
);

select pg_temp.qt_assert(
  'all_quiet_tests_ran',
  (select count(*) = 7 from pg_temp.quiet_test_results)
);

rollback;
