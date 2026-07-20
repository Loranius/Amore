-- ============================================================
-- МІГРАЦІЯ: тригер dates → db-notify
-- ------------------------------------------------------------
-- Виконати ОДИН РАЗ вручну в Supabase SQL Editor (проєкт Amore,
-- yicalgoqegluzuagxssk). Не проганяти через apply_migration MCP —
-- містить вбудований service-role JWT, який класифікатор автономного
-- режиму блокує (той самий токен уже стоїть у тригерах savings_goals,
-- free_limit, wishlist_items, shopping_items, personal_wishes,
-- photo_calendar — тут просто той самий патерн для нової таблиці).
--
-- Таблиця public.dates уже створена (create_dates_table migration).
-- Цей тригер б'є в db-notify при INSERT (нова пропозиція побачення —
-- Telegram-повідомлення партнеру з кнопками ✅/❌) і UPDATE (зміна
-- статусу pending→confirmed, зокрема з сайту — сповістити пропонувальника).
-- ============================================================

create trigger dates
after insert or update on public.dates
for each row execute function supabase_functions.http_request(
  'https://yicalgoqegluzuagxssk.supabase.co/functions/v1/db-notify',
  'POST',
  '{"Content-type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpY2FsZ29xZWdsdXp1YWd4c3NrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTUwODQ1OCwiZXhwIjoyMDk3MDg0NDU4fQ.2NCSTL3GTKOwHL13uxbEPScxU43aqZdSLuZrcRLx1D8"}',
  '{}',
  '5000'
);
