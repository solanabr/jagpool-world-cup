-- Validator leaderboard gains a "qualified" score alongside the raw total.
--
-- The validator ranking summed every player's points, which just rewards roster
-- size. The intended ranking is prize-based: a validator scores from how many of
-- its players land in the GLOBAL individual top 10, weighted by placement
-- (1st +5, 2nd +3, 3rd +2, 4th–10th +1). The frontend toggles between this
-- "Qualified" view (default) and the old "Total points" sum.
--
-- Return type changes (adds qualified_points, qualified_count), so this is
-- drop+create — which resets ACLs, so the grants are re-applied below.

drop function if exists public.get_validator_leaderboard();

create function public.get_validator_leaderboard()
returns table(
  validator_id uuid,
  name text,
  logo_url text,
  vote_account text,
  user_count bigint,
  total_points bigint,
  qualified_points bigint,
  qualified_count bigint
)
language sql
security definer
set search_path to 'public', 'pg_temp'
as $function$
  -- Rank every onboarded player globally (same order as get_user_leaderboard:
  -- points desc, username asc) so the "top 10" here matches the Players list.
  with player_totals as (
    select u.id as user_id, u.validator_id, u.username,
           coalesce(sum(s.points), 0) as pts
    from public.users u
    left join public.scores s on s.user_id = u.id
    where u.validator_locked_at is not null
    group by u.id, u.validator_id, u.username
  ),
  ranked as (
    select user_id, validator_id, pts,
           row_number() over (order by pts desc, username asc) as place
    from player_totals
  ),
  -- Prize-style points for a player landing in the global top 10.
  placement(place, place_pts) as (
    values (1, 5), (2, 3), (3, 2), (4, 1), (5, 1),
           (6, 1), (7, 1), (8, 1), (9, 1), (10, 1)
  ),
  validator_qualified as (
    select r.validator_id,
           sum(p.place_pts)::bigint as q_points,
           count(*)::bigint as q_count
    from ranked r
    join placement p on p.place = r.place
    where r.validator_id is not null
    group by r.validator_id
  )
  select
    v.id, v.name, v.logo_url, v.vote_account,
    count(distinct u.id)::bigint as user_count,
    coalesce(sum(s.points), 0)::bigint as total_points,
    coalesce(vq.q_points, 0) as qualified_points,
    coalesce(vq.q_count, 0) as qualified_count
  from public.validators v
  left join public.users u on u.validator_id = v.id and u.validator_locked_at is not null
  left join public.scores s on s.user_id = u.id
  left join validator_qualified vq on vq.validator_id = v.id
  where v.is_active
  group by v.id, v.name, v.logo_url, v.vote_account, vq.q_points, vq.q_count
  order by coalesce(vq.q_points, 0) desc, coalesce(sum(s.points), 0) desc, count(distinct u.id) desc;
$function$;

grant execute on function public.get_validator_leaderboard() to anon, authenticated, service_role;
