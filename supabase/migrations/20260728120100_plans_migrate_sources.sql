-- ============================================================
-- Перенесення планів із двох джерел у public.plans.
-- ------------------------------------------------------------
-- Джерела:
--   1. events із type='other' — вкладка «Плани» в календарі (3 рядки);
--   2. dates — «Заплановані побачення» в «Графіку» (1 рядок).
--
-- Рядки-джерела ТУТ НЕ ВИДАЛЯЮТЬСЯ. Спершу новий модуль має показати
-- все на живих даних; прибирання — окремий пізніший крок. Інакше
-- відкат коштував би даних, а не одного `drop table`.
--
-- Зіставлення категорій робилось по прочитаних рядках, а не наосліп:
-- у трьох планах трапились лише 'other' і 'date', і обидві мають точний
-- відповідник у новому наборі. Тому нічого не переінтерпретовано —
-- вибір власника збережений як є. ('dream' і 'goal' відповідників не
-- мають і в даних не трапились: мрія без дії — це бажання, ціль — це
-- накопичення; якби трапились, стали б 'other'.)
--
-- Статуси: planned → planning, active → preparing, done → done.
-- ============================================================

-- ── 1. Плани з календаря ─────────────────────────────────────
insert into public.plans (
  title, description, category, status,
  start_date, date_precision, completed_at, created_by, created_at
)
select
  e.title,
  e.description,
  case e.metadata->>'cat'
    when 'date' then 'date'
    when 'trip' then 'trip'
    else 'other'
  end,
  case e.metadata->>'status'
    when 'done'   then 'done'
    when 'active' then 'preparing'
    else 'planning'
  end,
  e.date,
  'day',
  (e.metadata->>'done_at')::timestamptz,
  e.created_by,
  now()
from public.events e
where e.type = 'other'
  -- Ідемпотентність: повторний запуск не подвоїть плани.
  and not exists (
    select 1 from public.plans p
    where p.title = e.title and p.start_date = e.date
  );

-- ── 2. Побачення з «Графіка» ─────────────────────────────────
-- dates.proposed_by зберігає ІМ'Я ('Діма'), а не id — тому зіставлення
-- через users. Якщо імені немає в таблиці, план усе одно переїде, лише
-- без автора: втратити побачення через незнайоме ім'я гірше.
insert into public.plans (
  title, description, category, status,
  start_date, start_time, date_precision, location_name, url,
  proposed_by, confirmed, created_by, created_at
)
select
  d.title,
  d.description,
  'date',
  'planning',
  d.date,
  d.time,
  'day',
  d.place,
  d.url,
  (select u.id from public.users u where u.name = d.proposed_by),
  d.status = 'confirmed',
  (select u.id from public.users u where u.name = d.proposed_by),
  d.created_at
from public.dates d
where not exists (
  select 1 from public.plans p
  where p.title = d.title and p.start_date = d.date
);
