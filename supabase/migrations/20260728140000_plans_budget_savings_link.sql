-- ============================================================
-- Етап 2: бюджет плану й зв'язок зі скарбничкою.
-- ------------------------------------------------------------
-- Питання «скільки це коштуватиме» і «скільки ми вже зібрали» досі
-- жили в різних кінцях застосунку: перше — ніде, друге — у спільних
-- цілях, які нічого не знали про плани. Через це «Вікенд у Карпатах»
-- і ціль «На Карпати» були двома незв'язаними записами, і подивитись,
-- чи вистачає грошей на конкретний план, було неможливо.
--
-- Два поля, а не нова таблиця: бюджет — це одне число плану, а зв'язок
-- «ціль належить плану» — один-до-багатьох. Окрема таблиця зв'язків
-- (як memory_links) тут була б зайвою: ціль не може належати двом
-- планам одночасно, бо гроші не діляться самі собою.
-- ============================================================

-- ── Бюджет плану ─────────────────────────────────────────────
-- Необов'язковий: більшість планів грошей не потребує, і змушувати
-- вписувати нуль означало б робити з кожної ідеї кошторис.
alter table public.plans
  add column if not exists budget numeric;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.plans'::regclass and conname = 'plans_budget_non_negative'
  ) then
    alter table public.plans
      add constraint plans_budget_non_negative check (budget is null or budget >= 0);
  end if;
end $$;

-- ── Ціль накопичення знає свій план ──────────────────────────
-- `on delete set null`, а не `cascade`: видалення плану не має стирати
-- історію внесків. Гроші зібрані реально, навіть якщо задум скасували
-- — ціль лишається у скарбничці, просто без плану.
alter table public.savings_goals
  add column if not exists plan_id bigint references public.plans(id) on delete set null;

create index if not exists savings_goals_plan_idx
  on public.savings_goals (plan_id) where plan_id is not null;

-- ── Прив'язка й відв'язка існуючої цілі ──────────────────────
-- Через RPC, як усі інші записи у savings_goals: прямі UPDATE для
-- authenticated відкликані ще в фазі finance_lock_direct_writes.
create or replace function public.finance_set_savings_goal_plan_v1(
  p_goal_id uuid,
  p_plan_id bigint
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_plan_id bigint;
begin
  perform public.finance_current_user_id_v1();

  -- Неіснуючий план мовчки перетворився б на «ціль без плану», і
  -- користувач вирішив би, що прив'язка спрацювала.
  if p_plan_id is not null and not exists (
    select 1 from public.plans where id = p_plan_id
  ) then
    raise exception 'finance_plan_not_found' using errcode = 'P0001';
  end if;

  -- За статусом НЕ фільтруємо. Дозволені і 'pending', і 'confirmed':
  -- ціль, створену для плану, партнер підтверджує вже ПІСЛЯ створення,
  -- і вимагати підтвердження до прив'язки означало б лишити щойно
  -- створену ціль без плану. Стану «відхилена» в таблиці не буває —
  -- finance_reject_savings_goal_v1 видаляє рядок, — тож інших живих
  -- станів просто немає.
  update public.savings_goals
     set plan_id = p_plan_id
   where id = p_goal_id
  returning plan_id into v_plan_id;

  if not found then
    raise exception 'finance_goal_not_found' using errcode = 'P0001';
  end if;

  return v_plan_id;
end;
$$;

-- ── Створення цілі одразу під план ───────────────────────────
-- Окрема версія, а не два виклики поспіль: між create і set існувало б
-- вікно, у якому ціль уже видно обом партнерам, але вона ще нічия. На
-- грошах із підтвердженням партнера таке вікно — джерело питання «а це
-- взагалі на що?».
create or replace function public.finance_create_savings_goal_v3(
  p_name text,
  p_description text default null,
  p_target_amount numeric default null,
  p_url text default null,
  p_desired_date date default null,
  p_plan_id bigint default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_name text := public.finance_current_user_name_v1();
  v_goal_id uuid;
  v_title text := btrim(coalesce(p_name, ''));
begin
  if v_title = '' then
    raise exception 'finance_goal_name_required' using errcode = '22023';
  end if;

  if p_target_amount is null or p_target_amount <= 0 then
    raise exception 'finance_goal_target_must_be_positive' using errcode = '22023';
  end if;

  if p_desired_date is not null and p_desired_date < current_date then
    raise exception 'finance_goal_desired_date_in_past' using errcode = '22023';
  end if;

  if p_plan_id is not null and not exists (
    select 1 from public.plans where id = p_plan_id
  ) then
    raise exception 'finance_plan_not_found' using errcode = 'P0001';
  end if;

  insert into public.savings_goals (
    name, description, target_amount, url, desired_date,
    status, proposed_by, saved_amount, plan_id
  )
  values (
    v_title,
    nullif(btrim(coalesce(p_description, '')), ''),
    p_target_amount,
    nullif(btrim(coalesce(p_url, '')), ''),
    p_desired_date,
    'pending',
    v_name,
    0,
    p_plan_id
  )
  returning id into v_goal_id;

  return v_goal_id;
end;
$$;

revoke all on function public.finance_set_savings_goal_plan_v1(uuid, bigint) from public, anon;
revoke all on function public.finance_create_savings_goal_v3(text, text, numeric, text, date, bigint) from public, anon;

grant execute on function public.finance_set_savings_goal_plan_v1(uuid, bigint) to authenticated;
grant execute on function public.finance_create_savings_goal_v3(text, text, numeric, text, date, bigint) to authenticated;
