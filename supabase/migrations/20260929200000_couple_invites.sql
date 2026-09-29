-- ============================================================
-- ADR-0232: код-запрошення партнера.
-- ------------------------------------------------------------
-- Нова пара (ADR-0230) починається з однієї людини. Друга приєднується
-- кодом, який перша створює в налаштуваннях і передає як захоче.
--
-- Код — 8 знаків з алфавіту без схожих (без 0/O, 1/I/L): 31^8 ≈ 8.5·10¹¹
-- варіантів. Одноразовий, живе 7 днів, у пари один активний: новий гасить
-- старий. Підбір стримує замок: 10 невдалих спроб за годину з одного
-- акаунта — відмова до кінця години.
--
-- Приєднання викликає лише `portal-account` із правами сервера; пошта й
-- auth-id — з перевіреного токена. Пара з двома людьми нового коду не дає і
-- за старим не приймає.
-- ============================================================

create table public.couple_invites (
  code        text primary key,
  couple_id   bigint not null references public.couples(id) on delete cascade,
  created_by  integer not null references public.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '7 days',
  used_at     timestamptz,
  used_by     integer references public.users(id) on delete set null,
  revoked_at  timestamptz
);

create index couple_invites_couple_idx on public.couple_invites (couple_id);

alter table public.couple_invites enable row level security;

-- Учасники бачать запрошення своєї пари; пишуть лише функції нижче.
create policy invites_own_couple on public.couple_invites for select to authenticated
  using (couple_id = (select public.current_couple_id()));

grant select on public.couple_invites to authenticated;

create table public.invite_attempts (
  auth_user_id uuid not null,
  attempted_at timestamptz not null default now()
);
create index invite_attempts_user_idx on public.invite_attempts (auth_user_id, attempted_at);
alter table public.invite_attempts enable row level security;
-- Жодної політики: таблицю бачить і пише лише власник функцій.

/** Новий код для пари того, хто кличе. */
create or replace function public.create_couple_invite()
returns table (code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_couple bigint := public.current_couple_id();
  v_user integer;
  v_code text;
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_bytes bytea;
begin
  if v_couple is null then
    raise exception 'not_member' using errcode = '42501';
  end if;
  if (select count(*) from public.couple_members m where m.couple_id = v_couple) >= 2 then
    raise exception 'couple_full' using errcode = '23514';
  end if;
  select u.id into v_user from public.users u
  where lower(u.email) = lower(coalesce(auth.jwt() ->> 'email', ''));

  update public.couple_invites i set revoked_at = now()
  where i.couple_id = v_couple and i.used_at is null and i.revoked_at is null;

  loop
    v_bytes := extensions.gen_random_bytes(8);
    v_code := '';
    for k in 0..7 loop
      v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, k) % 31) + 1, 1);
    end loop;
    exit when not exists (select 1 from public.couple_invites i where i.code = v_code);
  end loop;

  insert into public.couple_invites (code, couple_id, created_by)
  values (v_code, v_couple, v_user);

  return query select i.code, i.expires_at from public.couple_invites i where i.code = v_code;
end;
$$;

revoke all on function public.create_couple_invite() from public, anon;
grant execute on function public.create_couple_invite() to authenticated;

/** Приєднатися до пари за кодом. Лише сервер (`portal-account`). */
create or replace function public.join_couple_with_invite(
  p_email text,
  p_auth_user_id uuid,
  p_code text,
  p_name text,
  p_gender text
)
returns table (user_id integer, couple_id bigint, problem text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(p_email));
  v_name text := trim(p_name);
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  v_invite public.couple_invites%rowtype;
  v_user integer;
begin
  if v_email = '' or p_auth_user_id is null then
    raise exception 'bad_identity' using errcode = '22023';
  end if;
  if v_name is null or char_length(v_name) < 1 or char_length(v_name) > 40 then
    raise exception 'bad_name' using errcode = '22023';
  end if;
  if p_gender is null or p_gender not in ('male', 'female') then
    raise exception 'bad_gender' using errcode = '22023';
  end if;

  -- Замок від підбору — рахується ДО перевірки коду.
  if (select count(*) from public.invite_attempts a
      where a.auth_user_id = p_auth_user_id and a.attempted_at > now() - interval '1 hour') >= 10 then
    raise exception 'locked' using errcode = '54000';
  end if;

  perform pg_advisory_xact_lock(hashtext('join_couple:' || v_email));
  if exists (select 1 from public.users u where lower(u.email) = v_email) then
    raise exception 'email_taken' using errcode = '23505';
  end if;

  select * into v_invite from public.couple_invites i where i.code = v_code for update;
  if not found or v_invite.used_at is not null or v_invite.revoked_at is not null
     or v_invite.expires_at <= now() then
    -- Не `raise`: виняток відкотив би й цей запис, і замок ніколи б не
    -- спрацював. Невдала спроба — звичайна відповідь, що лишає слід.
    insert into public.invite_attempts (auth_user_id) values (p_auth_user_id);
    return query select null::integer, null::bigint, 'invite_invalid'::text;
    return;
  end if;
  if (select count(*) from public.couple_members m where m.couple_id = v_invite.couple_id) >= 2 then
    raise exception 'couple_full' using errcode = '23514';
  end if;

  insert into public.users (name, email, auth_user_id, gender)
  values (v_name, v_email, p_auth_user_id, p_gender)
  returning id into v_user;

  insert into public.couple_members (couple_id, user_id) values (v_invite.couple_id, v_user);

  update public.couple_invites i set used_at = now(), used_by = v_user where i.code = v_code;

  return query select v_user, v_invite.couple_id, null::text;
end;
$$;

revoke all on function public.join_couple_with_invite(text, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.join_couple_with_invite(text, uuid, text, text, text) to service_role;
