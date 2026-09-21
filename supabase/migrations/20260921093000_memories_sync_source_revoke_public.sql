-- ============================================================
-- memories_sync_source перестає бути публічною точкою входу.
-- ------------------------------------------------------------
-- ЩО ЗНАЙШОВ АУДИТ (docs/PORTAL_AUDIT_2026-09-20.md §3.1).
--
-- `public.memories_sync_source` — SECURITY DEFINER, і EXECUTE на ній мали
-- `PUBLIC`, `anon` та `authenticated`. Усередині немає ЖОДНОЇ перевірки
-- особи: ні `auth.uid()`, ні пари. Вона бере `p_author` звичайним
-- аргументом, вставляє рядок у `public.memories`, а на порожньому
-- `p_photo_url` натомість ВИДАЛЯЄ рядки з `public.memory_links`.
--
-- `anon`-ключ лежить у зібраному PWA — так і має бути, він публічний. Тож
-- будь-хто, хто відкрив сайт, мав усе потрібне, щоб звернутись до
-- `/rest/v1/rpc/memories_sync_source` і дописати або видалити щось у
-- спогадах пари.
--
-- ЦЕ НЕ ПОМИЛКА, ЯКУ ХТОСЬ ЗРОБИВ. Міграція, що створила функцію
-- (20260727140000_memories_sources.sql), не містить жодного `grant`.
-- EXECUTE для `PUBLIC` ставить сам PostgreSQL при `create function`, а
-- явні права `anon`/`authenticated` приходять із типових привілеїв
-- Supabase на схему `public`. Ніхто не відчиняв дверей — їх просто не
-- зачинили.
--
-- ЧОМУ ФУНКЦІЮ НЕ ЧІПАЄМО, А ЛИШЕ ПРАВА. Вона задумана як внутрішня: її
-- кличуть тригери `memories_from_map_pin` і `memories_from_gift_completion`
-- (і тільки вони — у `src/` та `supabase/functions/` немає жодного
-- виклику). Обидва тригери самі SECURITY DEFINER і належать `postgres`,
-- тож усередині них `current_user` = postgres, і право postgres лишається.
-- Тобто шлях «пін на карті → спогад» працює далі без змін.
--
-- `service_role` теж лишається навмисно: це повноважний серверний ключ,
-- який і так пише в `memories` напряму. Забрати в нього EXECUTE — нічого
-- не додати до безпеки й дати собі шанс зламати майбутню Edge-функцію.
-- ============================================================

begin;

-- Відмовитись, якщо світ не той, на який ця міграція розрахована. Краще
-- впасти голосно, ніж «успішно» не зробити нічого.
do $$
begin
  if to_regprocedure('public.memories_sync_source(text,date,text,integer,text,bigint)') is null then
    raise exception 'memories_sync_source_missing';
  end if;

  -- Якщо тригерів немає, значить функцію вже нікому кликати, і мовчазний
  -- revoke сховав би значно більшу зміну, ніж ця.
  if to_regprocedure('public.memories_from_map_pin()') is null
    or to_regprocedure('public.memories_from_gift_completion()') is null then
    raise exception 'memories_triggers_missing';
  end if;
end $$;

revoke execute on function
  public.memories_sync_source(text, date, text, integer, text, bigint)
  from public, anon, authenticated;

-- Перевірка на місці, а не в голові: після цього рядка жоден клієнтський
-- ключ не має мати права виклику, а власник тригерів — має.
do $$
declare
  fn oid := to_regprocedure('public.memories_sync_source(text,date,text,integer,text,bigint)');
begin
  if has_function_privilege('anon', fn, 'EXECUTE')
    or has_function_privilege('authenticated', fn, 'EXECUTE') then
    raise exception 'memories_sync_source_still_public';
  end if;

  if not has_function_privilege('postgres', fn, 'EXECUTE') then
    raise exception 'memories_sync_source_unreachable_for_triggers';
  end if;
end $$;

commit;
