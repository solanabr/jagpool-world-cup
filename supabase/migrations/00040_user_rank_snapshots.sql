-- Position-change arrows on the leaderboard: store each user's rank at a
-- checkpoint, then show ▲/▼ (current vs snapshot) in the UI.
--
-- Operator flow: call `select public.snapshot_user_ranks();` RIGHT BEFORE
-- entering a round's results, then finalize the matches. The delta then shows
-- how everyone moved from that round.

create table if not exists public.user_rank_snapshots (
  user_id uuid primary key references public.users(id) on delete cascade,
  rank int not null,
  snapshot_at timestamptz not null default now()
);

alter table public.user_rank_snapshots enable row level security;

drop policy if exists user_rank_snapshots_public_select on public.user_rank_snapshots;
create policy user_rank_snapshots_public_select
  on public.user_rank_snapshots for select using (true);

-- Capture current global ranks (same ordering as get_user_leaderboard) into the
-- snapshot table. Returns the number of users snapshotted.
create or replace function public.snapshot_user_ranks()
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_count int;
begin
  insert into public.user_rank_snapshots (user_id, rank, snapshot_at)
  select user_id, rank, now()
  from (
    select u.id as user_id,
           row_number() over (
             order by coalesce(sum(s.points), 0) desc, u.username asc
           ) as rank
    from public.users u
    left join public.scores s on s.user_id = u.id
    where u.validator_locked_at is not null
    group by u.id, u.username
  ) r
  on conflict (user_id)
  do update set rank = excluded.rank, snapshot_at = excluded.snapshot_at;
  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

revoke execute on function public.snapshot_user_ranks() from public, anon, authenticated;
grant execute on function public.snapshot_user_ranks() to service_role;

-- get_user_leaderboard gains previous_rank (from the snapshot). Return type
-- changes, so drop+create; grants re-applied.
drop function if exists public.get_user_leaderboard(integer);

create function public.get_user_leaderboard(p_limit integer default 50)
returns table(
  user_id uuid,
  username text,
  x_avatar_url text,
  wallet_address text,
  validator_id uuid,
  validator_name text,
  validator_logo_url text,
  total_points bigint,
  score_events bigint,
  previous_rank int
)
language sql
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select
    u.id, u.username, u.x_avatar_url, u.wallet_address,
    u.validator_id, v.name, v.logo_url,
    coalesce(sum(s.points)::bigint, 0),
    count(s.id)::bigint,
    rs.rank
  from public.users u
  left join public.validators v on v.id = u.validator_id
  left join public.scores s on s.user_id = u.id
  left join public.user_rank_snapshots rs on rs.user_id = u.id
  where u.validator_locked_at is not null
  group by u.id, u.username, u.x_avatar_url, u.wallet_address,
           u.validator_id, v.name, v.logo_url, rs.rank
  order by coalesce(sum(s.points), 0) desc, u.username asc
  limit p_limit;
$function$;

grant execute on function public.get_user_leaderboard(integer) to anon, authenticated, service_role;

-- Baseline snapshot so the column is populated (deltas appear on the next round).
select public.snapshot_user_ranks();
