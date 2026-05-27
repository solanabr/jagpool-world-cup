-- =====================================================================
-- Codex audit critical fixes:
-- CR1: scoring upserts broken in prod — partial unique indexes can't be
--      inferred by ON CONFLICT (cols). Recreate as non-partial.
-- H1: scoring inside finalize_match for knockout (not just champion).
-- H2: reward snapshot must scope sums by tournament. Add scores.tournament_id.
-- H3: validate team names against canonical WC 2026 list inside RPCs.
-- H4: block placeholder match predictions (home_team / away_team NULL).
-- H5: enforce score-winner consistency in submit_match_prediction.
-- H6: drop ADMIN_WALLET_ALLOWLIST dual-path — single source of truth.
--     A bootstrap RPC seeds the first admin from the allowlist on first call.
-- M1: drop the inert insert/update prediction policies recreated by 00023.
-- =====================================================================

-- ---------------------------------------------------------------------
-- CR1 — non-partial unique indexes
-- NULL ≠ NULL in unique constraints, so (NULL, reason) rows still coexist,
-- but (uuid, reason) duplicates are still blocked. Semantics unchanged.
-- ---------------------------------------------------------------------
drop index if exists public.scores_match_pred_reason_uniq;
drop index if exists public.scores_group_pred_reason_uniq;
drop index if exists public.scores_champion_reason_uniq;

create unique index scores_match_pred_reason_uniq
  on public.scores (match_prediction_id, reason);
create unique index scores_group_pred_reason_uniq
  on public.scores (group_prediction_id, reason);
create unique index scores_champion_reason_uniq
  on public.scores (champion_prediction_user_id, reason);

-- ---------------------------------------------------------------------
-- H2 — tournament_id column + backfill
-- ---------------------------------------------------------------------
alter table public.scores
  add column if not exists tournament_id uuid references public.tournaments(id) on delete cascade;

-- Backfill from existing rows by joining through the relevant FK.
update public.scores s
set tournament_id = m.tournament_id
from public.matches m
where s.match_id = m.id
  and s.tournament_id is null;

update public.scores s
set tournament_id = gp.tournament_id
from public.group_predictions gp
where s.group_prediction_id = gp.id
  and s.tournament_id is null;

update public.scores s
set tournament_id = cp.tournament_id
from public.champion_predictions cp
where s.champion_prediction_user_id = cp.user_id
  and s.tournament_id is null;

-- New rows: enforce tournament_id is set going forward. We don't make it NOT NULL
-- yet because we want to handle any edge case rows; the writers all set it now.
create index if not exists scores_tournament_idx on public.scores (tournament_id);

-- ---------------------------------------------------------------------
-- H3 — canonical team list for validation
-- One row per (tournament, team, group). Group can be null for non-group teams
-- (would apply if we ever had teams outside the group stage).
-- ---------------------------------------------------------------------
create table if not exists public.tournament_teams (
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  team_name text not null,
  group_name text,
  primary key (tournament_id, team_name)
);
alter table public.tournament_teams enable row level security;
create policy tournament_teams_public_select on public.tournament_teams
  for select using (true);

-- Seed for the active tournament (idempotent via ON CONFLICT)
insert into public.tournament_teams (tournament_id, team_name, group_name)
select t.id, x.team_name, x.group_name
from public.tournaments t
cross join (values
  ('Mexico','A'), ('South Africa','A'), ('South Korea','A'), ('Czech Republic','A'),
  ('Canada','B'), ('Bosnia and Herzegovina','B'), ('Qatar','B'), ('Switzerland','B'),
  ('Brazil','C'), ('Morocco','C'), ('Haiti','C'), ('Scotland','C'),
  ('USA','D'), ('Paraguay','D'), ('Australia','D'), ('Turkey','D'),
  ('Germany','E'), ('Curaçao','E'), ('Ivory Coast','E'), ('Ecuador','E'),
  ('Netherlands','F'), ('Japan','F'), ('Sweden','F'), ('Tunisia','F'),
  ('Belgium','G'), ('Egypt','G'), ('Iran','G'), ('New Zealand','G'),
  ('Spain','H'), ('Cape Verde','H'), ('Saudi Arabia','H'), ('Uruguay','H'),
  ('France','I'), ('Senegal','I'), ('Iraq','I'), ('Norway','I'),
  ('Austria','J'), ('Jordan','J'), ('Argentina','J'), ('Algeria','J'),
  ('Portugal','K'), ('DR Congo','K'), ('Uzbekistan','K'), ('Colombia','K'),
  ('England','L'), ('Croatia','L'), ('Ghana','L'), ('Panama','L')
) as x(team_name, group_name)
where t.is_active = true
on conflict (tournament_id, team_name) do nothing;

