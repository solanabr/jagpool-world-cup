-- =====================================================================
-- Reward snapshot tables (Phase 5/6 deliverable — schema defined now)
-- + helper RPCs to fetch predictions for scoring orchestration.
-- =====================================================================

create type reward_snapshot_status as enum ('draft', 'finalized', 'paid');
create type payout_status_enum as enum ('pending', 'sent', 'confirmed', 'failed');

create table if not exists public.reward_snapshots (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  snapshotted_at timestamptz not null default now(),
  snapshotted_by uuid not null references public.users(id),
  status reward_snapshot_status not null default 'draft',
  notes text,
  unique (tournament_id, snapshotted_at)
);
alter table public.reward_snapshots enable row level security;
create policy reward_snapshots_public_select on public.reward_snapshots for select using (true);

create table if not exists public.reward_users (
  snapshot_id uuid not null references public.reward_snapshots(id) on delete cascade,
  rank int not null,
  user_id uuid not null references public.users(id),
  wallet_address text not null,
  username text not null,
  validator_id uuid references public.validators(id),
  validator_name text,
  total_points bigint not null,
  payout_amount numeric,
  payout_token_mint text,
  payout_tx_signature text,
  payout_status payout_status_enum not null default 'pending',
  primary key (snapshot_id, rank)
);
alter table public.reward_users enable row level security;
create policy reward_users_public_select on public.reward_users for select using (true);

create table if not exists public.reward_validators (
  snapshot_id uuid not null references public.reward_snapshots(id) on delete cascade,
  rank int not null,
  validator_id uuid not null references public.validators(id),
  vote_account text not null,
  validator_name text not null,
  total_points bigint not null,
  user_count int not null,
  delegation_amount_sol numeric,
  delegation_tx_signature text,
  delegation_status payout_status_enum not null default 'pending',
  primary key (snapshot_id, rank)
);
alter table public.reward_validators enable row level security;
create policy reward_validators_public_select on public.reward_validators for select using (true);

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
  left join public.scores s on s.user_id = u.id
  where u.validator_locked_at is not null
  group by u.id, u.wallet_address, u.username, u.validator_id, v.name
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
  left join public.scores s on s.user_id = u.id
  where v.is_active
  group by v.id, v.vote_account, v.name;

  insert into public.admin_audit_log (admin_user_id, action, target_table, target_id, changes)
  values (auth.uid(), 'create_reward_snapshot', 'reward_snapshots', v_snapshot.id,
    jsonb_build_object('tournament_id', p_tournament_id, 'top_n', p_top_users));

  return v_snapshot;
end;
$$;

revoke execute on function public.create_reward_snapshot(uuid, int, text) from public, anon;
grant execute on function public.create_reward_snapshot(uuid, int, text) to authenticated;

create or replace function public.get_group_predictions_for_scoring(
  p_tournament_id uuid,
  p_group_name text
)
returns table (
  id uuid,
  user_id uuid,
  advancing_team_1 text,
  advancing_team_2 text
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select id, user_id, advancing_team_1, advancing_team_2
  from public.group_predictions
  where tournament_id = p_tournament_id and group_name = p_group_name;
$$;

revoke execute on function public.get_group_predictions_for_scoring(uuid, text) from public, anon;
grant execute on function public.get_group_predictions_for_scoring(uuid, text) to authenticated;

create or replace function public.get_champion_predictions_for_scoring(
  p_tournament_id uuid
)
returns table (
  user_id uuid,
  team text
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select user_id, team
  from public.champion_predictions
  where tournament_id = p_tournament_id;
$$;

revoke execute on function public.get_champion_predictions_for_scoring(uuid) from public, anon;
grant execute on function public.get_champion_predictions_for_scoring(uuid) to authenticated;
