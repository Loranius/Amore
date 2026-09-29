-- ============================================================
-- ADR-0230: нова пара — одним атомарним кроком.
-- ------------------------------------------------------------
-- Нова пошта (не прив'язана до жодного місця) створює НОВУ пару: рядок
-- `couples`, людину в `users`, членство в `couple_members` і дату початку
-- стосунків у `settings` пари. Чотири вставки мусять пройти разом:
-- людина без пари бачила б порожній портал із роллю anon (хук токена), а
-- пара без дати початку ламає попередній перегляд рифу. Тому це одна
-- функція, а не чотири запити Edge-функції.
--
-- Викликає лише `portal-account` із правами сервера: EXECUTE відкликано в
-- усіх клієнтських ролей. Пошта й auth-id беруться з перевіреного токена в
-- Edge-функції, а не з тіла запиту.
--
-- PIN більше не обов'язковий: вхід за PIN прибрано (ADR-0228), у нових
-- людей його немає й не буде. Старі хеші лишаються як були.
-- ============================================================

alter table public.users alter column pin_hash drop not null;

create or replace function public.create_couple_for(
  p_email text,
  p_auth_user_id uuid,
  p_name text,
  p_gender text,
  p_started_at date
)
returns table (user_id integer, couple_id bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(p_email));
  v_name text := trim(p_name);
  v_couple bigint;
  v_user integer;
begin
  if v_email is null or v_email = '' or p_auth_user_id is null then
    raise exception 'bad_identity' using errcode = '22023';
  end if;
  if v_name is null or char_length(v_name) < 1 or char_length(v_name) > 40 then
    raise exception 'bad_name' using errcode = '22023';
  end if;
  if p_gender is null or p_gender not in ('male', 'female') then
    raise exception 'bad_gender' using errcode = '22023';
  end if;
  if p_started_at is null or p_started_at < date '1950-01-01' or p_started_at > current_date then
    raise exception 'bad_started_at' using errcode = '22023';
  end if;

  -- Одна пошта — одна людина. Замок на пошті, щоб дві вкладки з однією
  -- поштою не створили дві пари.
  perform pg_advisory_xact_lock(hashtext('create_couple_for:' || v_email));
  if exists (select 1 from public.users u where lower(u.email) = v_email) then
    raise exception 'email_taken' using errcode = '23505';
  end if;

  insert into public.couples default values returning id into v_couple;

  insert into public.users (name, email, auth_user_id, gender)
  values (v_name, v_email, p_auth_user_id, p_gender)
  returning id into v_user;

  insert into public.couple_members (couple_id, user_id) values (v_couple, v_user);

  insert into public.settings (couple_id, key, value)
  values (v_couple, 'relationship_start_date', to_char(p_started_at, 'YYYY-MM-DD'));

  return query select v_user, v_couple;
end;
$$;

revoke all on function public.create_couple_for(text, uuid, text, text, date) from public, anon, authenticated;
grant execute on function public.create_couple_for(text, uuid, text, text, date) to service_role;
