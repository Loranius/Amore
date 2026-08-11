-- ============================================================
-- Заміна фото в бажанні більше не падає.
-- ------------------------------------------------------------
-- Симптом: «Не вдалося зберегти бажання» щоразу, коли до бажання з уже
-- обробленою картинкою чіпляли нове фото. Фото при цьому встигало
-- завантажитись у storage, а потім клієнт його прибирав як сироту — у логах
-- це видно як POST і DELETE того самого об'єкта з різницею у двісті
-- мілісекунд.
--
-- Причина. `update_wishlist_item_collaborative_v3` при зміні адреси картинки
-- обнуляє `image_mode` і `processed_image_url`, але не чіпає
-- `image_processing_status`. А обмеження `wishlist_items_image_processing_ready_check`
-- вимагає: `status <> 'ready' OR image_mode IS NOT NULL`. Тобто після ЦЬОГО
-- оператора рядок уже недійсний — і перевірка спрацьовує одразу, бо CHECK у
-- Postgres перевіряється по завершенню кожного оператора, а не транзакції.
-- Наступний оператор у v4, який ставить статус 'pending', до виконання просто
-- не доходить.
--
-- Помилка старша за симптом: обидві частини живуть від 24 липня, і виявитись
-- вона могла лише на бажанні, чия картинка встигла дообробитись до 'ready'.
--
-- Виміряно на живій базі (у транзакції з відкотом):
--   бажання 68 (status='ready', image_mode='product-cutout')
--   → [23514] violates check constraint "wishlist_items_image_processing_ready_check"
--
-- Виправлення там, де ламається інваріант: та сама команда, що знімає
-- `image_mode`, знімає і статус обробки. Так рядок не буває недійсним ані на
-- мить, і будь-який виклик v3 — не лише через v4 — лишається безпечним.
--
-- Друга правка, дрібніша й теж справжня: у v4-функціях перевірка
-- `v_preference not in (...)` не спрацьовувала на NULL (порівняння з NULL дає
-- NULL, а не true), і замість зрозумілої помилки `invalid_image_preference`
-- база кидала порушення NOT NULL. Тепер NULL відкидається явно.
-- ============================================================

create or replace function public.update_wishlist_item_collaborative_v3(
  p_wish_id bigint,
  p_expected_version bigint,
  p_title text,
  p_description text default null,
  p_link text default null,
  p_image_url text default null,
  p_price numeric default null,
  p_priority text default null
)
returns bigint
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_actor integer := app_private.current_app_user_id();
  v_couple_id bigint := app_private.current_couple_id();
  v_new_version bigint;
  v_status public.wishlist_status;
  v_is_shared boolean;
  v_image_url text := nullif(btrim(p_image_url), '');
begin
  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if v_couple_id is null then
    raise exception 'couple_membership_required' using errcode = '42501';
  end if;

  perform app_private.validate_wishlist_payload(
    p_title, p_description, p_link, p_image_url, p_price, p_priority
  );

  update public.wishlist_items wi
  set title = btrim(p_title),
      description = nullif(btrim(p_description), ''),
      link = nullif(btrim(p_link), ''),
      processed_image_url = case
        when wi.image_url is distinct from v_image_url then null
        else wi.processed_image_url
      end,
      image_mode = case
        when wi.image_url is distinct from v_image_url then null
        else wi.image_mode
      end,
      -- Стан обробки скидається тією ж командою, що й режим картинки.
      --
      -- Інакше рядок виходить із цього оператора недійсним: 'ready' без
      -- image_mode. 'idle' — навмисно найбезпечніший стан: він дійсний за
      -- будь-якого image_mode, а справжній цільовий стан ('pending') ставить
      -- одразу після цього v4, який єдиний знає про вподобання обробки.
      image_processing_status = case
        when wi.image_url is distinct from v_image_url then 'idle'
        else wi.image_processing_status
      end,
      -- Оренда обробника мусить піти разом зі статусом: 'idle' із живою
      -- сесією порушує wishlist_items_image_processing_lease_state_check.
      image_processing_session_id = case
        when wi.image_url is distinct from v_image_url then null
        else wi.image_processing_session_id
      end,
      image_processing_lease_expires_at = case
        when wi.image_url is distinct from v_image_url then null
        else wi.image_processing_lease_expires_at
      end,
      image_processing_error_code = case
        when wi.image_url is distinct from v_image_url then null
        else wi.image_processing_error_code
      end,
      image_url = v_image_url,
      price = p_price,
      priority = p_priority,
      version = wi.version + 1,
      updated_at = now()
  where wi.id = p_wish_id
    and wi.couple_id = v_couple_id
    and wi.status in ('visible', 'gifted', 'archived')
    and wi.deleted_at is null
    and wi.version = p_expected_version
  returning wi.version, wi.status, wi.is_shared
  into v_new_version, v_status, v_is_shared;

  if not found then
    if exists (
      select 1
      from public.wishlist_items wi
      where wi.id = p_wish_id
        and wi.couple_id = v_couple_id
        and wi.status in ('visible', 'gifted', 'archived')
        and wi.deleted_at is null
    ) then
      raise exception 'wish_version_conflict' using errcode = '40001';
    end if;
    raise exception 'wish_not_editable' using errcode = '42501';
  end if;

  insert into public.wishlist_history (
    wish_id,
    actor_id,
    event_type,
    from_status,
    to_status,
    metadata,
    is_private
  ) values (
    p_wish_id,
    v_actor,
    'wish_updated',
    v_status,
    v_status,
    jsonb_build_object(
      'version', v_new_version,
      'shared', v_is_shared,
      'collaborative', true,
      'completed', v_status in ('gifted', 'archived')
    ),
    false
  );

  return v_new_version;
