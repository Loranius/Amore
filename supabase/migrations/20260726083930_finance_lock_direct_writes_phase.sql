-- Phase 2: apply only after the RPC-based Finance client is deployed.
-- Direct writes would bypass server-side partner/state checks, so authenticated
-- clients keep read/realtime access and mutate only through Finance RPCs.

drop policy if exists auth_only on public.free_limit;
drop policy if exists auth_only on public.savings_goals;
drop policy if exists finance_read_authenticated on public.free_limit;
drop policy if exists finance_read_authenticated on public.savings_goals;

alter table public.free_limit enable row level security;
alter table public.savings_goals enable row level security;

create policy finance_read_authenticated
on public.free_limit
for select
to authenticated
using (true);

create policy finance_read_authenticated
on public.savings_goals
for select
to authenticated
using (true);

revoke insert, update, delete on public.free_limit from anon, authenticated;
revoke insert, update, delete on public.savings_goals from anon, authenticated;
grant select on public.free_limit to authenticated;
grant select on public.savings_goals to authenticated;
