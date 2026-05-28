-- =====================================================================
-- WC 2026 advancer model — replaces the 2-per-group prediction with a
-- "pick up to 32 advancers" model (≤3 per group, ≤8 groups with a 3rd).
--
-- Additive: leaves the old group_predictions path intact so the frontend
-- keeps compiling during the transition. Old path removed in a later cleanup
-- once the UI is fully wired to the new endpoint.
--
-- Tables:
--   advancer_predictions  — a user's predicted advancers (0..32 rows)
--   tournament_advancers  — the official advancer set (admin-recorded, 32 rows)
-- RPCs:
--   submit_group_stage_predictions(tournament, picks, champion) — user, atomic,
--     lenient (partial OK, ≤32, ≤3/group, ≤8 thirds), also upserts champion
--   set_tournament_advancers(tournament, advancers) — admin, strict (exactly 32,
--     each group 2-3), records the official set
--   get_advancer_predictions_for_scoring(tournament) — service-role helper
-- =====================================================================

create table if not exists public.advancer_predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  group_name text not null,
  team_name text not null,
  submitted_at timestamptz not null default now(),
  unique (user_id, tournament_id, team_name)
);
alter table public.advancer_predictions enable row level security;
drop policy if exists advancer_predictions_self_select on public.advancer_predictions;
create policy advancer_predictions_self_select on public.advancer_predictions
  for select using ((select auth.uid()) = user_id);
-- No insert/update policy: writes go through submit_group_stage_predictions only.
create index if not exists advancer_predictions_user_idx
  on public.advancer_predictions (user_id, tournament_id);

create table if not exists public.tournament_advancers (
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  group_name text not null,
  team_name text not null,
  set_at timestamptz not null default now(),
  primary key (tournament_id, team_name)
);
alter table public.tournament_advancers enable row level security;
drop policy if exists tournament_advancers_public_select on public.tournament_advancers;
create policy tournament_advancers_public_select on public.tournament_advancers
  for select using (true);

-- ---------------------------------------------------------------------
-- submit_group_stage_predictions — user submits advancers + champion.
-- Lenient: partial saves OK (0..32). Enforces ≤3/group and ≤8 groups
-- with a 3rd advancer. Validates teams against tournament_teams.
-- ---------------------------------------------------------------------
create or replace function public.submit_group_stage_predictions(
  p_tournament_id uuid,
  p_picks jsonb,
  p_champion text default null
)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_locked timestamptz;
  v_lock_at timestamptz;
  v_count int;
  v_distinct int;
  v_max_per_group int;
  v_thirds int;
  v_invalid int;
  v_champ_valid boolean;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  select validator_locked_at into v_user_locked from public.users where id = auth.uid();
  if v_user_locked is null then raise exception 'must complete onboarding'; end if;

  select group_lock_at into v_lock_at from public.tournaments where id = p_tournament_id;
  if v_lock_at is not null and now() > v_lock_at then
    raise exception 'group stage predictions are locked';
  end if;

  create temp table _picks on commit drop as
  select (e->>'groupName')::text as group_name,
         (e->>'teamName')::text  as team_name
  from jsonb_array_elements(coalesce(p_picks, '[]'::jsonb)) e;

  select count(*), count(distinct team_name) into v_count, v_distinct from _picks;

  -- partial OK, but never more than 32
  if v_count > 32 then raise exception 'too many picks: % (max 32)', v_count; end if;
  if v_count <> v_distinct then raise exception 'duplicate team in picks'; end if;

  -- ≤3 per group
  select coalesce(max(c), 0) into v_max_per_group
  from (select count(*) c from _picks group by group_name) g;
  if v_max_per_group > 3 then raise exception 'max 3 teams per group'; end if;

  -- ≤8 groups with a 3rd advancer
  select count(*) into v_thirds
  from (select group_name from _picks group by group_name having count(*) >= 3) g;
  if v_thirds > 8 then raise exception 'max 8 groups may have a 3rd advancer'; end if;

  -- every team must belong to its claimed group in this tournament
  select count(*) into v_invalid
  from _picks p
  where not exists (
    select 1 from public.tournament_teams tt
    where tt.tournament_id = p_tournament_id
      and tt.team_name = p.team_name
      and tt.group_name = p.group_name
  );
  if v_invalid > 0 then raise exception 'invalid team or group in picks'; end if;

  -- champion (optional) must be a real team in this tournament
  if p_champion is not null and length(trim(p_champion)) > 0 then
    select exists(
      select 1 from public.tournament_teams
      where tournament_id = p_tournament_id and team_name = p_champion
    ) into v_champ_valid;
    if not v_champ_valid then raise exception 'unknown champion team: %', p_champion; end if;
  end if;

  -- replace advancer set atomically
  delete from public.advancer_predictions
  where user_id = auth.uid() and tournament_id = p_tournament_id;
  insert into public.advancer_predictions (user_id, tournament_id, group_name, team_name)
  select auth.uid(), p_tournament_id, group_name, team_name from _picks;

  -- upsert champion if provided (empty/null = leave existing untouched)
  if p_champion is not null and length(trim(p_champion)) > 0 then
    insert into public.champion_predictions (user_id, tournament_id, team)
    values (auth.uid(), p_tournament_id, p_champion)
    on conflict (user_id, tournament_id) do update
      set team = excluded.team, submitted_at = now()
      where not champion_predictions.locked;
  end if;

  return v_count;
