-- ============================================================
-- ADR-0229, крок B: старі глобальні ключі поступаються ключам пари.
-- ------------------------------------------------------------
-- Крок A поставив ключі «на пару» ПОРУЧ зі старими, щоб клієнт, який ще
-- писав `onConflict: 'key'`, не зламався посеред переходу. Тепер клієнт
-- і Edge-функції пишуть `couple_id,key` / `couple_id,memory_date`, і
-- старі ключі лишились єдиним, що не дає другій парі завести власне
-- налаштування, день спогадів, питання дня чи дату початку стосунків:
-- рядок пари 1 займав ключ для всіх.
--
-- Первинний ключ `settings` і `memory_days` не зникає, а стає ключем
-- пари: береться вже наявний унікальний індекс кроку A.
-- ============================================================

alter table public.settings drop constraint settings_pkey;
alter table public.settings add constraint settings_pkey primary key using index settings_couple_key_uidx;

alter table public.memory_days drop constraint memory_days_pkey;
alter table public.memory_days add constraint memory_days_pkey primary key using index memory_days_couple_date_uidx;

alter table public.daily_question_log drop constraint daily_question_log_date_key;

drop index public.events_one_marriage;
drop index public.events_one_relationship_start;
