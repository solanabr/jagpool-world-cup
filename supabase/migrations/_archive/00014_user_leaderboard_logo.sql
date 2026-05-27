-- Add validator_logo_url to user_leaderboard view so the UI can render the
-- user's chosen validator logo next to their ranking row.

drop view if exists public.user_leaderboard cascade;

create view public.user_leaderboard
with (security_invoker = true)
as
select
  u.id as user_id,
  u.username,
  u.wallet_address,
  u.validator_id,
  v.name as validator_name,
  v.logo_url as validator_logo_url,
  coalesce(sum(s.points), 0) as total_points,
  count(s.id) as score_events
from public.users u
left join public.validators v on v.id = u.validator_id
left join public.scores s on s.user_id = u.id
where u.validator_locked_at is not null
group by u.id, u.username, u.wallet_address, u.validator_id, v.name, v.logo_url;

grant select on public.user_leaderboard to anon, authenticated;
