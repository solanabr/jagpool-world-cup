-- =====================================================================
-- TIER 2 FIXES (Codex audit)
-- 1. group_results table + set_group_advancers RPC (admin finalizes groups)
-- 2. champion_predictions table + submit_champion_prediction RPC
-- 3. finalize_match RPC (atomic admin match completion, validates invariants)
-- 4. submit_match_prediction: reject group-stage and reject draw for knockout
-- =====================================================================

-- group_results: admin marks who actually advanced from each group
create table if not exists public.group_results (
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  group_name text not null,
  first_place_team text not null,
  second_place_team text not null,
  finalized_at timestamptz not null default now(),
  finalized_by uuid not null references public.users(id),
  primary key (tournament_id, group_name),
  check (first_place_team <> second_place_team)
);
alter table public.group_results enable row level security;
create policy group_results_public_select on public.group_results for select using (true);

-- champion_predictions: each user picks one team to win the tournament
create table if not exists public.champion_predictions (
  user_id uuid not null references public.users(id) on delete cascade,
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  team text not null,
  submitted_at timestamptz not null default now(),
  locked boolean not null default false,
  primary key (user_id, tournament_id)
);
alter table public.champion_predictions enable row level security;
create policy champion_predictions_self_select on public.champion_predictions
  for select to authenticated using (auth.uid() = user_id);
-- No direct insert/update policy — writes go through submit_champion_prediction RPC

-- Add champion_prediction reference to scores so the scoring engine can attribute
alter table public.scores add column if not exists champion_prediction_user_id uuid;
create unique index if not exists scores_champion_reason_uniq
  on public.scores (champion_prediction_user_id, reason)
  where champion_prediction_user_id is not null;

-- finalize_match RPC — atomic admin action for completing a match
create or replace function public.finalize_match(
  p_match_id uuid,
  p_home_score int,
  p_away_score int,
  p_winner text
)
returns public.matches
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.matches;
  v_admin boolean;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  select coalesce(is_admin, false) into v_admin from public.users where id = auth.uid();
  if not v_admin then raise exception 'forbidden: admin only'; end if;

  if p_home_score < 0 or p_away_score < 0 or p_home_score > 99 or p_away_score > 99 then
    raise exception 'invalid score range';
  end if;

  if p_winner not in ('home', 'away', 'draw') then
    raise exception 'invalid winner value';
  end if;

  select * into v_match from public.matches where id = p_match_id;
  if v_match.id is null then raise exception 'match not found'; end if;

  if p_winner = 'home' and not (p_home_score > p_away_score) then
    raise exception 'winner=home but home_score <= away_score';
  end if;
  if p_winner = 'away' and not (p_away_score > p_home_score) then
    raise exception 'winner=away but away_score <= home_score';
  end if;
  if p_winner = 'draw' and p_home_score <> p_away_score then
    raise exception 'winner=draw but scores differ';
  end if;

  if v_match.stage <> 'group' and p_winner = 'draw' then
    raise exception 'knockout matches cannot end in draw';
  end if;

  update public.matches
  set home_score = p_home_score,
      away_score = p_away_score,
      winner = p_winner,
      status = 'completed',
      locked_at = coalesce(locked_at, now())
  where id = p_match_id
  returning * into v_match;

  update public.match_predictions set locked = true where match_id = p_match_id;

  insert into public.admin_audit_log (admin_user_id, action, target_table, target_id, changes)
  values (auth.uid(), 'finalize_match', 'matches', p_match_id,
    jsonb_build_object(
      'home_score', p_home_score,
      'away_score', p_away_score,
      'winner', p_winner,
      'stage', v_match.stage
    ));

  return v_match;
end;
$$;

revoke execute on function public.finalize_match(uuid, int, int, text) from public, anon;
grant execute on function public.finalize_match(uuid, int, int, text) to authenticated;

-- set_group_advancers RPC — admin finalizes which teams advance from a group
create or replace function public.set_group_advancers(
  p_tournament_id uuid,
  p_group_name text,
  p_first_place text,
  p_second_place text
)
returns public.group_results
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result public.group_results;
  v_admin boolean;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select coalesce(is_admin, false) into v_admin from public.users where id = auth.uid();
  if not v_admin then raise exception 'forbidden: admin only'; end if;

  if p_first_place = p_second_place then raise exception 'teams must differ'; end if;
  if p_group_name !~ '^[A-L]$' then raise exception 'invalid group name'; end if;
  if length(trim(p_first_place)) = 0 or length(trim(p_second_place)) = 0 then
    raise exception 'team names cannot be empty';
  end if;

  insert into public.group_results (tournament_id, group_name, first_place_team, second_place_team, finalized_by)
  values (p_tournament_id, p_group_name, p_first_place, p_second_place, auth.uid())
  on conflict (tournament_id, group_name) do update set
    first_place_team = excluded.first_place_team,
    second_place_team = excluded.second_place_team,
    finalized_at = now(),
    finalized_by = excluded.finalized_by
  returning * into v_result;

  insert into public.admin_audit_log (admin_user_id, action, target_table, target_id, changes)
  values (auth.uid(), 'set_group_advancers', 'group_results', null,
    jsonb_build_object('tournament_id', p_tournament_id, 'group', p_group_name,
                       'first', p_first_place, 'second', p_second_place));

  return v_result;
end;
$$;

revoke execute on function public.set_group_advancers(uuid, text, text, text) from public, anon;
grant execute on function public.set_group_advancers(uuid, text, text, text) to authenticated;

-- submit_champion_prediction RPC — user picks their World Cup champion
create or replace function public.submit_champion_prediction(
  p_tournament_id uuid,
  p_team text
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
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if length(trim(p_team)) = 0 then raise exception 'team cannot be empty'; end if;

  select validator_locked_at into v_user_locked from public.users where id = auth.uid();
  if v_user_locked is null then raise exception 'must complete onboarding'; end if;

  select group_lock_at into v_lock_at from public.tournaments where id = p_tournament_id;
  if v_lock_at is not null and now() > v_lock_at then
    raise exception 'champion predictions are locked';
  end if;

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

-- submit_match_prediction — tightened:
--   - group-stage matches don't accept per-match predictions (use group_predictions)
--   - knockout matches don't accept draw
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
