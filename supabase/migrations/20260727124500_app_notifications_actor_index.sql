create index if not exists app_notifications_actor_id_idx
  on public.app_notifications(actor_id)
  where actor_id is not null;
