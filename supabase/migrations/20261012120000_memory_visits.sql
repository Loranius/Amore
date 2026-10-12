-- ============================================================
-- ADR-0252: коли людина востаннє дивилась на нитку спогадів.
-- ------------------------------------------------------------
-- Нитка підсвічує спогади, які партнер склав після твого останнього
-- візиту (ADR-0251). Мітка візиту жила в `localStorage`, тож на другому
-- телефоні «нове» показувалось ще раз. Тепер вона тут — один рядок на
-- людину, і переглянуте на одному пристрої гасне на всіх.
--
-- Рядок свій і лише свій: партнерові не треба знати, коли ти заходив,
-- і писати чужу мітку він не може.
-- ============================================================

create table public.memory_visits (
  user_id    integer primary key references public.users(id) on delete cascade,
  couple_id  bigint not null default public.current_couple_id() references public.couples(id),
  seen_at    timestamptz not null default now()
);

create index memory_visits_couple_idx on public.memory_visits (couple_id);

alter table public.memory_visits enable row level security;

-- Той самий набір, що й на кожній таблиці пари (крок A): член порталу,
-- лише своя пара.
create policy auth_only on public.memory_visits for all to authenticated
  using ((select public.is_portal_member()))
  with check ((select public.is_portal_member()));
create policy couple_scope on public.memory_visits as restrictive for all to authenticated
  using (couple_id = (select public.current_couple_id()))
  with check (couple_id = (select public.current_couple_id()));
-- І лише власний рядок — і читати, і писати.
create policy own_row on public.memory_visits as restrictive for all to authenticated
  using (user_id = (select id from public.portal_me()))
  with check (user_id = (select id from public.portal_me()));

grant select, insert, update on public.memory_visits to authenticated;