end;
$$;

-- ── Порожнє вподобання: зрозуміла помилка замість порушення NOT NULL ──

create or replace function public.create_wishlist_item_idempotent_v4(
  p_request_id uuid,
  p_title text,
  p_owner_id integer,
  p_is_shared boolean default false,
  p_description text default null,
  p_link text default null,
  p_image_url text default null,
  p_price numeric default null,
  p_priority text default null,
  p_image_preference text default 'auto'
)
returns bigint
language plpgsql
security definer
set search_path = public, app_private, pg_catalog
as $$
declare
  v_actor integer := app_private.current_app_user_id();
  v_couple_id bigint := app_private.current_couple_id();
  v_id bigint;
  v_image_url text := nullif(btrim(p_image_url), '');
  v_preference text := case
    when nullif(btrim(p_image_url), '') is null then 'auto'
    else nullif(btrim(p_image_preference), '')
  end;
begin
  if v_actor is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if v_couple_id is null then raise exception 'couple_membership_required' using errcode = '42501'; end if;
  -- NULL перевіряється окремо: `null not in (...)` дає NULL, а не true, тож
  -- порожнє вподобання проходило повз цю перевірку й падало вже на NOT NULL.
  if v_preference is null
    or v_preference not in ('auto', 'product-cutout', 'portrait-cutout', 'photo-cover') then
    raise exception 'invalid_image_preference' using errcode = '22023';
  end if;

  v_id := public.create_wishlist_item_idempotent_v3(
    p_request_id,
    p_title,
    p_owner_id,
    p_is_shared,
    p_description,
    p_link,
    v_image_url,
    p_price,
    p_priority
  );

  update public.wishlist_items wi
  set image_preference = v_preference,
      image_processing_status = case
        when v_image_url is null then 'idle'
        when wi.image_preference is distinct from v_preference
          or wi.image_processing_status = 'idle' then 'pending'
        else wi.image_processing_status
      end,
      image_processor_version = case
        when v_image_url is null
          or wi.image_preference is distinct from v_preference
          or wi.image_processing_status = 'idle' then 0
        else wi.image_processor_version
      end,
      image_processing_target_version = case
        when v_image_url is null
          or wi.image_preference is distinct from v_preference
          or wi.image_processing_status = 'idle' then null
        else wi.image_processing_target_version
      end,
      image_processing_attempts = case
        when v_image_url is null
          or wi.image_preference is distinct from v_preference
          or wi.image_processing_status = 'idle' then 0
        else wi.image_processing_attempts
      end,
      image_processing_started_at = case
        when v_image_url is null
          or wi.image_preference is distinct from v_preference
          or wi.image_processing_status = 'idle' then null
        else wi.image_processing_started_at
      end,
      image_processing_completed_at = case
        when v_image_url is null
          or wi.image_preference is distinct from v_preference
          or wi.image_processing_status = 'idle' then null
        else wi.image_processing_completed_at
      end,
      image_processing_error_code = case
        when v_image_url is null
          or wi.image_preference is distinct from v_preference
          or wi.image_processing_status = 'idle' then null
        else wi.image_processing_error_code
      end,
      image_processing_session_id = case
        when v_image_url is null
          or wi.image_preference is distinct from v_preference
          or wi.image_processing_status = 'idle' then null
        else wi.image_processing_session_id
      end,
      image_processing_lease_expires_at = case
        when v_image_url is null
          or wi.image_preference is distinct from v_preference
          or wi.image_processing_status = 'idle' then null
        else wi.image_processing_lease_expires_at
      end
  where wi.id = v_id
    and wi.couple_id = v_couple_id
    and wi.created_by = v_actor
    and wi.image_preference in ('auto', v_preference);

  if not found then raise exception 'create_request_conflict' using errcode = '23505'; end if;
  return v_id;
