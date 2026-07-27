-- ============================================================
-- «Спогади», етап 2: автоматичне наповнення з інших модулів.
-- ------------------------------------------------------------
-- Логіка в тригерах, а не в застосунку: запис повз UI (крон,
-- edge-функція, ручний SQL) інакше лишав би архів неповним, і розбіжність
-- виявилась би через місяці.
--
-- Домовленості, які тут закодовані:
--  • підпис і точність дати НІКОЛИ не перезаписуються тригером — їх міг
--    відредагувати власник в архіві;
--  • дата спогаду рухається за датою джерела (§15);
--  • видалення джерела знімає ЗВ'ЯЗОК, а не спогад (§16) — втратити фото
--    через видалення мітки неможливо.
-- ============================================================

/**
 * Прив'язати фото джерела до архіву (або відв'язати, якщо фото зникло).
 *
 * Ідемпотентна: повторний виклик із тими самими даними нічого не змінює,
 * тож тригер може спрацьовувати скільки завгодно разів.
 */
create or replace function public.memories_sync_source(
  p_photo_url text,
  p_date date,
  p_caption text,
  p_author integer,
  p_source_type text,
  p_source_id bigint
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_memory_id bigint;
begin
  -- Фото в джерелі більше немає: знімаємо зв'язок, спогад лишаємо.
  if p_photo_url is null or p_photo_url = '' then
    delete from public.memory_links
     where source_type = p_source_type and source_id = p_source_id;
    return;
  end if;

  insert into public.memories (photo_url, memory_date, date_precision, caption, uploaded_by)
  values (p_photo_url, coalesce(p_date, current_date), 'day', p_caption, p_author)
  on conflict (photo_key) do update
    -- Рухаємо лише дату (§15). Підпис не чіпаємо: він міг бути змінений
    -- у самому архіві, і тригер не має права затирати правку власника.
    set memory_date = excluded.memory_date
  returning id into v_memory_id;

  -- Фото джерела замінили: старий спогад лишається в архіві, але вже як
  -- доданий вручну — без зв'язку з міткою.
  delete from public.memory_links
   where source_type = p_source_type
     and source_id = p_source_id
     and memory_id <> v_memory_id;

  insert into public.memory_links (memory_id, source_type, source_id)
  values (v_memory_id, p_source_type, p_source_id)
  on conflict do nothing;
end;
$$;

-- ── Мітки карти ──────────────────────────────────────────────
create or replace function public.memories_from_map_pin()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.memories_sync_source(
    new.photo_url,
    coalesce(new.visited_at, new.created_at::date),
    new.title,
    new.created_by,
    'place',
    new.id
  );
  return null;
end;
$$;

drop trigger if exists map_pins_to_memories_ins on public.map_pins;
create trigger map_pins_to_memories_ins
  after insert on public.map_pins
  for each row execute function public.memories_from_map_pin();

-- Умова на UPDATE обов'язкова. Без неї будь-яка правка мітки (рейтинг,
-- відгук) пересинхронізовувала б спогад і скидала дату, яку власник міг
-- підправити в архіві вручну.
drop trigger if exists map_pins_to_memories_upd on public.map_pins;
create trigger map_pins_to_memories_upd
  after update on public.map_pins
  for each row
  when (old.photo_url is distinct from new.photo_url
     or old.visited_at is distinct from new.visited_at)
  execute function public.memories_from_map_pin();

create or replace function public.memories_unlink_map_pin()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Саме зв'язок, а не спогад: фото пари не має зникати разом із міткою.
  delete from public.memory_links where source_type = 'place' and source_id = old.id;
  return null;
end;
$$;

drop trigger if exists map_pins_unlink_memories on public.map_pins;
create trigger map_pins_unlink_memories
  after delete on public.map_pins
  for each row execute function public.memories_unlink_map_pin();

-- ── Виконані бажання ─────────────────────────────────────────
-- Зв'язок веде на БАЖАННЯ, а не на запис виконання: по позначці власник
-- хоче потрапити до бажання, а не до службового рядка.
create or replace function public.memories_from_gift_completion()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.memories_sync_source(
    new.reaction_photo,
    new.completed_at::date,
    new.comment,
    new.completed_by,
    'wish',
    new.wish_id
  );
  return null;
end;
$$;

drop trigger if exists gift_completions_to_memories_ins on public.wishlist_gift_completions;
create trigger gift_completions_to_memories_ins
  after insert on public.wishlist_gift_completions
  for each row execute function public.memories_from_gift_completion();

drop trigger if exists gift_completions_to_memories_upd on public.wishlist_gift_completions;
create trigger gift_completions_to_memories_upd
  after update on public.wishlist_gift_completions
  for each row
  when (old.reaction_photo is distinct from new.reaction_photo
     or old.completed_at is distinct from new.completed_at)
  execute function public.memories_from_gift_completion();

create or replace function public.memories_unlink_gift_completion()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.memory_links where source_type = 'wish' and source_id = old.wish_id;
  return null;
end;
$$;

drop trigger if exists gift_completions_unlink_memories on public.wishlist_gift_completions;
create trigger gift_completions_unlink_memories
  after delete on public.wishlist_gift_completions
  for each row execute function public.memories_unlink_gift_completion();
