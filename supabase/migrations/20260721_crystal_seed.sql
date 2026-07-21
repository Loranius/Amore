-- ============================================================
-- МІГРАЦІЯ: settings.crystal_seed — унікальна «генетика» Crystal Amore
-- ------------------------------------------------------------
-- Персистентний випадковий seed пари (формат AAAA-BBBB-CCCC).
-- Змішується в кожен PRNG-виклик геометрії кристала (crystalGeometry*.ts),
-- тому дві пари з ідентичними даними все одно матимуть різну форму.
-- Генерується ОДИН раз і більше ніколи не змінюється (ДНК кристала).
--
-- Вже застосована напряму на проді через Supabase MCP — цей файл лише
-- для реплею на інших середовищах (ідемпотентна: insert ... where not exists).
-- ============================================================
insert into public.settings (key, value)
select
  'crystal_seed',
  upper(
    substr(md5(gen_random_uuid()::text), 1, 4) || '-' ||
    substr(md5(gen_random_uuid()::text), 1, 4) || '-' ||
    substr(md5(gen_random_uuid()::text), 1, 4)
  )
where not exists (select 1 from public.settings where key = 'crystal_seed');