end;
$$;

create or replace function public.update_wishlist_item_collaborative_v4(
  p_wish_id bigint,
  p_expected_version bigint,
  p_title text,
  p_description text default null,
  p_link text default null,
  p_image_url text default null,
  p_price numeric default null,
  p_priority text default null,
  p_image_preference text default 'auto'
)
returns bigint
language plpgsql
security definer
set search_path = public, app_private, pg_catalog
as $$
declare
  v_couple_id bigint := app_private.current_couple_id();
  v_new_version bigint;
  v_image_url text := nullif(btrim(p_image_url), '');
  v_preference text := case
    when nullif(btrim(p_image_url), '') is null then 'auto'
    else nullif(btrim(p_image_preference), '')
  end;
  v_old_image_url text;
  v_old_preference text;
  v_source_changed boolean;
  v_preference_changed boolean;
begin
  if v_couple_id is null then raise exception 'couple_membership_required' using errcode = '42501'; end if;
  if v_preference is null
    or v_preference not in ('auto', 'product-cutout', 'portrait-cutout', 'photo-cover') then
    raise exception 'invalid_image_preference' using errcode = '22023';
  end if;

  select wi.image_url, wi.image_preference
  into v_old_image_url, v_old_preference
  from public.wishlist_items wi
  where wi.id = p_wish_id
    and wi.couple_id = v_couple_id
    and wi.deleted_at is null;

  v_source_changed := v_old_image_url is distinct from v_image_url;
  v_preference_changed := v_old_preference is distinct from v_preference;

  v_new_version := public.update_wishlist_item_collaborative_v3(
    p_wish_id,
    p_expected_version,
    p_title,
    p_description,
    p_link,
    v_image_url,
    p_price,
    p_priority
  );

  update public.wishlist_items wi
  set processed_image_url = case
        when v_source_changed or v_preference_changed then null
        else wi.processed_image_url
      end,
      image_mode = case
        when v_source_changed or v_preference_changed then null
        else wi.image_mode
      end,
      image_processing_revision = case
        when v_source_changed or v_preference_changed then wi.image_processing_revision + 1
        else wi.image_processing_revision
      end,
      image_preference = v_preference,
      image_processing_status = case
        when v_image_url is null then 'idle'
        when v_source_changed or v_preference_changed then 'pending'
        else wi.image_processing_status
      end,
      image_processor_version = case
        when v_source_changed or v_preference_changed then 0
        else wi.image_processor_version
      end,
      image_processing_target_version = case
        when v_source_changed or v_preference_changed or v_image_url is null then null
        else wi.image_processing_target_version
      end,
      image_processing_attempts = case
        when v_source_changed or v_preference_changed or v_image_url is null then 0
        else wi.image_processing_attempts
      end,
      image_processing_started_at = case
        when v_source_changed or v_preference_changed or v_image_url is null then null
        else wi.image_processing_started_at
      end,
      image_processing_completed_at = case
        when v_source_changed or v_preference_changed or v_image_url is null then null
        else wi.image_processing_completed_at
      end,
      image_processing_error_code = case
        when v_source_changed or v_preference_changed or v_image_url is null then null
        else wi.image_processing_error_code
      end,
      image_processing_session_id = case
        when v_source_changed or v_preference_changed or v_image_url is null then null
        else wi.image_processing_session_id
      end,
      image_processing_lease_expires_at = case
        when v_source_changed or v_preference_changed or v_image_url is null then null
        else wi.image_processing_lease_expires_at
      end
  where wi.id = p_wish_id
    and wi.couple_id = v_couple_id;

  if not found then raise exception 'wish_not_editable' using errcode = '42501'; end if;
  return v_new_version;
end;
$$;
