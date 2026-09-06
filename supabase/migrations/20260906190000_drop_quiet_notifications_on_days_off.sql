-- ============================================================
-- «Тиша у вихідний» знімається — власник скасував налаштування.
-- ------------------------------------------------------------
-- «Прибери ось ці сповіщення "приходять завжди" в "тиша у вихідні",
-- взагалі видали це».
--
-- ЧОМУ ОКРЕМА МІГРАЦІЯ, А НЕ ВИДАЛЕНИЙ ФАЙЛ. Міграції — журнал, який
-- дописують, а не переписують: базу, на яку 20260904120000 уже лягла,
-- видалення файлу не змінить ніяк — таблиця, тригер і предикат лишились
-- би в ній назавжди, а репозиторій перестав би про них знати. Тому
-- скасування — теж крок уперед, і кожен `drop` тут із `if exists`: він
-- однаково правильний і тоді, коли попередня міграція не застосовувалась.
--
-- ПОРЯДОК ВАЖЛИВИЙ. `send_schedule_fill_reminder` спершу повертається до
-- редакції 20260727123000 (без гілки `recipient_off_duty`), і лише потім
-- зникає предикат, на який та гілка спиралась. Інакше між двома кроками
-- лишилась би функція, що кличе неіснуючу.
-- ============================================================

create or replace function public.send_schedule_fill_reminder(
  p_recipient_id integer,
  p_month text
)
returns text
language plpgsql
security definer
set search_path to 'public', 'app_private', 'pg_catalog'
as $function$
declare
  v_actor integer := app_private.current_app_user_id();
  v_couple bigint := app_private.current_couple_id();
  v_month_start date;
  v_month_end date;
  v_current_month date := date_trunc('month', timezone('Europe/Kyiv', now()))::date;
  v_today date := timezone('Europe/Kyiv', now())::date;
  v_required integer;
  v_filled integer;
  v_actor_name text;
  v_recipient_name text;
  v_dedupe_key text;
  v_notification_id bigint;
begin
  if v_actor is null or v_couple is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if p_recipient_id is null or p_recipient_id = v_actor then
    raise exception 'invalid_recipient' using errcode = '22023';
  end if;

  if not app_private.user_in_couple(p_recipient_id, v_couple) then
    raise exception 'partner_not_found' using errcode = '42501';
  end if;

  if p_month is null or p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then
    raise exception 'invalid_month' using errcode = '22023';
  end if;

  v_month_start := to_date(p_month || '-01', 'YYYY-MM-DD');
  v_month_end := (v_month_start + interval '1 month - 1 day')::date;

  if v_month_start < v_current_month then
    raise exception 'month_in_past' using errcode = '22023';
  end if;

  v_required := extract(day from v_month_end)::integer;

  select count(distinct ws.date)::integer
    into v_filled
  from public.work_schedule ws
  where ws.user_id = p_recipient_id
    and ws.date between v_month_start and v_month_end
    and ws.mark in ('Р', 'Х');

  if coalesce(v_filled, 0) >= v_required then
    return 'already_complete';
  end if;

  select u.name::text
    into v_actor_name
  from public.users u
  where u.id = v_actor;

  select u.name::text
    into v_recipient_name
  from public.users u
  where u.id = p_recipient_id;

  if v_recipient_name is null then
    raise exception 'partner_not_found' using errcode = 'P0002';
  end if;

  v_dedupe_key := format(
    'schedule:fill-reminder:%s:%s:%s:%s',
    v_actor,
    p_recipient_id,
    p_month,
    to_char(v_today, 'YYYY-MM-DD')
  );

  insert into public.app_notifications (
    recipient_id,
    actor_id,
    kind,
    title,
    body,
    href,
    entity_id,
    dedupe_key
  ) values (
    p_recipient_id,
    v_actor,
    'schedule_fill_reminder',
    'Заповни графік на місяць',
    coalesce(v_actor_name, 'Партнер') || ' просить додати робочі та вихідні дні.',
    '/calendar/schedule?month=' || p_month || '&edit=1',
    null,
    v_dedupe_key
  )
  on conflict (recipient_id, dedupe_key) do nothing
  returning id into v_notification_id;

  if v_notification_id is null then
    return 'already_sent';
  end if;

  return 'sent';
end;
$function$;

revoke all on function public.send_schedule_fill_reminder(integer, text) from public;
revoke all on function public.send_schedule_fill_reminder(integer, text) from anon;
grant execute on function public.send_schedule_fill_reminder(integer, text) to authenticated;
grant execute on function public.send_schedule_fill_reminder(integer, text) to service_role;

comment on function public.send_schedule_fill_reminder(integer, text)
  is 'Creates at most one schedule-fill reminder per actor, recipient, month and Kyiv calendar day.';

-- ── Тепер прибирається все, на що спиралась знята гілка ──────
drop trigger if exists app_notifications_quiet_on_days_off on public.app_notifications;
drop function if exists app_private.skip_notification_on_day_off();
drop function if exists app_private.notifications_muted_for(integer);
drop table if exists public.user_notification_prefs;