-- ---------------------------------------------------------------------
-- H3 + H4 + H5 — tightened submit_match_prediction
-- ---------------------------------------------------------------------
create or replace function public.submit_match_prediction(
  p_match_id uuid, p_winner text, p_home_score int default null, p_away_score int default null
)
returns public.match_predictions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pred public.match_predictions;
  v_match public.matches;
  v_user_locked timestamptz;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_winner not in ('home','away','draw') then raise exception 'invalid winner'; end if;

  select validator_locked_at into v_user_locked from public.users where id = auth.uid();
  if v_user_locked is null then raise exception 'must complete onboarding'; end if;

  select * into v_match from public.matches where id = p_match_id;
  if v_match.id is null then raise exception 'match not found'; end if;
  if v_match.locked_at is not null or now() >= v_match.kickoff_at then
    raise exception 'match prediction window is closed';
  end if;

  if v_match.stage = 'group' then
    raise exception 'group stage uses group_predictions, not match_predictions';
  end if;

  if p_winner = 'draw' then
    raise exception 'knockout matches cannot have draw predictions';
  end if;

  -- H4: placeholder matches (parent_match_* unresolved) have null teams.
  if v_match.home_team is null or v_match.away_team is null then
    raise exception 'cannot predict on placeholder match (teams not yet determined)';
  end if;

  -- H5: score-winner consistency (only when both scores provided).
  if p_home_score is not null and p_away_score is not null then
    if p_winner = 'home' and p_home_score <= p_away_score then
      raise exception 'home win requires home_score > away_score';
    end if;
    if p_winner = 'away' and p_away_score <= p_home_score then
      raise exception 'away win requires away_score > home_score';
    end if;
  end if;

  insert into public.match_predictions (user_id, match_id, winner, home_score, away_score)
  values (auth.uid(), p_match_id, p_winner, p_home_score, p_away_score)
  on conflict (user_id, match_id)
  do update set winner = excluded.winner, home_score = excluded.home_score, away_score = excluded.away_score, updated_at = now()
  returning * into v_pred;

  return v_pred;
end;
$$;

revoke execute on function public.submit_match_prediction(uuid, text, int, int) from public, anon;
grant execute on function public.submit_match_prediction(uuid, text, int, int) to authenticated;

