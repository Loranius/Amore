-- ============================================================
-- Етап 3: план знає, з чим він пов'язаний.
-- ------------------------------------------------------------
-- «Вікенд у Карпатах» майже ніколи не сам по собі: під нього є бажання
-- («лижі»), мітка на карті («Буковель») і — після поїздки — фото в
-- архіві. Досі ці зв'язки жили лише в голові, і зайти з плану до
-- потрібного бажання можна було тільки через пошук у чужому модулі.
--
-- Форма — дослівно за взірцем memory_links: (plan_id, target_type,
-- target_id) з ключем по всіх трьох. Причини ті самі:
--
--  • без окремої таблиці на кожен тип — типів буде більшати, а зв'язок
--    у всіх однаковий;
--  • без зовнішнього ключа на target_id — бажання, мітку чи спогад
--    можна видалити, і план від цього не мусить блокувати видалення
--    або зникати сам. Осиротілий рядок клієнт просто не показує: назву
--    для нього нема звідки взяти, тож він і не існує на екрані;
--  • «нема зв'язку» — це відсутність рядка, а не окремий стан, який
--    довелося б синхронізувати.
--
-- Списку покупок тут навмисно немає. «Додати до покупок» — це ДІЯ, а
-- не зв'язок: рядки йдуть у спільний список і живуть далі своїм життям
-- (їх купують, викреслюють, видаляють). Зберігати зв'язок означало б
-- обіцяти двосторонність, якої в покупок немає.
-- ============================================================

create table if not exists public.plan_links (
  plan_id     bigint not null references public.plans(id) on delete cascade,
  target_type text not null,
  target_id   bigint not null,
  created_at  timestamptz not null default now(),
  primary key (plan_id, target_type, target_id),
  constraint plan_links_target_known
    check (target_type in ('wish', 'place', 'memory'))
);

-- Зворотний пошук «до яких планів прив'язана ця мітка» — щоб модулі
-- могли колись показати зв'язок і зі свого боку.
create index if not exists plan_links_target_idx
  on public.plan_links (target_type, target_id);

-- ── RLS ──────────────────────────────────────────────────────
-- Як у самих планів: обоє партнерів бачать усі зв'язки. Таємниці тут
-- немає — сам план спільний, а бажання й мітки і так видно обом.
-- Секретність вішлиста стосується БРОНЮВАННЯ подарунка (хто що готує),
-- а не існування бажання, тож зв'язок нічого не видає.
alter table public.plan_links enable row level security;

drop policy if exists plan_links_authenticated on public.plan_links;
create policy plan_links_authenticated on public.plan_links
  for all to authenticated using (true) with check (true);

grant select, insert, update, delete on public.plan_links to authenticated;

-- Realtime: партнер має бачити прив'язку без перезавантаження.
-- `add table` не має форми `if not exists`, тому перевіряємо самі.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'plan_links'
  ) then
    alter publication supabase_realtime add table public.plan_links;
  end if;
end $$;
