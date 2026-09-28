-- ============================================================
-- ADR-0229: відгуки на фільми — рядок на людину, а не колонка на ім'я.
-- ------------------------------------------------------------
-- `media_items.rating_dima/rating_lena/comment_dima/comment_lena` писали
-- схему під двох конкретних людей: для іншої пари в неї просто немає
-- колонок. Тепер відгук — рядок `(media_id, user_id)`; хто саме — видно
-- з `user_id`, а ім'я береться з `users`.
--
-- Старі колонки поки лишаються: клієнт, що вже відкритий у когось на
-- телефоні, ще пише в них. Їх прибере наступний крок, який перед тим
-- ще раз перенесе все, що встигло туди лягти (перенесення ідемпотентне).
-- ============================================================

create table public.media_reviews (
  media_id   integer not null references public.media_items(id) on delete cascade,
  user_id    integer not null references public.users(id) on delete cascade,
  rating     integer check (rating between 1 and 10),
  comment    text,
  couple_id  bigint not null default public.current_couple_id() references public.couples(id),
  updated_at timestamptz not null default now(),
  primary key (media_id, user_id)
);

create index media_reviews_couple_idx on public.media_reviews (couple_id);

alter table public.media_reviews enable row level security;

-- Той самий набір, що й на кожній таблиці пари (крок A): член порталу,
-- лише своя пара; і відгук — лише від людини своєї пари.
create policy auth_only on public.media_reviews for all to authenticated
  using ((select public.is_portal_member()))
  with check ((select public.is_portal_member()));
create policy couple_scope on public.media_reviews as restrictive for all to authenticated
  using (couple_id = (select public.current_couple_id()))
  with check (
    couple_id = (select public.current_couple_id())
    and user_id in (select public.current_couple_user_ids())
  );

grant select, insert, update, delete on public.media_reviews to authenticated;

-- Перенесення: колонки «dima»/«lena» існували лише в пари, що була в базі
-- до ADR-0229, і означали її чоловіка й жінку (`users.gender`).
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

-- Відгук партнера має з'являтися одразу, як і зміни самого вотчліста.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'media_reviews'
  ) then
    alter publication supabase_realtime add table public.media_reviews;
  end if;
end $$;
