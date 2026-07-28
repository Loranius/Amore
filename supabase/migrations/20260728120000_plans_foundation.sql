-- ============================================================
-- Модуль «Плани»: власні таблиці замість вкладки в календарі.
-- ------------------------------------------------------------
-- Досі спільні задуми пари жили рядками events із type='other' і JSONB
-- metadata {cat, status, done_at}. Три поля — це все, що та модель
-- уміла: ні завдань, ні періоду, ні місця, ні обкладинки. Плани при
-- цьому були видні лише у вигляді «Список» календаря й лише коли
-- активна відповідна вкладка.
--
-- Окрема таблиця, а не розширення events, ще й тому, що події та плани
-- відповідають на різні питання. Подія каже КОЛИ («4 січня — день
-- народження»), план каже ЩО РОБИМО і ЯК ГОТУЄМОСЬ. Календар
-- лишається місцем для першого й читатиме plans для другого — одним
-- джерелом, без дублювання рядків у events.
-- ============================================================

create table if not exists public.plans (
  id             bigint generated always as identity primary key,
  title          text not null,
  description    text,
  category       text not null default 'other',
  status         text not null default 'idea',
  cover_url      text,
  url            text,
  -- Неточні дати — та сама конвенція, що в «Спогадах»: start_date завжди
  -- зберігає ПОЧАТОК періоду («осінь 2026» → 2026-09-01), а precision
  -- каже, як це показати. Завдяки цьому одне сортування працює і для
  -- «12 серпня», і для «колись наступного року», без окремих гілок.
  start_date     date,
  end_date       date,
  start_time     time,
  date_precision text not null default 'none',
  location_name  text,
  -- Посилання на map_pins без зовнішнього ключа — так само, як
  -- memory_links.source_id: мітку можна видалити з карти, і план від
  -- цього не мусить зникати чи блокувати видалення.
  place_id       bigint,
  -- Побачення пропонує один партнер, підтверджує другий (механіка
  -- переїхала з таблиці dates). Звичайний план створюється вже
  -- підтвердженим, тому default true.
  proposed_by    integer references public.users(id),
  confirmed      boolean not null default true,
  created_by     integer references public.users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  completed_at   timestamptz,
  constraint plans_category_known check (category in (
    'date','trip','ride','place','event','activity','rest','holiday','learning','home','other'
  )),
  constraint plans_status_known check (status in (
    'idea','planning','preparing','ready','done','postponed','cancelled'
  )),
  constraint plans_precision_known check (date_precision in (
    'day','range','month','season','year','none'
  )),
  -- Період не може закінчуватись раніше, ніж почався.
  constraint plans_range_ordered check (
    end_date is null or start_date is null or end_date >= start_date
  ),
  -- Дата без точності — це дата, яку нема як показати; точність без
  -- дати — обіцянка, за якою нічого немає. Обидва стани заборонені.
  constraint plans_date_precision_agrees check (
    (start_date is null and date_precision = 'none')
    or (start_date is not null and date_precision <> 'none')
  )
);

create index if not exists plans_start_idx
  on public.plans (start_date) where start_date is not null;
create index if not exists plans_status_idx on public.plans (status);

-- ── Завдання підготовки ──────────────────────────────────────
create table if not exists public.plan_tasks (
  id          bigint generated always as identity primary key,
  plan_id     bigint not null references public.plans(id) on delete cascade,
  title       text not null,
  assigned_to integer references public.users(id),
  due_date    date,
  done        boolean not null default false,
  done_at     timestamptz,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  -- Виконане завдання мусить знати коли, невиконане — не мусить
  -- пам'ятати чужу дату.
  constraint plan_tasks_done_at_agrees check (
    (done and done_at is not null) or (not done and done_at is null)
  )
);

create index if not exists plan_tasks_plan_idx
  on public.plan_tasks (plan_id, sort_order, id);

-- ── RLS ──────────────────────────────────────────────────────
-- Як у безпосередніх сусідів (memories, map_pins, events): обоє
-- партнерів бачать усі плани. Вішлист ходить через SECURITY DEFINER
-- RPC, але там це заради таємниці ВСЕРЕДИНІ пари — не можна бачити
-- подарунок, призначений тобі. У планах такої таємниці немає: план на
-- те й спільний.
alter table public.plans enable row level security;
alter table public.plan_tasks enable row level security;

drop policy if exists plans_authenticated on public.plans;
create policy plans_authenticated on public.plans
  for all to authenticated using (true) with check (true);

drop policy if exists plan_tasks_authenticated on public.plan_tasks;
create policy plan_tasks_authenticated on public.plan_tasks
  for all to authenticated using (true) with check (true);

grant select, insert, update, delete
  on public.plans, public.plan_tasks
  to authenticated;

-- Realtime: обидва партнери мають бачити зміни одне одного без
-- перезавантаження — так само, як у подіях і мітках.
-- `add table` не має форми `if not exists`, тому перевіряємо самі:
-- повторний запуск міграції інакше впав би, а всі файли тут ідемпотентні.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'plans'
  ) then
    alter publication supabase_realtime add table public.plans;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'plan_tasks'
  ) then
    alter publication supabase_realtime add table public.plan_tasks;
  end if;
end $$;
