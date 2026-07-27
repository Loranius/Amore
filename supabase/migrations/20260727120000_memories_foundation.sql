-- ============================================================
-- «Спогади» — центральний фотоархів пари. Етап 1: фундамент.
-- ------------------------------------------------------------
-- Замінює модель photo_calendar («одне фото на користувача на день» —
-- щоденна дуель партнерів) на архів, де дата є контейнером на будь-яку
-- кількість фото.
--
-- Атомарна одиниця — ФОТОГРАФІЯ, а не день: підпис, автор, час зйомки й
-- точність дати належать знімку, а не даті.
--
-- photo_calendar НЕ видаляється цією міграцією. Це страховка на час,
-- поки власник перевіряє архів на живих даних; її прибирання — окремий
-- пізніший крок.
-- ============================================================

-- ── Дата відвідання мітки ────────────────────────────────────
-- Її бракувало: map_pins знав лише created_at, тож мітка про відпочинок
-- 2019 року, додана сьогодні, лягла б у сьогоднішній день архіву.
alter table public.map_pins
  add column if not exists visited_at date;

update public.map_pins
   set visited_at = created_at::date
 where visited_at is null;

-- ── memories: фото в архіві ──────────────────────────────────
create table if not exists public.memories (
  id bigint generated always as identity primary key,

  -- Файл лишається там, де він уже лежить (map-photos, wishlist-memories,
  -- memories…). Архів ПОСИЛАЄТЬСЯ на нього й ніколи не копіює: один файл —
  -- кілька сутностей.
  photo_url text not null,

  -- Заповнені лише для файлів, які завантажив сам архів. Для чужих (мітка
  -- карти, реакція на подарунок) — null, і це навмисно: архів не має права
  -- видаляти файл, яким володіє інший модуль.
  storage_bucket text,
  storage_path text,

  -- Ключ дедуплікації. Обчислюється базою, а не застосунком: photo_url
  -- приходить із хвостом ?t=<timestamp> (cache-bust в usePhotoCalendar),
  -- і без відсікання той самий файл потрапив би в архів двічі.
  photo_key text generated always as (split_part(photo_url, '?', 1)) stored,

  -- Завжди ПОЧАТОК періоду: «травень 2024» → 2024-05-01. Тоді сортування
  -- однакове для точних і неточних дат, без окремих гілок.
  memory_date date not null,
  date_precision text not null default 'day',

  taken_at timestamptz,
  caption text,
  uploaded_by integer references public.users(id),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),

  constraint memories_precision_known
    check (date_precision in ('day', 'month', 'year', 'approx')),

  -- Дата мусить відповідати заявленій точності, інакше «травень 2024» міг
  -- би зберігатись як 2024-05-17 і показуватись то так, то так.
  constraint memories_date_matches_precision check (
    case date_precision
      when 'day' then true
      when 'month' then extract(day from memory_date) = 1
      else extract(day from memory_date) = 1 and extract(month from memory_date) = 1
    end
  ),

  constraint memories_caption_length
    check (caption is null or char_length(caption) <= 500)
);

create unique index if not exists memories_photo_key_idx
  on public.memories(photo_key);

create index if not exists memories_timeline_idx
  on public.memories(memory_date desc, sort_order, id);

-- ── memory_days: опис дня ────────────────────────────────────
create table if not exists public.memory_days (
  memory_date date primary key,
  description text,
  updated_by integer references public.users(id),
  updated_at timestamptz not null default now(),
  constraint memory_days_description_length
    check (description is null or char_length(description) <= 2000)
);

-- ── memory_links: один файл ↔ кілька сутностей ───────────────
-- «Вручну доданий» тут НЕ зберігається: спогад без жодного зв'язку і є
-- доданим вручну. Завдяки цьому «відв'язати від модуля» — це видалення
-- рядка звідси, а не окремий стан, який довелося б синхронізувати.
create table if not exists public.memory_links (
  memory_id bigint not null references public.memories(id) on delete cascade,
  source_type text not null,
  source_id bigint not null,
  created_at timestamptz not null default now(),
  primary key (memory_id, source_type, source_id),
  constraint memory_links_source_known
    check (source_type in ('wish', 'place', 'goal', 'event'))
);

create index if not exists memory_links_source_idx
  on public.memory_links(source_type, source_id);

-- ── RLS ──────────────────────────────────────────────────────
-- Як у безпосередніх сусідів (photo_calendar, map_pins): обоє партнерів
-- бачать увесь архів. Вішлист ходить через SECURITY DEFINER RPC, але там
-- це заради таємниці ВСЕРЕДИНІ пари — не можна бачити подарунок,
-- призначений тобі. В архіві такої таємниці немає.
alter table public.memories enable row level security;
alter table public.memory_days enable row level security;
alter table public.memory_links enable row level security;

drop policy if exists memories_authenticated on public.memories;
create policy memories_authenticated on public.memories
  for all to authenticated using (true) with check (true);

drop policy if exists memory_days_authenticated on public.memory_days;
create policy memory_days_authenticated on public.memory_days
  for all to authenticated using (true) with check (true);

drop policy if exists memory_links_authenticated on public.memory_links;
create policy memory_links_authenticated on public.memory_links
  for all to authenticated using (true) with check (true);

grant select, insert, update, delete
  on public.memories, public.memory_days, public.memory_links
  to authenticated;

-- ── Перенесення photo_calendar (23 рядки) ────────────────────
-- Автор і коментар зберігаються: це справжні спогади пари, а не тестові
-- дані. Дата точна — вона й була днем календаря.
insert into public.memories (photo_url, storage_bucket, memory_date, date_precision, caption, uploaded_by, created_at)
select pc.photo_url, 'photo-calendar', pc.date, 'day', pc.comment, pc.user_id, pc.created_at
  from public.photo_calendar pc
on conflict (photo_key) do nothing;

-- ── Бекфіл фото міток карти (26 рядків) ──────────────────────
-- Файл лишається в map-photos; storage_* порожні, бо власник файлу —
-- модуль карти.
with inserted as (
  insert into public.memories (photo_url, memory_date, date_precision, caption, uploaded_by, created_at)
  select mp.photo_url,
         coalesce(mp.visited_at, mp.created_at::date),
         'day',
         mp.title,
         mp.created_by,
         mp.created_at
    from public.map_pins mp
   where mp.photo_url is not null
  on conflict (photo_key) do nothing
  returning id, photo_key
)
insert into public.memory_links (memory_id, source_type, source_id)
select i.id, 'place', mp.id
  from inserted i
  join public.map_pins mp
    on split_part(mp.photo_url, '?', 1) = i.photo_key
on conflict do nothing;