-- ---------------------------------------------------------------------
-- H3 — submit_group_prediction validates teams against the group roster
-- ---------------------------------------------------------------------
create or replace function public.submit_group_prediction(
  p_tournament_id uuid, p_group_name text, p_team_1 text, p_team_2 text
)
returns public.group_predictions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pred public.group_predictions;
  v_lock_at timestamptz;
  v_user_locked timestamptz;
  v_team1_in_group boolean;
  v_team2_in_group boolean;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  select validator_locked_at into v_user_locked from public.users where id = auth.uid();
  if v_user_locked is null then raise exception 'must complete onboarding'; end if;

  select group_lock_at into v_lock_at from public.tournaments where id = p_tournament_id;
  if v_lock_at is not null and now() > v_lock_at then
    raise exception 'group predictions are locked';
  end if;

  if p_team_1 = p_team_2 then raise exception 'advancing teams must differ'; end if;

  -- H3: both teams must be in the group's roster for this tournament.
  select
    exists(select 1 from public.tournament_teams
            where tournament_id = p_tournament_id
              and team_name = p_team_1
              and group_name = p_group_name),
    exists(select 1 from public.tournament_teams
            where tournament_id = p_tournament_id
              and team_name = p_team_2
              and group_name = p_group_name)
  into v_team1_in_group, v_team2_in_group;

  if not v_team1_in_group then raise exception 'team_1 not in group %', p_group_name; end if;
  if not v_team2_in_group then raise exception 'team_2 not in group %', p_group_name; end if;

  insert into public.group_predictions (user_id, tournament_id, group_name, advancing_team_1, advancing_team_2)
  values (auth.uid(), p_tournament_id, p_group_name, p_team_1, p_team_2)
  on conflict (user_id, tournament_id, group_name)
  do update set advancing_team_1 = excluded.advancing_team_1,
                advancing_team_2 = excluded.advancing_team_2,
                updated_at = now()
  where not group_predictions.locked
  returning * into v_pred;

  if v_pred.user_id is null then raise exception 'group prediction already locked'; end if;
  return v_pred;
end;
$$;

revoke execute on function public.submit_group_prediction(uuid, text, text, text) from public, anon;
grant execute on function public.submit_group_prediction(uuid, text, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- H3 — submit_champion_prediction validates team is a real WC team
-- ---------------------------------------------------------------------
create or replace function public.submit_champion_prediction(
  p_tournament_id uuid, p_team text
)
returns public.champion_predictions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pred public.champion_predictions;
  v_lock_at timestamptz;
  v_user_locked timestamptz;
  v_valid boolean;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if length(trim(p_team)) = 0 then raise exception 'team cannot be empty'; end if;

  select validator_locked_at into v_user_locked from public.users where id = auth.uid();
  if v_user_locked is null then raise exception 'must complete onboarding'; end if;

  select group_lock_at into v_lock_at from public.tournaments where id = p_tournament_id;
  if v_lock_at is not null and now() > v_lock_at then
    raise exception 'champion predictions are locked';
  end if;

  -- H3: team must be in this tournament's roster.
  select exists(select 1 from public.tournament_teams
                 where tournament_id = p_tournament_id and team_name = p_team)
  into v_valid;
  if not v_valid then raise exception 'unknown team: %', p_team; end if;

  insert into public.champion_predictions (user_id, tournament_id, team)
  values (auth.uid(), p_tournament_id, p_team)
  on conflict (user_id, tournament_id) do update set
    team = excluded.team,
    submitted_at = now()
  where not champion_predictions.locked
  returning * into v_pred;

  if v_pred.user_id is null then raise exception 'champion prediction already locked'; end if;
  return v_pred;
end;
$$;

revoke execute on function public.submit_champion_prediction(uuid, text) from public, anon;
grant execute on function public.submit_champion_prediction(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- H2 — tournament-scoped reward snapshot aggregation
-- ---------------------------------------------------------------------
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
  group by v.id, v.vote_account, v.name;

  insert into public.admin_audit_log (admin_user_id, action, target_table, target_id, changes)
  values (auth.uid(), 'create_reward_snapshot', 'reward_snapshots', v_snapshot.id,
    jsonb_build_object('tournament_id', p_tournament_id, 'top_n', p_top_users));

  return v_snapshot;
end;
$$;

revoke execute on function public.create_reward_snapshot(uuid, int, text) from public, anon;
grant execute on function public.create_reward_snapshot(uuid, int, text) to authenticated;

-- ---------------------------------------------------------------------
-- M1 — drop the recreated insert/update policies (00023 added them back
-- but the underlying GRANTs were revoked in 00018, so they're inert and
-- confusing).
-- ---------------------------------------------------------------------
drop policy if exists group_predictions_self_insert on public.group_predictions;
drop policy if exists group_predictions_self_update on public.group_predictions;
drop policy if exists match_predictions_self_insert on public.match_predictions;
drop policy if exists match_predictions_self_update on public.match_predictions;
