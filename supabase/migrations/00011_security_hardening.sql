-- Security hardening from Supabase advisor findings:
-- 1. Recreate views with SECURITY INVOKER (was SECURITY DEFINER by default — ERROR-level lint)
-- 2. Pin search_path on set_updated_at (mutable search_path warning)
-- 3. Revoke RPC execute from anon/PUBLIC; only authenticated should call them

drop view if exists public.user_leaderboard cascade;
drop view if exists public.validator_leaderboard cascade;

create view public.user_leaderboard
with (security_invoker = true)
as
select
  u.id as user_id,
  u.username,
  u.wallet_address,
  u.validator_id,
  v.name as validator_name,
  coalesce(sum(s.points), 0) as total_points,
  count(s.id) as score_events
from public.users u
left join public.validators v on v.id = u.validator_id
left join public.scores s on s.user_id = u.id
where u.validator_locked_at is not null
group by u.id, u.username, u.wallet_address, u.validator_id, v.name;

create view public.validator_leaderboard
with (security_invoker = true)
as
select
  v.id as validator_id,
  v.name,
  v.logo_url,
  v.vote_account,
  count(distinct u.id) as user_count,
  coalesce(sum(s.points), 0) as total_points
from public.validators v
left join public.users u on u.validator_id = v.id and u.validator_locked_at is not null
left join public.scores s on s.user_id = u.id
where v.is_active
group by v.id, v.name, v.logo_url, v.vote_account;

grant select on public.user_leaderboard to anon, authenticated;
grant select on public.validator_leaderboard to anon, authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin new.updated_at = now(); return new; end;
$$;

revoke execute on function public.lock_validator(uuid) from public;
revoke execute on function public.lock_validator(uuid) from anon;
revoke execute on function public.submit_group_prediction(uuid, text, text, text) from public;
revoke execute on function public.submit_group_prediction(uuid, text, text, text) from anon;
revoke execute on function public.submit_match_prediction(uuid, text, int, int) from public;
revoke execute on function public.submit_match_prediction(uuid, text, int, int) from anon;
