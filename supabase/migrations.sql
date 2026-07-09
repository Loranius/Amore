-- ============================================================
-- Amore: міграція для Кулінарії (виконати в SQL Editor)
-- Безпечно запускати повторно.
-- ============================================================

-- 1. Колонка рецепта (без неї не зберігаються улюблені страви)
alter table dishes add column if not exists recipe jsonb;

-- 2. RLS-політики для dishes: обидва залогінені користувачі
--    можуть читати, додавати, редагувати і видаляти страви.
--    (Якщо політики з такими іменами вже є — спершу дропаються.)
drop policy if exists "dishes_select" on dishes;
drop policy if exists "dishes_insert" on dishes;
drop policy if exists "dishes_update" on dishes;
drop policy if exists "dishes_delete" on dishes;

create policy "dishes_select" on dishes
  for select to authenticated using (true);

create policy "dishes_insert" on dishes
  for insert to authenticated with check (true);

create policy "dishes_update" on dishes
  for update to authenticated using (true) with check (true);

create policy "dishes_delete" on dishes
  for delete to authenticated using (true);

-- 3. Прибирання залишків "Хто/Що"
drop table if exists randomizer_categories;

-- 4. Вимкнути дубльований крон daily-reminder:
--    спершу подивись назву джоба:
--      select jobid, jobname from cron.job;
--    потім (підстав свою назву):
--      select cron.unschedule('daily-reminder');
