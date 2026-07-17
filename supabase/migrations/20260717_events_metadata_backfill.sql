-- ============================================================
-- МІГРАЦІЯ ДАНИХ: events.metadata (JSONB) — одноразово
-- ------------------------------------------------------------
-- Прибирає текстові теги [cat:…][status:…][doneAt:…] з
-- events.description і переносить їх у типізовану колонку
-- metadata (форма PlanMetadata із src/types). Стосується лише
-- планів (type = 'other'); інші події metadata не отримують (NULL).
--
-- Запустити ОДИН РАЗ у Supabase SQL Editor ПЕРЕД деплоєм React-версії.
-- Ідемпотентна: повторний запуск нічого не зламає (теги вже прибрані,
-- regexp просто не знайде збігів, а метадані перезапишуться тими самими).
-- ============================================================

-- 1) Колонка (як у типах — metadata: PlanMetadata | null).
alter table public.events
  add column if not exists metadata jsonb;

-- 2) Бекфіл планів: витягуємо теги у metadata, чистимо description.
update public.events
set
  metadata = jsonb_build_object(
    'cat',     coalesce(substring(description from '\[cat:(\w+)\]'),     'other'),
    'status',  coalesce(substring(description from '\[status:(\w+)\]'),  'planned'),
    'done_at', nullif(substring(description from '\[doneAt:([^\]]+)\]'), '')
  ),
  description = nullif(
    btrim(regexp_replace(description, '\[(cat|status|doneAt):[^\]]*\]', '', 'g')),
    ''
  )
where type = 'other';

-- 3) (Необов'язково) перевірка результату:
--   select id, title, description, metadata from public.events where type = 'other';
