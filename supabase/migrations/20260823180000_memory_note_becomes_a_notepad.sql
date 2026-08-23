-- Нотатка спогаду перестає бути підписом і стає нотаткою.
--
-- Обмеження в 30 символів робило поле придатним лише для кількох слів, і
-- саме воно, а не розкладка, не давало композеру бути блокнотом: скільки
-- місця під текст не дай, писати в нього все одно нíчого.
--
-- 2000 — стільки ж, скільки вже дозволено опису фото
-- (`memory_photos.description`) у цій самій схемі, тож нового числа не
-- заводимо.
--
-- Застосовано на робочій базі Amore 2026-08-23 за прямим рішенням власника.
alter table public.memory_moments
  drop constraint if exists memory_moments_note_len;

alter table public.memory_moments
  add constraint memory_moments_note_len
  check (note is null or char_length(note) <= 2000);
