-- =====================================================================
-- Codex follow-up audit fixes:
-- CR2: explicit service_role grants on scoring-helper RPCs (the prior
--      revoke from public/anon/authenticated didn't grant to service_role).
-- H1:  placeholder bypass — seed knockout matches store text placeholders
--      like 'Winner of Match 73', so `home_team is null` doesn't catch them.
--      Validate both teams exist in tournament_teams.
-- H3:  champion scoring is under-keyed for multi-tournament: unique was
--      (champion_prediction_user_id, reason) — collides across tournaments.
--      Rebuild with tournament_id included.
-- M1:  set_group_advancers accepts free-text — admins can save typos.
--      Validate both teams are in the group's tournament_teams.
-- M2:  draft reward snapshots were publicly readable via RLS (UI filtered
--      but direct API access still saw them). Hide non-finalized/paid from
--      non-admins; cascade to reward_users + reward_validators by parent.
-- =====================================================================

-- ---------------------------------------------------------------------
-- CR2 — explicit service_role grants on scoring helpers
-- ---------------------------------------------------------------------
grant execute on function public.get_group_predictions_for_scoring(uuid, text) to service_role;
grant execute on function public.get_champion_predictions_for_scoring(uuid) to service_role;

-- ---------------------------------------------------------------------
-- H3 — champion unique index includes tournament_id
-- ---------------------------------------------------------------------
drop index if exists public.scores_champion_reason_uniq;
create unique index scores_champion_reason_uniq
  on public.scores (champion_prediction_user_id, tournament_id, reason);

-- ---------------------------------------------------------------------
-- H1 — submit_match_prediction must reject placeholder team names by
-- checking against the canonical tournament_teams roster.
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
  v_home_real boolean;
  v_away_real boolean;
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

  -- H1: both teams must be real (in tournament_teams). Catches both null
  -- AND placeholder strings like 'Winner of Match 73' / 'Group A — 2nd'.
  if v_match.home_team is null or v_match.away_team is null then
    raise exception 'cannot predict on placeholder match (teams not yet determined)';
  end if;
  select
    exists(select 1 from public.tournament_teams
            where tournament_id = v_match.tournament_id
              and team_name = v_match.home_team),
    exists(select 1 from public.tournament_teams
            where tournament_id = v_match.tournament_id
              and team_name = v_match.away_team)
  into v_home_real, v_away_real;
  if not v_home_real or not v_away_real then
    raise exception 'cannot predict on placeholder match (teams not yet determined)';
  end if;

  -- score-winner consistency (only when both scores provided).
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
-- M1 — set_group_advancers validates teams against tournament_teams
-- ---------------------------------------------------------------------
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
  v_first_in_group boolean;
  v_second_in_group boolean;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select coalesce(is_admin, false) into v_admin from public.users where id = auth.uid();
  if not v_admin then raise exception 'forbidden: admin only'; end if;

  if p_first_place = p_second_place then raise exception 'teams must differ'; end if;
  if p_group_name !~ '^[A-L]$' then raise exception 'invalid group name'; end if;
  if length(trim(p_first_place)) = 0 or length(trim(p_second_place)) = 0 then
    raise exception 'team names cannot be empty';
  end if;

  -- M1: both teams must be in this group's roster (no typos).
  select
    exists(select 1 from public.tournament_teams
            where tournament_id = p_tournament_id
              and team_name = p_first_place
              and group_name = p_group_name),
    exists(select 1 from public.tournament_teams
            where tournament_id = p_tournament_id
              and team_name = p_second_place
              and group_name = p_group_name)
  into v_first_in_group, v_second_in_group;
  if not v_first_in_group then
    raise exception 'first_place team % is not in group %', p_first_place, p_group_name;
  end if;
  if not v_second_in_group then
    raise exception 'second_place team % is not in group %', p_second_place, p_group_name;
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
    jsonb_build_object('group_name', p_group_name,
                       'first_place', p_first_place,
                       'second_place', p_second_place));

  return v_result;
end;
$$;

revoke execute on function public.set_group_advancers(uuid, text, text, text) from public, anon;
grant execute on function public.set_group_advancers(uuid, text, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- M2 — hide draft reward snapshots from public via RLS. Admins still see
-- everything (matches the admin UI's needs). service_role bypasses RLS
-- by default so scoring/cron writes are unaffected.
-- ---------------------------------------------------------------------
drop policy if exists reward_snapshots_public_select on public.reward_snapshots;
create policy reward_snapshots_visible_select on public.reward_snapshots
  for select using (
    status in ('finalized', 'paid')
    or exists (
      select 1 from public.users
      where id = (select auth.uid()) and is_admin
    )
  );

drop policy if exists reward_users_public_select on public.reward_users;
create policy reward_users_visible_select on public.reward_users
  for select using (
    exists (
      select 1 from public.reward_snapshots rs
      where rs.id = snapshot_id
        and (rs.status in ('finalized', 'paid')
          or exists (
            select 1 from public.users
            where id = (select auth.uid()) and is_admin
          ))
    )
  );

drop policy if exists reward_validators_public_select on public.reward_validators;
create policy reward_validators_visible_select on public.reward_validators
  for select using (
    exists (
      select 1 from public.reward_snapshots rs
      where rs.id = snapshot_id
        and (rs.status in ('finalized', 'paid')
          or exists (
            select 1 from public.users
            where id = (select auth.uid()) and is_admin
          ))
    )
  );
