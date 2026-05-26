-- Materialized aggregates for fast leaderboards
-- These are plain views, not materialized — refresh cost is negligible for our scale.

-- =====================================================================
-- USER LEADERBOARD — total points per user
-- =====================================================================
create view public.user_leaderboard as
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

-- =====================================================================
-- VALIDATOR LEADERBOARD — sum of points from users who locked this validator
-- =====================================================================
create view public.validator_leaderboard as
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
