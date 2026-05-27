-- =====================================================================
-- Filter zero-point users + validators out of reward snapshots.
-- Previously, admin creating a snapshot with top_n=10 when only 3 users
-- had scored would fill the remaining 7 slots with zero-point users,
-- making them look like "winners". HAVING-clause filter excludes them.
-- Validators aggregate from users, so same filter applies.
-- =====================================================================

create or replace function public.create_reward_snapshot(
  p_tournament_id uuid,
  p_top_users int default 10,
  p_notes text default null
)
returns public.reward_snapshots
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_snapshot public.reward_snapshots;
  v_admin boolean;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select coalesce(is_admin, false) into v_admin from public.users where id = auth.uid();
  if not v_admin then raise exception 'forbidden: admin only'; end if;

  insert into public.reward_snapshots (tournament_id, snapshotted_by, notes)
  values (p_tournament_id, auth.uid(), p_notes)
  returning * into v_snapshot;

  insert into public.reward_users (
    snapshot_id, rank, user_id, wallet_address, username,
    validator_id, validator_name, total_points
  )
  select
    v_snapshot.id,
    row_number() over (order by coalesce(sum(s.points), 0) desc, u.username asc)::int,
    u.id, u.wallet_address, u.username, u.validator_id, v.name,
    coalesce(sum(s.points)::bigint, 0)
  from public.users u
  left join public.validators v on v.id = u.validator_id
  left join public.scores s on s.user_id = u.id and s.tournament_id = p_tournament_id
  where u.validator_locked_at is not null
  group by u.id, u.wallet_address, u.username, u.validator_id, v.name
  having coalesce(sum(s.points), 0) > 0
  order by coalesce(sum(s.points), 0) desc, u.username asc
  limit p_top_users;

  insert into public.reward_validators (
    snapshot_id, rank, validator_id, vote_account, validator_name,
    total_points, user_count
  )
  select
    v_snapshot.id,
    row_number() over (order by coalesce(sum(s.points), 0) desc, count(distinct u.id) desc)::int,
    v.id, v.vote_account, v.name,
    coalesce(sum(s.points)::bigint, 0),
    count(distinct u.id)::int
  from public.validators v
  left join public.users u on u.validator_id = v.id and u.validator_locked_at is not null
  left join public.scores s on s.user_id = u.id and s.tournament_id = p_tournament_id
  where v.is_active
  group by v.id, v.vote_account, v.name
  having coalesce(sum(s.points), 0) > 0;

  insert into public.admin_audit_log (admin_user_id, action, target_table, target_id, changes)
  values (auth.uid(), 'create_reward_snapshot', 'reward_snapshots', v_snapshot.id,
    jsonb_build_object('tournament_id', p_tournament_id, 'top_n', p_top_users));

  return v_snapshot;
end;
$$;

revoke execute on function public.create_reward_snapshot(uuid, int, text) from public, anon;
grant execute on function public.create_reward_snapshot(uuid, int, text) to authenticated;
