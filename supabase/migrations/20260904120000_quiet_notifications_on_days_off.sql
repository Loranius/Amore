-- ============================================================
-- Тиша у вихідний: сповіщення не приходять тому, хто сьогодні не працює.
-- ------------------------------------------------------------
-- Власник: «сповіщення приходитимуть тільки тим, хто на роботі; тим, хто
-- на вихідному, сповіщення не мають приходити».
--
-- ЧОМУ ЦЕ В БАЗІ, А НЕ В КЛІЄНТІ. `app_notifications` — єдине місце, крізь
-- яке проходять усі шість видів сповіщень, і в цьому репозиторії її НІХТО
-- НЕ ЧИТАЄ: екрана-інбокса немає, є лише запис і realtime-інвалідація
-- ключа, який нічого не тягне. Доставка живе поза репозиторієм (бот, на
-- який посилається `useSharedDaysOff`). Тому правило стоїть на створенні
-- рядка: що б рядок потім не читало, воно успадкує тишу.
--
-- ЯВНЕ «Х», А НЕ «НЕ 'Р'». Порожня клітинка — це НЕВІДОМО, а не вихідний,
-- і різниця тут не косметична: нагадування «заповни графік» іде саме тому,
-- у кого місяць порожній. Якби мовчання вмикала відсутність позначки,
-- функція замкнула б себе — немає позначок, отже «вихідний», отже не
-- нагадуємо, отже позначок не буде ніколи. Пара, яка не відкривала
-- «Графік», не помічає цієї міграції взагалі.
--
-- ЗА ЗАМОВЧУВАННЯМ ВИМКНЕНО. Налаштування, яке міняє поведінку до того,
-- як його хтось торкнувся, — це не налаштування, а сюрприз.
-- ============================================================

create table if not exists public.user_notification_prefs (
  user_id integer primary key references public.users(id) on delete cascade,
  quiet_on_days_off boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.user_notification_prefs enable row level security;

-- Читати може будь-хто зі своєї пари: екран показує відправникові, чому
-- нагадування не пішло, і для цього мусить бачити налаштування партнера.
drop policy if exists user_notification_prefs_couple_select on public.user_notification_prefs;
create policy user_notification_prefs_couple_select
on public.user_notification_prefs
for select
to authenticated
using (app_private.user_in_couple(user_id, app_private.current_couple_id()));

-- Писати — лише своє. Вимикати партнерові тишу не має права ніхто.
drop policy if exists user_notification_prefs_self_write on public.user_notification_prefs;
create policy user_notification_prefs_self_write
on public.user_notification_prefs
for all
to authenticated
using (user_id is not distinct from app_private.current_app_user_id())
with check (user_id is not distinct from app_private.current_app_user_id());

revoke all privileges on table public.user_notification_prefs from public, anon;
grant select, insert, update on table public.user_notification_prefs to authenticated;

-- ── Один предикат на дві ролі ────────────────────────────────
--
-- Він і забороняє (тригер), і пояснює (RPC нагадування). Якби це були дві
-- перевірки, вони розійшлись би першою ж правкою, і портал казав би одне,
-- а база робила інше.
create or replace function app_private.notifications_muted_for(p_user_id integer)
returns boolean
language sql
stable
security definer
set search_path = public, app_private, pg_catalog
as $$
  select exists (
    select 1
    from public.user_notification_prefs p
    join public.work_schedule ws
      on ws.user_id = p.user_id
     and ws.date = timezone('Europe/Kyiv', now())::date
    where p.user_id = p_user_id
      and p.quiet_on_days_off
      and ws.mark = 'Х'
  );
$$;

revoke all on function app_private.notifications_muted_for(integer) from public, anon;
grant execute on function app_private.notifications_muted_for(integer) to authenticated;

comment on function app_private.notifications_muted_for(integer)
  is 'True when the user asked for quiet days off and is explicitly marked Х for today in Kyiv.';

-- ── Заборона стоїть на таблиці, а не на кожному відправникові ──
create or replace function app_private.skip_notification_on_day_off()
returns trigger
language plpgsql
security definer
set search_path = public, app_private, pg_catalog
as $$
begin
  if app_private.notifications_muted_for(new.recipient_id) then
    return null;
  end if;
  return new;
end;
$$;

drop trigger if exists app_notifications_quiet_on_days_off on public.app_notifications;
create trigger app_notifications_quiet_on_days_off
  before insert on public.app_notifications
  for each row
  execute function app_private.skip_notification_on_day_off();

-- ── Нагадування про графік перестає брехати ──────────────────
--
-- БЕЗ ЦЬОГО КРОКУ ТРИГЕР ЗЛАМАВ БИ RPC. Вона вставляє рядок і читає
-- `returning id`; коли тригер повертає null, id теж null, і стара гілка
-- сказала б «сьогодні нагадування вже надсилалось» — неправда, і саме та
-- порода неправди, яку заборонено: мовчазний фолбек замість повідомлення
-- про справжню причину.
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

  -- Перевіряється ПЕРЕД вставкою, щоб відправник почув правду, а не
  -- «вже надсилалось». Правило те саме, що й у тригері, — та сама функція.
  if app_private.notifications_muted_for(p_recipient_id) then
    return 'recipient_off_duty';
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
  is 'Creates at most one schedule-fill reminder per actor, recipient, month and Kyiv calendar day; returns recipient_off_duty when the recipient asked for quiet days off and is marked Х today.';
