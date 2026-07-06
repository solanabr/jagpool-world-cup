-- Correct the validator "qualified" score to the real jagSOL player prizes.
--
-- 00036 used a placeholder placement table (5/3/2/1). The actual prize structure
-- for the individual top 10 is, in jagSOL: 1st 8, 2nd 5, 3rd 3, 4th 2, 5th 1,
-- 6th-10th 0.5 each (total pool 21.5). A validator's qualified score is the sum
-- of its players' jagSOL prizes. The 0.5 tiers make this fractional, so
-- qualified_points changes from bigint to numeric — hence drop+create (grants
-- re-applied).

drop function if exists public.get_validator_leaderboard();

create function public.get_validator_leaderboard()
returns table(
  validator_id uuid,
  name text,
  logo_url text,
  vote_account text,
  user_count bigint,
  total_points bigint,
  qualified_points numeric,
  qualified_count bigint
)
language sql
security definer
set search_path to 'public', 'pg_temp'
as $function$
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
  -- jagSOL prize per finishing place in the global top 10.
  placement(place, prize) as (
    values (1, 8.0), (2, 5.0), (3, 3.0), (4, 2.0), (5, 1.0),
           (6, 0.5), (7, 0.5), (8, 0.5), (9, 0.5), (10, 0.5)
  ),
  validator_qualified as (
    select r.validator_id,
           sum(p.prize)::numeric as q_points,
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
    coalesce(vq.q_points, 0)::numeric as qualified_points,
    coalesce(vq.q_count, 0)::bigint as qualified_count
  from public.validators v
  left join public.users u on u.validator_id = v.id and u.validator_locked_at is not null
  left join public.scores s on s.user_id = u.id
  left join validator_qualified vq on vq.validator_id = v.id
  where v.is_active
  group by v.id, v.name, v.logo_url, v.vote_account, vq.q_points, vq.q_count
  order by coalesce(vq.q_points, 0) desc, coalesce(sum(s.points), 0) desc, count(distinct u.id) desc;
$function$;

grant execute on function public.get_validator_leaderboard() to anon, authenticated, service_role;
