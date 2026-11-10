-- ============================================================
-- Покупки: тихе додавання й одне сповіщення на партію (ADR-0262).
-- ------------------------------------------------------------
-- Власник, 2026-11-10: «можливість не надсилати сповіщення в телеграм у
-- самому модулі покупок» і «багато покупок через кому — одне повідомлення
-- списком, а не по одному».
--
--   notify     — false: вебхук `db-notify` мовчить і про додавання, і про
--                «куплено» цього рядка. Типово true — старі рядки, бот і
--                будь-який інший клієнт поводяться як раніше.
--   batch_id   — спільний для рядків одного вводу; null — товар сам по собі.
--   batch_size — скільки рядків у партії: лише коли всі видимі, рядок із
--                найбільшим id надсилає одне повідомлення списком.
--
-- Політики RLS рядкові й не змінюються: нові колонки пише той самий клієнт
-- своєї пари (couple_id за замовчуванням — current_couple_id()).
-- ============================================================
alter table public.shopping_items
  add column if not exists notify boolean not null default true,
  add column if not exists batch_id uuid,
  add column if not exists batch_size smallint;

alter table public.shopping_items
  drop constraint if exists shopping_items_batch_size_check;
alter table public.shopping_items
  add constraint shopping_items_batch_size_check
  check (batch_size is null or (batch_size >= 1 and batch_size <= 200));

create index if not exists shopping_items_batch_idx
  on public.shopping_items (couple_id, batch_id)
  where batch_id is not null;