end;
$$;
revoke execute on function public.submit_group_stage_predictions(uuid, jsonb, text) from public, anon;
grant execute on function public.submit_group_stage_predictions(uuid, jsonb, text) to authenticated;

-- ---------------------------------------------------------------------
-- set_tournament_advancers — admin records the official advancer set.
-- Strict: exactly 32, each group 2-3 (the real Round-of-32 structure).
-- ---------------------------------------------------------------------
create or replace function public.set_tournament_advancers(
  p_tournament_id uuid,
  p_advancers jsonb
)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin boolean;
  v_count int;
  v_distinct int;
  v_bad_group int;
  v_invalid int;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select coalesce(is_admin, false) into v_admin from public.users where id = auth.uid();
  if not v_admin then raise exception 'forbidden: admin only'; end if;

  create temp table _adv on commit drop as
  select (e->>'groupName')::text as group_name,
         (e->>'teamName')::text  as team_name
  from jsonb_array_elements(coalesce(p_advancers, '[]'::jsonb)) e;

  select count(*), count(distinct team_name) into v_count, v_distinct from _adv;
  if v_count <> 32 then raise exception 'official advancers must be exactly 32 (got %)', v_count; end if;
  if v_count <> v_distinct then raise exception 'duplicate team in advancers'; end if;

  -- each group must have 2 or 3 (the real structure)
  select count(*) into v_bad_group
  from (select group_name, count(*) c from _adv group by group_name) g
  where g.c < 2 or g.c > 3;
  if v_bad_group > 0 then raise exception 'each group must have 2 or 3 advancers'; end if;

  select count(*) into v_invalid
  from _adv a
  where not exists (
    select 1 from public.tournament_teams tt
    where tt.tournament_id = p_tournament_id
      and tt.team_name = a.team_name
      and tt.group_name = a.group_name
  );
  if v_invalid > 0 then raise exception 'invalid team or group in advancers'; end if;

  delete from public.tournament_advancers where tournament_id = p_tournament_id;
  insert into public.tournament_advancers (tournament_id, group_name, team_name)
  select p_tournament_id, group_name, team_name from _adv;

  insert into public.admin_audit_log (admin_user_id, action, target_table, target_id, changes)
  values (auth.uid(), 'set_tournament_advancers', 'tournament_advancers', null,
    jsonb_build_object('tournament_id', p_tournament_id, 'count', v_count));

  return v_count;
end;
$$;
revoke execute on function public.set_tournament_advancers(uuid, jsonb) from public, anon;
grant execute on function public.set_tournament_advancers(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- get_advancer_predictions_for_scoring — service-role helper for scoring.
-- Returns every user's predicted advancer teams for the tournament.
-- ---------------------------------------------------------------------
create or replace function public.get_advancer_predictions_for_scoring(
  p_tournament_id uuid
)
returns table (user_id uuid, team_name text)
language sql
security definer
set search_path = public, pg_temp
as $$
  select user_id, team_name
  from public.advancer_predictions
  where tournament_id = p_tournament_id;
$$;
revoke execute on function public.get_advancer_predictions_for_scoring(uuid) from public, anon, authenticated;
grant execute on function public.get_advancer_predictions_for_scoring(uuid) to service_role;
