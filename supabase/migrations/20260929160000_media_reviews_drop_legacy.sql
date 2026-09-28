-- ============================================================
-- ADR-0229: старі колонки відгуків `media_items.*_dima/*_lena` — геть.
-- ------------------------------------------------------------
-- Клієнт із `media_reviews` розгорнуто (Pages, a36c7ab). Звірка перед
-- кроком: 0 відгуків у старих колонках, яких немає або які відрізняються
-- в `media_reviews`. Перенесення повторено про всяк випадок — воно
-- ідемпотентне й не перезаписує новіших відгуків.
-- ============================================================

insert into public.media_reviews (media_id, user_id, rating, comment, couple_id)
select m.id, u.id, m.rating_dima, m.comment_dima, m.couple_id
from public.media_items m
join public.couple_members cm on cm.couple_id = m.couple_id
join public.users u on u.id = cm.user_id and u.gender = 'male'
where m.rating_dima is not null or m.comment_dima is not null
on conflict (media_id, user_id) do nothing;

insert into public.media_reviews (media_id, user_id, rating, comment, couple_id)
select m.id, u.id, m.rating_lena, m.comment_lena, m.couple_id
from public.media_items m
join public.couple_members cm on cm.couple_id = m.couple_id
join public.users u on u.id = cm.user_id and u.gender = 'female'
where m.rating_lena is not null or m.comment_lena is not null
on conflict (media_id, user_id) do nothing;

alter table public.media_items
  drop column rating_dima,
  drop column rating_lena,
  drop column comment_dima,
  drop column comment_lena;
