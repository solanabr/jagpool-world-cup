-- =====================================================================
-- JagPool World Cup 2026 — Baseline schema
-- =====================================================================
-- This file is the single-source baseline produced by squashing migrations
-- 00001..00024 (preserved in `supabase/migrations/_archive/`).
--
-- Apply this against a FRESH database to get the full schema in one shot.
-- The live production DB has migrations 00001..00024 already tracked
-- individually in `supabase_migrations.schema_migrations` — re-running this
-- file there would be a no-op (everything uses IF NOT EXISTS / OR REPLACE
-- where possible). For incremental changes going forward, add new files
-- with a number AFTER 00024 (so the live DB picks them up via supabase CLI).
--
-- Section map:
--   1. Initial schema (tables, enums, indexes, triggers)
--   2. RLS policies
--   3. Views (later replaced by RPCs in §8)
--   4. Initial RPCs
--   5. Seed: WC 2026 tournament
--   6. Round-of-32 stage added
--   7. Match venue + uniqueness fixes
--   8. Seed: full WC 2026 match schedule
--   9. Validators metadata columns
--  10. Seed: 88 JagPool validators
--  11. Security hardening (RLS tightening)
--  12. Validator vote accounts + logos
--  13. SIWS challenges store message
--  14. User leaderboard logo
--  15. RLS user column restriction (no self-promote to admin)
--  16. RPC hardening
--  17. Atomic lock_overdue_matches RPC
--  18. Leaderboard RPCs + write lockdown + idempotency indexes
--  19. Domain RPCs + scoring v2 (champion_predictions table)
--  20. Reward snapshots + helper RPCs
--  21. Admin domain RPCs (list_users_admin, set_user_admin, etc.)
--  22. RLS leak fix + onboarding gate + set_reward_snapshot_status
--  23. RLS init-plan optimization
--  24. Codex audit fixes (non-partial indexes, tournament_teams, etc.)
-- =====================================================================


-- ========================================================================
-- §00001_schema.sql
-- ========================================================================
-- JagPool World Cup — Initial schema
-- Wallet-keyed users, validators, tournament, matches, predictions, scores.

create extension if not exists "pgcrypto";

-- =====================================================================
-- VALIDATORS — JagPool's validator set, mirrored from jagpool.org
-- =====================================================================
create table public.validators (
  id uuid primary key default gen_random_uuid(),
  vote_account text unique not null,
  name text not null,
  description text,
  logo_url text,
  website_url text,
  is_active boolean not null default true,
  display_order int not null default 0,
  created_at timestamptz not null default now()
);

create index validators_active_order_idx on public.validators (is_active, display_order);

-- =====================================================================
-- USERS — mirrors auth.users with wallet-first profile data
-- =====================================================================
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  wallet_address text unique not null,
  username text unique not null check (char_length(username) between 3 and 20),
  validator_id uuid references public.validators(id),
  validator_locked_at timestamptz,
  jagsol_verified_at timestamptz,
  jagsol_balance numeric,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index users_validator_idx on public.users (validator_id) where validator_locked_at is not null;

-- =====================================================================
-- TOURNAMENTS — one row per edition (FIFA WC 2026)
-- =====================================================================
create table public.tournaments (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  min_jagsol_amount numeric not null default 0,
  group_lock_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- =====================================================================
-- MATCHES — group stage + knockout
-- =====================================================================
create type match_stage as enum (
  'group','round_of_16','quarter','semi','third_place','final'
);
create type match_status as enum ('upcoming','live','locked','completed','cancelled');

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  stage match_stage not null,
  group_name text,
  match_number int not null,
  home_team text,
  away_team text,
  kickoff_at timestamptz not null,
  status match_status not null default 'upcoming',
  home_score int,
  away_score int,
  winner text check (winner in ('home','away','draw')),
  locked_at timestamptz,
  parent_match_a uuid references public.matches(id),
  parent_match_b uuid references public.matches(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index matches_tournament_kickoff_idx on public.matches (tournament_id, kickoff_at);
create index matches_status_idx on public.matches (status);

-- =====================================================================
-- GROUP PREDICTIONS — pick 2 teams advancing per group
-- =====================================================================
create table public.group_predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  group_name text not null,
  advancing_team_1 text not null,
  advancing_team_2 text not null,
  locked boolean not null default false,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, tournament_id, group_name),
  check (advancing_team_1 <> advancing_team_2)
);

-- =====================================================================
-- MATCH PREDICTIONS — per match (knockout) or for individual group matches
-- =====================================================================
create table public.match_predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  winner text not null check (winner in ('home','away','draw')),
  home_score int,
  away_score int,
  locked boolean not null default false,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, match_id)
);

create index match_predictions_match_idx on public.match_predictions (match_id);

-- =====================================================================
-- SCORES — denormalized for fast leaderboards
-- =====================================================================
create table public.scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  match_id uuid references public.matches(id) on delete cascade,
  group_prediction_id uuid references public.group_predictions(id) on delete cascade,
  match_prediction_id uuid references public.match_predictions(id) on delete cascade,
  points int not null,
  reason text not null,
  created_at timestamptz not null default now()
);

create index scores_user_idx on public.scores (user_id);
create index scores_match_idx on public.scores (match_id);

-- =====================================================================
-- SIWS CHALLENGES — short-lived nonces for Sign in with Solana
-- =====================================================================
create table public.siws_challenges (
  nonce text primary key,
  public_key text not null,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index siws_challenges_pubkey_idx on public.siws_challenges (public_key);
create index siws_challenges_expires_idx on public.siws_challenges (expires_at);

-- =====================================================================
-- ADMIN AUDIT LOG
-- =====================================================================
create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references public.users(id),
  action text not null,
  target_table text,
  target_id uuid,
  changes jsonb,
  created_at timestamptz not null default now()
);

create index admin_audit_admin_idx on public.admin_audit_log (admin_user_id, created_at desc);

-- =====================================================================
-- UPDATED_AT TRIGGERS
-- =====================================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_updated_at before update on public.users
  for each row execute function public.set_updated_at();

create trigger matches_updated_at before update on public.matches
  for each row execute function public.set_updated_at();

create trigger group_predictions_updated_at before update on public.group_predictions
  for each row execute function public.set_updated_at();

create trigger match_predictions_updated_at before update on public.match_predictions
  for each row execute function public.set_updated_at();

-- ========================================================================
-- §00002_rls.sql
-- ========================================================================
-- RLS policies for JagPool World Cup
-- All tables have RLS enabled. Service role bypasses everything.

-- =====================================================================
-- USERS
-- =====================================================================
alter table public.users enable row level security;

create policy users_self_select on public.users
  for select using (auth.uid() = id);

create policy users_self_update on public.users
  for update using (auth.uid() = id)
  with check (auth.uid() = id);

-- inserts always come via service role (SIWS verify endpoint)

-- =====================================================================
-- VALIDATORS — public read, admin-only write
-- =====================================================================
alter table public.validators enable row level security;

create policy validators_public_select on public.validators
  for select using (true);

-- =====================================================================
-- TOURNAMENTS — public read, admin-only write
-- =====================================================================
alter table public.tournaments enable row level security;

create policy tournaments_public_select on public.tournaments
  for select using (true);

-- =====================================================================
-- MATCHES — public read, admin-only write
-- =====================================================================
alter table public.matches enable row level security;

create policy matches_public_select on public.matches
  for select using (true);

-- =====================================================================
-- GROUP PREDICTIONS — user can manage own, public can't read others
-- =====================================================================
alter table public.group_predictions enable row level security;

create policy group_predictions_self_select on public.group_predictions
  for select using (auth.uid() = user_id);

create policy group_predictions_self_insert on public.group_predictions
  for insert with check (auth.uid() = user_id and not locked);

create policy group_predictions_self_update on public.group_predictions
  for update using (auth.uid() = user_id and not locked)
  with check (auth.uid() = user_id and not locked);

-- =====================================================================
-- MATCH PREDICTIONS — user can manage own, public can't read others
-- =====================================================================
alter table public.match_predictions enable row level security;

create policy match_predictions_self_select on public.match_predictions
  for select using (auth.uid() = user_id);

create policy match_predictions_self_insert on public.match_predictions
  for insert with check (auth.uid() = user_id and not locked);

create policy match_predictions_self_update on public.match_predictions
  for update using (auth.uid() = user_id and not locked)
  with check (auth.uid() = user_id and not locked);

-- =====================================================================
-- SCORES — public read (for leaderboards), service role write
-- =====================================================================
alter table public.scores enable row level security;

create policy scores_public_select on public.scores
  for select using (true);

-- =====================================================================
-- SIWS CHALLENGES — no client access; service role only
-- =====================================================================
alter table public.siws_challenges enable row level security;

-- =====================================================================
-- ADMIN AUDIT LOG — no client access; service role only
-- =====================================================================
alter table public.admin_audit_log enable row level security;

-- ========================================================================
-- §00003_views.sql
-- ========================================================================
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

-- ========================================================================
-- §00004_rpcs.sql
-- ========================================================================
-- RPC functions for atomic operations that span tables or enforce server-side invariants.

-- =====================================================================
-- LOCK VALIDATOR — atomic one-time validator selection
-- =====================================================================
create or replace function public.lock_validator(p_validator_id uuid)
returns public.users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.users;
  v_validator_active boolean;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select is_active into v_validator_active
  from public.validators
  where id = p_validator_id;

  if not coalesce(v_validator_active, false) then
    raise exception 'validator not found or inactive';
  end if;

  select * into v_user from public.users where id = auth.uid();

  if v_user.validator_locked_at is not null then
    raise exception 'validator already locked';
  end if;

  update public.users
  set validator_id = p_validator_id,
      validator_locked_at = now()
  where id = auth.uid()
  returning * into v_user;

  return v_user;
end;
$$;

grant execute on function public.lock_validator(uuid) to authenticated;

-- =====================================================================
-- SUBMIT GROUP PREDICTION — upsert with lock check based on tournament group_lock_at
-- =====================================================================
create or replace function public.submit_group_prediction(
  p_tournament_id uuid,
  p_group_name text,
  p_team_1 text,
  p_team_2 text
)
returns public.group_predictions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pred public.group_predictions;
  v_lock_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if p_team_1 = p_team_2 then
    raise exception 'teams must be different';
  end if;

  select group_lock_at into v_lock_at from public.tournaments where id = p_tournament_id;
  if v_lock_at is not null and now() > v_lock_at then
    raise exception 'group predictions are locked';
  end if;

  insert into public.group_predictions (
    user_id, tournament_id, group_name, advancing_team_1, advancing_team_2
  ) values (
    auth.uid(), p_tournament_id, p_group_name, p_team_1, p_team_2
  )
  on conflict (user_id, tournament_id, group_name)
  do update set
    advancing_team_1 = excluded.advancing_team_1,
    advancing_team_2 = excluded.advancing_team_2,
    updated_at = now()
  returning * into v_pred;

  if v_pred.locked then
    raise exception 'prediction already locked';
  end if;

  return v_pred;
end;
$$;

grant execute on function public.submit_group_prediction(uuid, text, text, text) to authenticated;

-- =====================================================================
-- SUBMIT MATCH PREDICTION — upsert with kickoff-based lock check
-- =====================================================================
create or replace function public.submit_match_prediction(
  p_match_id uuid,
  p_winner text,
  p_home_score int default null,
  p_away_score int default null
)
returns public.match_predictions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pred public.match_predictions;
  v_match public.matches;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if p_winner not in ('home','away','draw') then
    raise exception 'invalid winner';
  end if;

  select * into v_match from public.matches where id = p_match_id;
  if v_match.id is null then
    raise exception 'match not found';
  end if;

  if v_match.locked_at is not null or now() >= v_match.kickoff_at then
    raise exception 'match prediction window is closed';
  end if;

  insert into public.match_predictions (
    user_id, match_id, winner, home_score, away_score
  ) values (
    auth.uid(), p_match_id, p_winner, p_home_score, p_away_score
  )
  on conflict (user_id, match_id)
  do update set
    winner = excluded.winner,
    home_score = excluded.home_score,
    away_score = excluded.away_score,
    updated_at = now()
  returning * into v_pred;

  return v_pred;
end;
$$;

grant execute on function public.submit_match_prediction(uuid, text, int, int) to authenticated;

-- ========================================================================
-- §00005_seed.sql
-- ========================================================================
-- Seed the FIFA WC 2026 tournament row. Min JagSOL is a placeholder
-- and should be updated by admin before launch.

insert into public.tournaments (
  slug, name, starts_at, ends_at, min_jagsol_amount, group_lock_at, metadata
) values (
  'fifa-wc-2026',
  'FIFA World Cup 2026',
  '2026-06-11 12:00:00-03',
  '2026-07-19 23:59:59-03',
  1,
  '2026-06-11 12:00:00-03',
  jsonb_build_object(
    'host_countries', jsonb_build_array('USA', 'CAN', 'MEX'),
    'prize_pool_top_users', 10
  )
) on conflict (slug) do nothing;

-- ========================================================================
-- §00006_add_round_of_32_stage.sql
-- ========================================================================
-- FIFA WC 2026 introduces a round-of-32 before the round-of-16 due to 48-team format.
-- This must run in its own transaction before any seed that uses the new value.

alter type match_stage add value if not exists 'round_of_32' before 'round_of_16';

-- ========================================================================
-- §00007_matches_venue_and_uniq.sql
-- ========================================================================
-- Add venue column + unique index for idempotent seeding by FIFA match number.

alter table public.matches add column if not exists venue text;

create unique index if not exists matches_tournament_match_number_uniq
  on public.matches (tournament_id, match_number);

-- ========================================================================
-- §00008_seed_wc2026_matches.sql
-- ========================================================================
-- FIFA WC 2026 — all 104 matches.
-- Group stage matches use real team names. Knockout matches use placeholder strings
-- (e.g. "Winner of Match 73", "3rd from A/B/C/D/F") that admin overwrites once known.
-- Kickoff times are stored as UTC. Brasília time is UTC-3.

do $$
declare v_tid uuid;
begin
  select id into v_tid from public.tournaments where slug = 'fifa-wc-2026';
  if v_tid is null then
    raise exception 'tournament fifa-wc-2026 not seeded yet — run 00005_seed.sql first';
  end if;

  -- =====================================================================
  -- ROUND 1 — matches 1..24
  -- =====================================================================
  insert into public.matches (tournament_id, stage, group_name, match_number, home_team, away_team, kickoff_at, venue) values
    (v_tid, 'group', 'A',  1, 'Mexico',                  'South Africa',        '2026-06-11T19:00:00Z', 'Mexico City'),
    (v_tid, 'group', 'A',  2, 'South Korea',             'Czech Republic',      '2026-06-12T02:00:00Z', 'Guadalajara'),
    (v_tid, 'group', 'B',  3, 'Canada',                  'Bosnia and Herzegovina','2026-06-12T19:00:00Z','Toronto'),
    (v_tid, 'group', 'D',  4, 'USA',                     'Paraguay',            '2026-06-13T01:00:00Z', 'Los Angeles'),
    (v_tid, 'group', 'B',  5, 'Qatar',                   'Switzerland',         '2026-06-13T19:00:00Z', 'Santa Clara'),
    (v_tid, 'group', 'C',  6, 'Brazil',                  'Morocco',             '2026-06-13T22:00:00Z', 'New York / New Jersey'),
    (v_tid, 'group', 'C',  7, 'Haiti',                   'Scotland',            '2026-06-14T01:00:00Z', 'Boston'),
    (v_tid, 'group', 'D',  8, 'Australia',               'Turkey',              '2026-06-14T04:00:00Z', 'Vancouver'),
    (v_tid, 'group', 'E',  9, 'Germany',                 'Curaçao',             '2026-06-14T17:00:00Z', 'Houston'),
    (v_tid, 'group', 'F', 10, 'Netherlands',             'Japan',               '2026-06-14T20:00:00Z', 'Dallas'),
    (v_tid, 'group', 'E', 11, 'Ivory Coast',             'Ecuador',             '2026-06-14T23:00:00Z', 'Philadelphia'),
    (v_tid, 'group', 'F', 12, 'Sweden',                  'Tunisia',             '2026-06-15T02:00:00Z', 'Monterrey'),
    (v_tid, 'group', 'H', 13, 'Spain',                   'Cape Verde',          '2026-06-15T16:00:00Z', 'Atlanta'),
    (v_tid, 'group', 'G', 14, 'Belgium',                 'Egypt',               '2026-06-15T19:00:00Z', 'Seattle'),
    (v_tid, 'group', 'H', 15, 'Saudi Arabia',            'Uruguay',             '2026-06-15T22:00:00Z', 'Miami'),
    (v_tid, 'group', 'G', 16, 'Iran',                    'New Zealand',         '2026-06-16T01:00:00Z', 'Los Angeles'),
    (v_tid, 'group', 'I', 17, 'France',                  'Senegal',             '2026-06-16T19:00:00Z', 'New York / New Jersey'),
    (v_tid, 'group', 'I', 18, 'Iraq',                    'Norway',              '2026-06-16T22:00:00Z', 'Boston'),
    (v_tid, 'group', 'J', 19, 'Argentina',               'Algeria',             '2026-06-17T01:00:00Z', 'Kansas City'),
    (v_tid, 'group', 'J', 20, 'Austria',                 'Jordan',              '2026-06-17T04:00:00Z', 'Santa Clara'),
    (v_tid, 'group', 'K', 21, 'Portugal',                'DR Congo',            '2026-06-17T17:00:00Z', 'Houston'),
    (v_tid, 'group', 'L', 22, 'England',                 'Croatia',             '2026-06-17T20:00:00Z', 'Dallas'),
    (v_tid, 'group', 'L', 23, 'Ghana',                   'Panama',              '2026-06-17T23:00:00Z', 'Toronto'),
    (v_tid, 'group', 'K', 24, 'Uzbekistan',              'Colombia',            '2026-06-18T00:00:00Z', 'Mexico City')
  on conflict (tournament_id, match_number) do nothing;

  -- =====================================================================
  -- ROUND 2 — matches 25..48
  -- =====================================================================
  insert into public.matches (tournament_id, stage, group_name, match_number, home_team, away_team, kickoff_at, venue) values
    (v_tid, 'group', 'A', 25, 'Czech Republic',          'South Africa',        '2026-06-18T16:00:00Z', 'Atlanta'),
    (v_tid, 'group', 'B', 26, 'Switzerland',             'Bosnia and Herzegovina','2026-06-18T19:00:00Z','Los Angeles'),
    (v_tid, 'group', 'B', 27, 'Canada',                  'Qatar',               '2026-06-18T22:00:00Z', 'Vancouver'),
    (v_tid, 'group', 'A', 28, 'Mexico',                  'South Korea',         '2026-06-19T01:00:00Z', 'Guadalajara'),
    (v_tid, 'group', 'D', 29, 'USA',                     'Australia',           '2026-06-19T19:00:00Z', 'Seattle'),
    (v_tid, 'group', 'C', 30, 'Scotland',                'Morocco',             '2026-06-19T22:00:00Z', 'Boston'),
    (v_tid, 'group', 'C', 31, 'Brazil',                  'Haiti',               '2026-06-20T00:30:00Z', 'Philadelphia'),
    (v_tid, 'group', 'D', 32, 'Turkey',                  'Paraguay',            '2026-06-20T03:00:00Z', 'Santa Clara'),
    (v_tid, 'group', 'F', 33, 'Netherlands',             'Sweden',              '2026-06-20T17:00:00Z', 'Houston'),
    (v_tid, 'group', 'E', 34, 'Germany',                 'Ivory Coast',         '2026-06-20T20:00:00Z', 'Toronto'),
    (v_tid, 'group', 'E', 35, 'Ecuador',                 'Curaçao',             '2026-06-21T00:00:00Z', 'Kansas City'),
    (v_tid, 'group', 'F', 36, 'Tunisia',                 'Japan',               '2026-06-21T02:00:00Z', 'Monterrey'),
    (v_tid, 'group', 'H', 37, 'Spain',                   'Saudi Arabia',        '2026-06-21T16:00:00Z', 'Atlanta'),
    (v_tid, 'group', 'G', 38, 'Belgium',                 'Iran',                '2026-06-21T19:00:00Z', 'Los Angeles'),
    (v_tid, 'group', 'H', 39, 'Uruguay',                 'Cape Verde',          '2026-06-21T22:00:00Z', 'Miami'),
    (v_tid, 'group', 'G', 40, 'New Zealand',             'Egypt',               '2026-06-22T01:00:00Z', 'Vancouver'),
    (v_tid, 'group', 'J', 41, 'Argentina',               'Austria',             '2026-06-22T17:00:00Z', 'Dallas'),
    (v_tid, 'group', 'I', 42, 'France',                  'Iraq',                '2026-06-22T21:00:00Z', 'Philadelphia'),
    (v_tid, 'group', 'I', 43, 'Norway',                  'Senegal',             '2026-06-23T00:00:00Z', 'New York / New Jersey'),
    (v_tid, 'group', 'J', 44, 'Jordan',                  'Algeria',             '2026-06-23T03:00:00Z', 'Santa Clara'),
    (v_tid, 'group', 'K', 45, 'Portugal',                'Uzbekistan',          '2026-06-23T17:00:00Z', 'Houston'),
    (v_tid, 'group', 'L', 46, 'England',                 'Ghana',               '2026-06-23T20:00:00Z', 'Boston'),
    (v_tid, 'group', 'L', 47, 'Panama',                  'Croatia',             '2026-06-23T23:00:00Z', 'Toronto'),
    (v_tid, 'group', 'K', 48, 'Colombia',                'DR Congo',            '2026-06-24T02:00:00Z', 'Guadalajara')
  on conflict (tournament_id, match_number) do nothing;

  -- =====================================================================
  -- ROUND 3 — matches 49..72
  -- =====================================================================
  insert into public.matches (tournament_id, stage, group_name, match_number, home_team, away_team, kickoff_at, venue) values
    (v_tid, 'group', 'B', 49, 'Switzerland',             'Canada',              '2026-06-24T19:00:00Z', 'Vancouver'),
    (v_tid, 'group', 'B', 50, 'Bosnia and Herzegovina',  'Qatar',               '2026-06-24T19:00:00Z', 'Seattle'),
    (v_tid, 'group', 'C', 51, 'Scotland',                'Brazil',              '2026-06-24T22:00:00Z', 'Miami'),
    (v_tid, 'group', 'C', 52, 'Morocco',                 'Haiti',               '2026-06-24T22:00:00Z', 'Atlanta'),
    (v_tid, 'group', 'A', 53, 'Czech Republic',          'Mexico',              '2026-06-25T01:00:00Z', 'Mexico City'),
    (v_tid, 'group', 'A', 54, 'South Africa',            'South Korea',         '2026-06-25T01:00:00Z', 'Monterrey'),
    (v_tid, 'group', 'E', 55, 'Ecuador',                 'Germany',             '2026-06-25T20:00:00Z', 'New York / New Jersey'),
    (v_tid, 'group', 'E', 56, 'Curaçao',                 'Ivory Coast',         '2026-06-25T20:00:00Z', 'Philadelphia'),
    (v_tid, 'group', 'F', 57, 'Japan',                   'Sweden',              '2026-06-25T23:00:00Z', 'Dallas'),
    (v_tid, 'group', 'F', 58, 'Tunisia',                 'Netherlands',         '2026-06-25T23:00:00Z', 'Kansas City'),
    (v_tid, 'group', 'D', 59, 'Turkey',                  'USA',                 '2026-06-26T02:00:00Z', 'Los Angeles'),
    (v_tid, 'group', 'D', 60, 'Paraguay',                'Australia',           '2026-06-26T02:00:00Z', 'Santa Clara'),
    (v_tid, 'group', 'I', 61, 'Norway',                  'France',              '2026-06-26T19:00:00Z', 'Boston'),
    (v_tid, 'group', 'I', 62, 'Senegal',                 'Iraq',                '2026-06-26T19:00:00Z', 'Toronto'),
    (v_tid, 'group', 'H', 63, 'Cape Verde',              'Saudi Arabia',        '2026-06-27T00:00:00Z', 'Houston'),
    (v_tid, 'group', 'H', 64, 'Uruguay',                 'Spain',               '2026-06-27T00:00:00Z', 'Guadalajara'),
    (v_tid, 'group', 'G', 65, 'Egypt',                   'Iran',                '2026-06-27T03:00:00Z', 'Seattle'),
    (v_tid, 'group', 'G', 66, 'New Zealand',             'Belgium',             '2026-06-27T03:00:00Z', 'Vancouver'),
    (v_tid, 'group', 'L', 67, 'Panama',                  'England',             '2026-06-27T21:00:00Z', 'New York / New Jersey'),
    (v_tid, 'group', 'L', 68, 'Croatia',                 'Ghana',               '2026-06-27T21:00:00Z', 'Philadelphia'),
    (v_tid, 'group', 'K', 69, 'Colombia',                'Portugal',            '2026-06-27T23:30:00Z', 'Miami'),
    (v_tid, 'group', 'K', 70, 'DR Congo',                'Uzbekistan',          '2026-06-27T23:30:00Z', 'Atlanta'),
    (v_tid, 'group', 'J', 71, 'Algeria',                 'Austria',             '2026-06-28T02:00:00Z', 'Kansas City'),
    (v_tid, 'group', 'J', 72, 'Jordan',                  'Argentina',           '2026-06-28T02:00:00Z', 'Dallas')
  on conflict (tournament_id, match_number) do nothing;

  -- =====================================================================
  -- ROUND OF 32 — matches 73..88 (placeholder teams; admin updates as group stage finishes)
  -- Default kickoff: 22:00 UTC. Admin can refine via PATCH /api/admin/matches/[id].
  -- =====================================================================
  insert into public.matches (tournament_id, stage, group_name, match_number, home_team, away_team, kickoff_at, venue) values
    (v_tid, 'round_of_32', null, 73, 'Group A — 2nd',           'Group B — 2nd',          '2026-06-28T22:00:00Z', 'Los Angeles'),
    (v_tid, 'round_of_32', null, 74, 'Group E — 1st',           '3rd from A/B/C/D/F',     '2026-06-29T22:00:00Z', 'Boston'),
    (v_tid, 'round_of_32', null, 75, 'Group F — 1st',           'Group C — 2nd',          '2026-06-29T22:00:00Z', 'Monterrey'),
    (v_tid, 'round_of_32', null, 76, 'Group C — 1st',           'Group F — 2nd',          '2026-06-29T22:00:00Z', 'Houston'),
    (v_tid, 'round_of_32', null, 77, 'Group I — 1st',           '3rd from C/D/F/G/H',     '2026-06-30T22:00:00Z', 'New York / New Jersey'),
    (v_tid, 'round_of_32', null, 78, 'Group E — 2nd',           'Group I — 2nd',          '2026-06-30T22:00:00Z', 'Dallas'),
    (v_tid, 'round_of_32', null, 79, 'Group A — 1st',           '3rd from C/E/F/H/I',     '2026-06-30T22:00:00Z', 'Mexico City'),
    (v_tid, 'round_of_32', null, 80, 'Group L — 1st',           '3rd from E/H/I/J/K',     '2026-07-01T22:00:00Z', 'Atlanta'),
    (v_tid, 'round_of_32', null, 81, 'Group D — 1st',           '3rd from B/E/F/I/J',     '2026-07-01T22:00:00Z', 'Santa Clara'),
    (v_tid, 'round_of_32', null, 82, 'Group G — 1st',           '3rd from A/E/H/I/J',     '2026-07-01T22:00:00Z', 'Seattle'),
    (v_tid, 'round_of_32', null, 83, 'Group K — 2nd',           'Group L — 2nd',          '2026-07-02T22:00:00Z', 'Toronto'),
    (v_tid, 'round_of_32', null, 84, 'Group H — 1st',           'Group J — 2nd',          '2026-07-02T22:00:00Z', 'Los Angeles'),
    (v_tid, 'round_of_32', null, 85, 'Group B — 1st',           '3rd from E/F/G/I/J',     '2026-07-02T22:00:00Z', 'Vancouver'),
    (v_tid, 'round_of_32', null, 86, 'Group J — 1st',           'Group H — 2nd',          '2026-07-03T22:00:00Z', 'Miami'),
    (v_tid, 'round_of_32', null, 87, 'Group K — 1st',           '3rd from D/E/I/J/L',     '2026-07-03T22:00:00Z', 'Kansas City'),
    (v_tid, 'round_of_32', null, 88, 'Group D — 2nd',           'Group G — 2nd',          '2026-07-03T22:00:00Z', 'Dallas')
  on conflict (tournament_id, match_number) do nothing;

  -- =====================================================================
  -- ROUND OF 16 — matches 89..96
  -- =====================================================================
  insert into public.matches (tournament_id, stage, group_name, match_number, home_team, away_team, kickoff_at, venue) values
    (v_tid, 'round_of_16', null, 89, 'Winner of Match 74', 'Winner of Match 77', '2026-07-04T22:00:00Z', 'Philadelphia'),
    (v_tid, 'round_of_16', null, 90, 'Winner of Match 73', 'Winner of Match 75', '2026-07-04T22:00:00Z', 'Houston'),
    (v_tid, 'round_of_16', null, 91, 'Winner of Match 76', 'Winner of Match 78', '2026-07-05T22:00:00Z', 'New York / New Jersey'),
    (v_tid, 'round_of_16', null, 92, 'Winner of Match 79', 'Winner of Match 80', '2026-07-05T22:00:00Z', 'Mexico City'),
    (v_tid, 'round_of_16', null, 93, 'Winner of Match 83', 'Winner of Match 84', '2026-07-06T22:00:00Z', 'Dallas'),
    (v_tid, 'round_of_16', null, 94, 'Winner of Match 81', 'Winner of Match 82', '2026-07-06T22:00:00Z', 'Seattle'),
    (v_tid, 'round_of_16', null, 95, 'Winner of Match 86', 'Winner of Match 88', '2026-07-07T22:00:00Z', 'Atlanta'),
    (v_tid, 'round_of_16', null, 96, 'Winner of Match 85', 'Winner of Match 87', '2026-07-07T22:00:00Z', 'Vancouver')
  on conflict (tournament_id, match_number) do nothing;

  -- =====================================================================
  -- QUARTERFINALS — matches 97..100
  -- =====================================================================
  insert into public.matches (tournament_id, stage, group_name, match_number, home_team, away_team, kickoff_at, venue) values
    (v_tid, 'quarter',     null,  97, 'Winner of Match 89', 'Winner of Match 90', '2026-07-09T22:00:00Z', 'Boston'),
    (v_tid, 'quarter',     null,  98, 'Winner of Match 93', 'Winner of Match 94', '2026-07-10T22:00:00Z', 'Los Angeles'),
    (v_tid, 'quarter',     null,  99, 'Winner of Match 91', 'Winner of Match 92', '2026-07-12T22:00:00Z', 'Miami'),
    (v_tid, 'quarter',     null, 100, 'Winner of Match 95', 'Winner of Match 96', '2026-07-12T22:00:00Z', 'Kansas City')
  on conflict (tournament_id, match_number) do nothing;

  -- =====================================================================
  -- SEMIFINALS, THIRD PLACE, FINAL — matches 101..104
  -- =====================================================================
  insert into public.matches (tournament_id, stage, group_name, match_number, home_team, away_team, kickoff_at, venue) values
    (v_tid, 'semi',        null, 101, 'Winner of Match 97', 'Winner of Match 98',  '2026-07-14T22:00:00Z', 'Dallas'),
    (v_tid, 'semi',        null, 102, 'Winner of Match 99', 'Winner of Match 100', '2026-07-15T22:00:00Z', 'Atlanta'),
    (v_tid, 'third_place', null, 103, 'Loser of Match 101', 'Loser of Match 102',  '2026-07-18T22:00:00Z', 'Miami'),
    (v_tid, 'final',       null, 104, 'Winner of Match 101','Winner of Match 102', '2026-07-19T22:00:00Z', 'New York / New Jersey')
  on conflict (tournament_id, match_number) do nothing;

  -- =====================================================================
  -- LINK PARENT MATCHES — for matches whose teams are "Winner of X"
  -- (R32 is skipped: third-place advancement isn't a simple "winner of N" link)
  -- =====================================================================
  update public.matches m set
    parent_match_a = (select id from public.matches where tournament_id = v_tid and match_number = 74),
    parent_match_b = (select id from public.matches where tournament_id = v_tid and match_number = 77)
  where tournament_id = v_tid and match_number = 89;

  update public.matches m set
    parent_match_a = (select id from public.matches where tournament_id = v_tid and match_number = 73),
    parent_match_b = (select id from public.matches where tournament_id = v_tid and match_number = 75)
  where tournament_id = v_tid and match_number = 90;

  update public.matches m set
    parent_match_a = (select id from public.matches where tournament_id = v_tid and match_number = 76),
    parent_match_b = (select id from public.matches where tournament_id = v_tid and match_number = 78)
  where tournament_id = v_tid and match_number = 91;

  update public.matches m set
    parent_match_a = (select id from public.matches where tournament_id = v_tid and match_number = 79),
    parent_match_b = (select id from public.matches where tournament_id = v_tid and match_number = 80)
  where tournament_id = v_tid and match_number = 92;

  update public.matches m set
    parent_match_a = (select id from public.matches where tournament_id = v_tid and match_number = 83),
    parent_match_b = (select id from public.matches where tournament_id = v_tid and match_number = 84)
  where tournament_id = v_tid and match_number = 93;

  update public.matches m set
    parent_match_a = (select id from public.matches where tournament_id = v_tid and match_number = 81),
    parent_match_b = (select id from public.matches where tournament_id = v_tid and match_number = 82)
  where tournament_id = v_tid and match_number = 94;

  update public.matches m set
    parent_match_a = (select id from public.matches where tournament_id = v_tid and match_number = 86),
    parent_match_b = (select id from public.matches where tournament_id = v_tid and match_number = 88)
  where tournament_id = v_tid and match_number = 95;

  update public.matches m set
    parent_match_a = (select id from public.matches where tournament_id = v_tid and match_number = 85),
    parent_match_b = (select id from public.matches where tournament_id = v_tid and match_number = 87)
  where tournament_id = v_tid and match_number = 96;

  update public.matches m set
    parent_match_a = (select id from public.matches where tournament_id = v_tid and match_number = 89),
    parent_match_b = (select id from public.matches where tournament_id = v_tid and match_number = 90)
  where tournament_id = v_tid and match_number = 97;

  update public.matches m set
    parent_match_a = (select id from public.matches where tournament_id = v_tid and match_number = 93),
    parent_match_b = (select id from public.matches where tournament_id = v_tid and match_number = 94)
  where tournament_id = v_tid and match_number = 98;

  update public.matches m set
    parent_match_a = (select id from public.matches where tournament_id = v_tid and match_number = 91),
    parent_match_b = (select id from public.matches where tournament_id = v_tid and match_number = 92)
  where tournament_id = v_tid and match_number = 99;

  update public.matches m set
    parent_match_a = (select id from public.matches where tournament_id = v_tid and match_number = 95),
    parent_match_b = (select id from public.matches where tournament_id = v_tid and match_number = 96)
  where tournament_id = v_tid and match_number = 100;

  update public.matches m set
    parent_match_a = (select id from public.matches where tournament_id = v_tid and match_number = 97),
    parent_match_b = (select id from public.matches where tournament_id = v_tid and match_number = 98)
  where tournament_id = v_tid and match_number = 101;

  update public.matches m set
    parent_match_a = (select id from public.matches where tournament_id = v_tid and match_number = 99),
    parent_match_b = (select id from public.matches where tournament_id = v_tid and match_number = 100)
  where tournament_id = v_tid and match_number = 102;

  update public.matches m set
    parent_match_a = (select id from public.matches where tournament_id = v_tid and match_number = 101),
    parent_match_b = (select id from public.matches where tournament_id = v_tid and match_number = 102)
  where tournament_id = v_tid and match_number = 104;

  -- Match 103 (third-place) is "Loser of 101 vs Loser of 102" — parent_match_* is for winners,
  -- so we leave it null and rely on the placeholder text + admin overwrite.

  -- Update tournament group_lock_at to the first match's kickoff
  update public.tournaments
  set group_lock_at = '2026-06-11T19:00:00Z'
  where id = v_tid;
end$$;

-- ========================================================================
-- §00009_validators_metadata.sql
-- ========================================================================
-- Extend validators with metadata mirrored from jagpool.org

alter table public.validators
  add column if not exists location text,
  add column if not exists region text,
  add column if not exists total_stake numeric,
  add column if not exists current_stake numeric,
  add column if not exists target_stake numeric;

create index if not exists validators_region_idx on public.validators (region);

-- ========================================================================
-- §00010_seed_jagpool_validators.sql
-- ========================================================================
-- Seed JagPool validator set as of 2026-05-26 (data from jagpool.org)
-- vote_account values are slug placeholders (`placeholder_v###`); admin must
-- update them to real validator vote-account pubkeys before launch.

insert into public.validators (
  vote_account, name, location, region,
  total_stake, current_stake, target_stake,
  is_active, display_order
) values
  ('placeholder_v1',  'Ha1iad3',                                 'Asia/Tokyo',                       'APAC',  984773,  3817,  3648,  true, 1),
  ('placeholder_v2',  'Hylo',                                    'São Paulo',                        'LATAM', 353996,  14941, 16964, true, 2),
  ('placeholder_v3',  '1dad | Solfège',                          'Singapore',                        'APAC',  316572,  2467,  2444,  true, 3),
  ('placeholder_v4',  'Cointelegraph Decentralization Guardians','Asia/Tokyo',                       'APAC',  297461,  2286,  2231,  true, 4),
  ('placeholder_v5',  'Lantern',                                 'Singapore',                        'APAC',  265298,  842,   2200,  true, 5),
  ('placeholder_v6',  'YIELD',                                   'São Paulo',                        'LATAM', 259060,  14946, 16966, true, 6),
  ('placeholder_v7',  'Digital Energy',                          'Asia/Singapore',                   'APAC',  251438,  5322,  5572,  true, 7),
  ('placeholder_v8',  'Radiants',                                'Asia/Singapore',                   'APAC',  249764,  15950, 13197, true, 8),
  ('placeholder_v9',  'StakeCraft',                              'Hong Kong',                        'APAC',  242481,  2182,  3315,  true, 9),
  ('placeholder_v10', 'Paragon',                                 'Asia/Hong_Kong',                   'APAC',  240225,  3797,  5439,  true, 10),
  ('placeholder_v11', 'Grid Systems',                            'Singapore',                       'APAC',  236398,  3793,  4017,  true, 11),
  ('placeholder_v12', 'Adrastea Validator',                      'Tsuen Wan',                        'APAC',  235955,  25622, 17226, true, 12),
  ('placeholder_v13', 'Magic Eden Validator',                    'Asia/Singapore',                   'APAC',  198234,  5584,  5671,  true, 13),
  ('placeholder_v14', 'Hyper',                                   'Querétaro City',                   'LATAM', 196650,  7509,  8536,  true, 14),
  ('placeholder_v15', 'MAS DeFi',                                'Mexico City',                      'LATAM', 195142,  7591,  8620,  true, 15),
  ('placeholder_v16', 'anarcheuz',                               'Asia/Singapore',                   'APAC',  193515,  3769,  4003,  true, 16),
  ('placeholder_v17', 'Paws 0% Fee/MEV',                         'Asia/Tokyo',                       'APAC',  193271,  2335,  2438,  true, 17),
  ('placeholder_v18', 'LumLabs',                                 'Asia/Singapore',                   'APAC',  193052,  5585,  5680,  true, 18),
  ('placeholder_v19', 'Pine Stake',                              'Osasco',                           'LATAM', 184547,  38447, 43543, true, 19),
  ('placeholder_v20', 'CeriumXYZ',                               'Beauharnois',                      'APAC',  180588,  2137,  2088,  true, 20),
  ('placeholder_v21', 'SolBlaze',                                'Asia/Singapore',                   'APAC',  177454,  4127,  3999,  true, 21),
  ('placeholder_v22', 'Valid Blocks',                            'Asia/Tokyo',                       'APAC',  163626,  2176,  2228,  true, 22),
  ('placeholder_v23', 'Jaguar',                                  'São Paulo',                        'LATAM', 163089,  36878, 40126, true, 23),
  ('placeholder_v24', 'LootGo',                                  'Singapore',                       'APAC',  157253,  2348,  2320,  true, 24),
  ('placeholder_v25', 'Daiko',                                   'Singapore',                       'APAC',  155658,  2344,  2352,  true, 25),
  ('placeholder_v26', 'Decentra',                                'Tsuen Wan',                        'APAC',  149052,  28854, 19523, true, 26),
  ('placeholder_v27', 'The Chimpions',                           'Asia/Singapore',                   'APAC',  147880,  5589,  5689,  true, 27),
  ('placeholder_v28', 'Simpdigit',                               'Singapore',                       'APAC',  146392,  3752,  2453,  true, 28),
  ('placeholder_v29', 'Step Finance',                            'Singapore',                       'APAC',  143394,  3695,  4010,  true, 29),
  ('placeholder_v30', 'DataHive AI | Airdrop | 0% fee | full MEV','Singapore',                      'APAC',  141885,  847,   1915,  true, 30),
  ('placeholder_v31', 'Ded Monkes',                              'São Paulo',                        'LATAM', 132976,  15522, 16988, true, 31),
  ('placeholder_v32', 'Latitude.sh',                             'São Paulo',                        'LATAM', 131082,  38092, 43952, true, 32),
  ('placeholder_v33', 'The Library',                             'Singapore',                       'APAC',  127509,  5462,  5558,  true, 33),
  ('placeholder_v34', 'AVNU',                                    'Tokyo',                            'APAC',  125639,  15831, 13157, true, 34),
  ('placeholder_v35', 'Project Super',                           'São Paulo',                        'LATAM', 125362,  9116,  12595, true, 35),
  ('placeholder_v36', 'Suzuko Stake',                            'São Paulo',                        'LATAM', 124618,  11785, 13316, true, 36),
  ('placeholder_v37', 'Stake.Cake',                              'Tokyo',                            'APAC',  124308,  2179,  2236,  true, 37),
  ('placeholder_v38', 'Moonlet',                                 'Asia/Tokyo',                       'APAC',  121832,  851,   1900,  true, 38),
  ('placeholder_v39', 'SolanaBull',                              'Tokyo',                            'APAC',  121066,  3951,  3771,  true, 39),
  ('placeholder_v40', 'kuma validator kumaSOL LST',              'Minamishinagawa',                  'APAC',  117106,  3809,  4078,  true, 40),
  ('placeholder_v41', 'Windfall',                                'Asia/Hong_Kong',                   'APAC',  115481,  2326,  3476,  true, 41),
  ('placeholder_v42', 'Nova Consortium',                         'Tsuen Wan',                        'APAC',  100291,  11231, 5768,  true, 42),
  ('placeholder_v43', 'Somos Validator',                         'Asia/Singapore',                   'APAC',  94774,   17520, 14722, true, 43),
  ('placeholder_v44', 'Mesh Validator',                          'Singapore',                       'APAC',  93286,   3733,  4007,  true, 44),
  ('placeholder_v45', 'Solana Japan Validator',                  'Singapore',                       'APAC',  90934,   2735,  3802,  true, 45),
  ('placeholder_v46', 'Solana Portugal',                         'Tsuen Wan',                        'APAC',  87025,   11244, 5433,  true, 46),
  ('placeholder_v47', 'xLabs',                                   'Buenos Aires',                     'LATAM', 84288,   10667, 12137, true, 47),
  ('placeholder_v48', 'Mythx',                                   'Singapore',                       'APAC',  84104,   5473,  5555,  true, 48),
  ('placeholder_v49', 'Kisetsu Stake',                           'Asia/Singapore',                   'APAC',  82833,   3804,  4014,  true, 49),
  ('placeholder_v50', 'Epoch.Day',                               'São Paulo',                        'LATAM', 82702,   11779, 13303, true, 50),
  ('placeholder_v51', 'Vybe Validator',                          'Asia/Singapore',                   'APAC',  82482,   3834,  3660,  true, 51),
  ('placeholder_v52', 'Hydex',                                   'Tsuen Wan',                        'APAC',  82017,   7903,  3464,  true, 52),
  ('placeholder_v53', 'Guardian Validator',                      'Frankfurt am Main',                'APAC',  81754,   18648, 7079,  true, 53),
  ('placeholder_v54', 'Gojira',                                  'Tokyo',                            'APAC',  80093,   2172,  2126,  true, 54),
  ('placeholder_v55', 'Pine Analytics',                          'Mexico City',                      'LATAM', 79869,   15583, 16981, true, 55),
  ('placeholder_v56', 'soltop.sh',                               'São Paulo',                        'LATAM', 79612,   11035, 13206, true, 56),
  ('placeholder_v57', 'Yield Lab',                               'São Paulo',                        'LATAM', 75916,   10841, 16971, true, 57),
  ('placeholder_v58', 'Odyssey',                                 'Tsuen Wan',                        'APAC',  72567,   11286, 5745,  true, 58),
  ('placeholder_v59', 'Gotas',                                   'São Paulo',                        'LATAM', 71966,   11435, 16963, true, 59),
  ('placeholder_v60', 'Citizen Node',                            'Singapore',                       'APAC',  71095,   5461,  5548,  true, 60),
  ('placeholder_v61', 'Vandal',                                  'Mexico City',                      'LATAM', 70873,   12379, 13345, true, 61),
  ('placeholder_v62', 'Unruggable',                              'Asia/Singapore',                   'APAC',  70789,   3761,  4004,  true, 62),
  ('placeholder_v63', 'Blue Sky',                                'Asia/Singapore',                   'APAC',  70675,   3814,  4038,  true, 63),
  ('placeholder_v64', 'Portals',                                 'Asia/Singapore',                   'APAC',  68687,   7143,  7109,  true, 64),
  ('placeholder_v65', 'Mellow Yellow',                           'Asia/Singapore',                   'APAC',  68191,   3817,  4022,  true, 65),
  ('placeholder_v66', 'Famous Foxes',                            'São Paulo',                        'LATAM', 68079,   15119, 12957, true, 66),
  ('placeholder_v67', 'Gleam',                                   'Asia/Singapore',                   'APAC',  67658,   5503,  5555,  true, 67),
  ('placeholder_v68', 'Luminal',                                 'Querétaro City',                   'LATAM', 66925,   11117, 12643, true, 68),
  ('placeholder_v69', 'Cloak',                                   'São Paulo',                        'LATAM', 66914,   18061, 20552, true, 69),
  ('placeholder_v70', 'Charity Soul',                            'Tsuen Wan',                        'APAC',  63998,   11323, 5767,  true, 70),
  ('placeholder_v71', 'Systems',                                 'Asia/Singapore',                   'APAC',  63840,   5482,  5564,  true, 71),
  ('placeholder_v72', 'Exchange Art Validator',                  'Asia/Singapore',                   'APAC',  62111,   5472,  5557,  true, 72),
  ('placeholder_v73', 'The Mindfolk',                            'São Paulo',                        'LATAM', 61375,   15364, 16958, true, 73),
  ('placeholder_v74', 'Telemetry',                               'Asia/Singapore',                   'APAC',  59414,   2339,  2319,  true, 74),
  ('placeholder_v75', 'ABREU Foundation',                        'São Paulo',                        'LATAM', 57014,   18048, 20595, true, 75),
  ('placeholder_v76', 'Raposa Coffee',                           'Asia/Singapore',                   'APAC',  56920,   1478,  3845,  true, 76),
  ('placeholder_v77', 'mallow',                                  'Asia/Singapore',                   'APAC',  55661,   3983,  3836,  true, 77),
  ('placeholder_v78', 'Superteam Brazil',                        'São Paulo',                        'LATAM', 50447,   13727, 20615, true, 78),
  ('placeholder_v79', 'Hubra',                                   'Singapore',                       'APAC',  49291,   3829,  3670,  true, 79),
  ('placeholder_v80', 'Nomis',                                   'Asia/Hong_Kong',                   'APAC',  47515,   3810,  5459,  true, 80),
  ('placeholder_v81', 'GUIDES',                                  'Asia/Singapore',                   'APAC',  46102,   5480,  5566,  true, 81),
  ('placeholder_v82', 'Speedlanding Validator',                  'Tokyo',                            'APAC',  42676,   2245,  2213,  true, 82),
  ('placeholder_v83', 'ReFi Hub',                                'America/Argentina/Buenos_Aires',   'LATAM', 39751,   18545, 20574, true, 83),
  ('placeholder_v84', 'South African Community Validator',       'Isando',                           'ZA',    39301,   12347, 0,     true, 84),
  ('placeholder_v85', 'Kyzzen',                                  'Asia/Tokyo',                       'APAC',  38399,   845,   1884,  true, 85),
  ('placeholder_v86', 'ILY Validator + Firedancer (neochibi)',   'Minamishinagawa',                  'APAC',  37932,   3803,  4027,  true, 86),
  ('placeholder_v87', 'SkipLine',                                'Los Angeles',                      'APAC',  32824,   2111,  2120,  true, 87),
  ('placeholder_v88', 'SteakStache',                             'São Paulo',                        'LATAM', 32356,   7486,  8564,  true, 88)
on conflict (vote_account) do nothing;

-- ========================================================================
-- §00011_security_hardening.sql
-- ========================================================================
-- Security hardening from Supabase advisor findings:
-- 1. Recreate views with SECURITY INVOKER (was SECURITY DEFINER by default — ERROR-level lint)
-- 2. Pin search_path on set_updated_at (mutable search_path warning)
-- 3. Revoke RPC execute from anon/PUBLIC; only authenticated should call them

drop view if exists public.user_leaderboard cascade;
drop view if exists public.validator_leaderboard cascade;

create view public.user_leaderboard
with (security_invoker = true)
as
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

create view public.validator_leaderboard
with (security_invoker = true)
as
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

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin new.updated_at = now(); return new; end;
$$;

revoke execute on function public.lock_validator(uuid) from public;
revoke execute on function public.lock_validator(uuid) from anon;
revoke execute on function public.submit_group_prediction(uuid, text, text, text) from public;
revoke execute on function public.submit_group_prediction(uuid, text, text, text) from anon;
revoke execute on function public.submit_match_prediction(uuid, text, int, int) from public;
revoke execute on function public.submit_match_prediction(uuid, text, int, int) from anon;

-- ========================================================================
-- §00012_validator_vote_accounts_and_logos.sql
-- ========================================================================
-- Update validators with real vote_accounts + logo URLs from jagpool.xyz/pool
-- Scraped 2026-05-26. Matching by display_order (both lists sorted by total_stake desc).

update public.validators set vote_account = 'Ha1VoTEPWFQp1wZjbQhBNXJftuHvimu1ruzF3xKYRPDQ', logo_url = 'https://dub.sh/Vuvt6Gi' where display_order = 1;
update public.validators set vote_account = 'hy1oJTV2kX9acsqpwk7hbteqXFw9VDbWvbxoamFEufW', logo_url = 'https://i.ibb.co/C3VRH9Gs/hylo.jpg' where display_order = 2;
update public.validators set vote_account = '1Dadio3JRvpEjY6iSmXmhbGy9RiU8Nxh2GmoVbNusbE', logo_url = 'https://i.ibb.co/xSLWMhv6/logo.png' where display_order = 3;
update public.validators set vote_account = 'CTDGxxJBrZVqUUHdHopLn4k4gtc2PCpcM9TB7ZEC4Hu2', logo_url = 'https://i.ibb.co/W4rHz7mS/logo-avatar.webp' where display_order = 4;
update public.validators set vote_account = 'FACqsS19VScz8oo2YhdMg35EsAy6xsCZ9Y58eJXGv8QJ', logo_url = 'https://arweave.net/pm7V8BwNvQmLvwT1uYC5m-MoWITGF3O5Q24NZm9p284' where display_order = 5;
update public.validators set vote_account = 'phz34EcgWRCT9otPzRS2JtSzVHxQJk4SovqJvV1TQk8', logo_url = 'https://gateway.irys.xyz/95w57DCN9ed943ZbAo3GkjPbYL2pa63GqKaBJHdPMnGg' where display_order = 6;
update public.validators set vote_account = '86Sw9R6ynPmXnHfwUWinXtq1QoF2KHesfQQyZG5r8sXo', logo_url = 'https://tinyurl.com/3jx8m3e9' where display_order = 7;
update public.validators set vote_account = 'radYEig9KGrMTMWbWRFV7LStotQbnLgPaEFHVDsudQz', logo_url = 'https://www.radiant.nexus/apple-touch-icon.png' where display_order = 8;
update public.validators set vote_account = 'BDn3HiXMTym7ZQofWFxDb7ZGQX6GomQzJYKfytTAqd5g', logo_url = 'https://shorturl.at/3E6e2' where display_order = 9;
update public.validators set vote_account = 'VotESBSkLKU8vebS6wTR2rzWWJsLc6YThYS6tebPxXq', logo_url = 'https://www.paragon.gdn/logo.png' where display_order = 10;
update public.validators set vote_account = 'gridZ5cMHjWGktAQt6o36NtF7XSv19nJBrW83zmo7BM', logo_url = 'https://website-8mx.pages.dev/logo.jpg' where display_order = 11;
update public.validators set vote_account = 'adraBKLNY3DL3pg6SJRDYiMA8BsznaWpUdE42X41gbP', logo_url = 'https://pbs.twimg.com/profile_images/1734608542622236672/PzSwqj4J_400x400.jpg' where display_order = 12;
update public.validators set vote_account = 'magiCChVWbehZ1e3XqQfLh164yUfQ8LnRWgSP9i4oFp', logo_url = 'https://i.ibb.co/Nn1j8fdB/magiceden.png' where display_order = 13;
update public.validators set vote_account = 'DzQHN1oTdN85Sbku2bc9Fu9yEwrgRMiu2XbRcntZ31yb', logo_url = 'https://schempc.com/hostedsites/Hyper/hyper.png' where display_order = 14;
update public.validators set vote_account = 'masvNDXtxVVMrYSV84RMry97JyHXAFcdfTZJ5VzpSYR', logo_url = 'https://masdefi.io/logo.png' where display_order = 15;
update public.validators set vote_account = '57GUg9QH2LFMV11oaduuoqVJ5qHDEp7EGJ2xgkGiqAum', logo_url = 'https://toppng.com/uploads/preview/dragon-silhouette-11549438477lnnftegvag.png' where display_order = 16;
update public.validators set vote_account = '3ZUQekqiZoybB57y49eqtvSaoonqDwuNbeqEGwN88JkQ', logo_url = 'https://www.paws-validator.xyz/paws-360.png' where display_order = 17;
update public.validators set vote_account = '3Z1N2Fkfha4ThNiRwN8RnU6U8dkFJ92DH2TFyLWJf8cj', logo_url = 'https://res.cloudinary.com/davjm9683/image/upload/Validator_Icon_pn6tpw.png' where display_order = 18;
update public.validators set vote_account = 'PineDoC593nrX16W8ZLWfF5Evb6otv7fRfZMLjPAHe3', logo_url = 'https://pinestake.com/logo.png' where display_order = 19;
update public.validators set vote_account = 'Cer1umMkC6cvRGKKLP3QwxsdxsgxmC1EhqMhB1mqVvYZ', logo_url = 'https://avatars.githubusercontent.com/u/219765384?s=200&amp;v=4' where display_order = 20;
update public.validators set vote_account = 'SBLZib4npE7svxFA7AsD3ytdQAfYNb39c8zsU82AA2E', logo_url = 'https://solblaze.org/logo.png' where display_order = 21;
update public.validators set vote_account = '6hkfqeNAbURk7CmAQsP4Qm6WwHVF4LxHupEvQf7Tkrf1', logo_url = 'https://validblocks.com/touch-icon.png' where display_order = 22;
update public.validators set vote_account = 'jag77EXci8uf5uGmKE5izaYvxBCS5H9U2rxWYh8BUUf', logo_url = 'https://www.jagpool.xyz/images/jagSOL.webp' where display_order = 23;
update public.validators set vote_account = 'H6rbcwuQtadcv9JvxLM7GEskF6xFXnrNT3iPkk4RfyBE', logo_url = 'https://arweave.net/ET-SWvXDaz5I92J5h-oO5KE-E_-2cYf6nesRZbOaXfY' where display_order = 24;
update public.validators set vote_account = 'QWmexgr4teHa2ZF85tyf2hvEwBvJ6ioAEr1h8DRjoie', logo_url = 'https://arweave.net/0Xk9XZUNfj9_kv_q5YOy6HViYkLTKfua9QoDED833ZU' where display_order = 25;
update public.validators set vote_account = 'dcntrKBwh8j5yL62Eg96Z5QjJWv3UXxMu4rqL82w6Cb', logo_url = 'https://i.ibb.co/v6ZDhGL4/pfp-black.png' where display_order = 26;
update public.validators set vote_account = 'CHiaohVV2SQCFhiYP73iQzWT6HxnZqnAZJJqAYTeLAo', logo_url = 'https://pbs.twimg.com/profile_images/1587599356978499584/hMGpLXFx_400x400.jpg' where display_order = 27;
update public.validators set vote_account = 'Simpj3KyRQmpRkXuBvCQFS7DBBG6vqw93SkZb9UD1hp', logo_url = 'https://raw.githubusercontent.com/simpdigit/info/main/simpdigit_logo_012.png' where display_order = 28;
update public.validators set vote_account = 'StepeLdhJ2znRjHcZdjwMWsC4nTRURNKQY8Nca82LJp', logo_url = 'https://s3.amazonaws.com/keybase_processed_uploads/91868aefb0dbe77847d806a85d7b8305_360_360.jpg' where display_order = 29;
update public.validators set vote_account = '2ve7kgjvaDZhMPq2nXhvGLno8sPJ8BAEdCvza384PyC8', logo_url = 'https://storage.googleapis.com/datahive-public/datahive-logo.png' where display_order = 30;
update public.validators set vote_account = 'dedxrPfNqPKBRmUyP9LDkaitpQzU6PD44jA6GP9Ndhk', logo_url = 'https://i.ibb.co/ZdxPpDf/ded.png' where display_order = 31;
update public.validators set vote_account = 'AuBB9st3RqhHBkzZgBSm6SVnHZNJQSHeBWCSkik4bzdA', logo_url = 'https://www.delegate.so/images/latitude.png' where display_order = 32;
update public.validators set vote_account = 'bookLxG3LkSmt4htJ1x9zPw6E34RRMAi7sUn5mM3CNN', logo_url = 'https://node1.irys.xyz/-T5dx86NquUuKkfIrpYJbWMQbGFpC4h9b9GA2hEC_C4' where display_order = 33;
update public.validators set vote_account = 'avnu2RYyQbLL4LQnwi7ismwDNaegnXeUEzvZb2FUptF', logo_url = 'https://app.avnu.fi/web-app-manifest-512x512.png' where display_order = 34;
update public.validators set vote_account = 'EfnywDKqArxK6N6FS9ctsuzNdxfx3pzfXEQE5EevQ1SV', logo_url = 'https://www.project-super.com/supergradientpurppink.png' where display_order = 35;
update public.validators set vote_account = 'hxVjzDmta9TuN1gM981TRKnfwG2uZ9TQDGwSCs3uDow', logo_url = 'https://gateway.irys.xyz/3e7JYbe7rXqEwD57d6GyyCvsmgFQxyu5qw7SAJDFrz8h' where display_order = 36;
update public.validators set vote_account = 'o27rnqfNHPwHsRp2xPXXwWzn2q2dGxn6UD4Rt5KMU5h', logo_url = 'https://i.postimg.cc/QxzSTYbT/stake-cake-icon.jpg' where display_order = 37;
update public.validators set vote_account = 'GMpKrAwQ9oa4sJqEYQezLr8Z2TUAU72tXD4iMyfoJjbh', logo_url = 'https://s3.amazonaws.com/keybase_processed_uploads/b611bb0315d965e54c631c8e67d36d05_360_360.jpg' where display_order = 38;
update public.validators set vote_account = 'FLCrbfbwEhFARa8nK9rnZw8BVtKNAuHujh9EhWy5A4U4', logo_url = 'https://solanabull.pro/myicon.png' where display_order = 39;
update public.validators set vote_account = '4m1PbxzwLdUnEwog3T9UKxgjktgriHgE1CfAhMqDw7Xx', logo_url = 'https://arweave.net/4HJbrTM3kP89pb2VD8Kq8b5bc6nw110vLqw3yLEj77o' where display_order = 40;
update public.validators set vote_account = 'EJHf5N9is5spAF5Kz384tTvTV3CwTka6qzUoZrYm53SV', logo_url = 'https://lp.windfall.games/windfall_360.png' where display_order = 41;
update public.validators set vote_account = 'novaoLcuVHSudkW3Cphuhiv82vspN5qzinGCtEbwQxz', logo_url = 'https://ibb.co/JW23TZMV' where display_order = 42;
update public.validators set vote_account = 'axyQeKp44XqUnvC1jVHoeuAJ3j8wVnGeWtddeAcNYcF', logo_url = 'https://i.ibb.co/1rVVkN4/Screenshot-2024-12-21-at-8-05-14-AM.png' where display_order = 43;
update public.validators set vote_account = 'mesh3Px7WMi7Dkxke4ZZBULoKHM6sp37wKtg4DwPqPY', logo_url = 'https://node1.irys.xyz/wecqDPHaLvHCJkcoozRcu6vzkTLKxAULeIuk9TunOj4' where display_order = 44;
update public.validators set vote_account = '76DafWkJ6pGK2hoD41HjrM4xTBhfKqrDYDazv13n5ir1', logo_url = 'https://arweave.net/ifjpBZbaiieeDI7hIkVBpwNxaeaJxxYHzRpxJgsosf8' where display_order = 45;
update public.validators set vote_account = 'STPTPuWoyKzbWawom5DBndxkeRFAjW4PzJ2EjL1qeMW', logo_url = 'https://pbs.twimg.com/profile_images/1840703109128937472/UvHnvoKu_400x400.jpg' where display_order = 46;
update public.validators set vote_account = 'xLabsqDpN9WHXEXSJXk1yhqh5H8BgcqiBP1CR6Mkjcb', logo_url = 'https://xlabs.xyz/xlabs-icon.png' where display_order = 47;
update public.validators set vote_account = 'mythxna3hpzXSbaseyR12vu5Vvym1HxS92eCgXLvY7w', logo_url = 'https://arweave.net/XdF-sAXTUoSrm4e0lletM01K5ttnI1R_HyFOWBGH6XQ' where display_order = 48;
update public.validators set vote_account = 'fuyugZxM5S4NyV3ZYoc6ebs3fmRTrZ3X27MKCFvHpVD', logo_url = 'https://i.ibb.co/LtM1zVg/kisetsu.png' where display_order = 49;
update public.validators set vote_account = 'nateBZg7oHVPLB2samBLkKvfzedU3ALZBexMFPMKjn1', logo_url = 'https://i.ibb.co/xStTh905/Epoch-Day-logo.png' where display_order = 50;
update public.validators set vote_account = '6oscGUEkXE8fyWoC4czRKbM1cuLkJNtgRsX1Un6w88Vf', logo_url = 'https://static.vybenetwork.com/validator-icon.png' where display_order = 51;
update public.validators set vote_account = 'sTach38ebT8jnGH8i2D1g8NDAS6An19whVMnSSWPXt4', logo_url = 'https://gateway.irys.xyz/5DvRLgq8YMyPiUmkf2wj7opQakdE1jt4jaH9o3GbPgqE' where display_order = 52;
update public.validators set vote_account = 'gVot34jauJpexBL2YUSPBKsmZ4V2ffmDcRk4yfSEnx8', logo_url = 'https://raw.githubusercontent.com/Guardian-Validator/public-files/main/gv.png' where display_order = 53;
update public.validators set vote_account = 'goJiRADNdmfnJ4iWEyft7KaYMPTVsRba2Ee1akDEBXb', logo_url = 'https://i.ibb.co/9tk2Pc5/gojira.png' where display_order = 54;
update public.validators set vote_account = 'pine9rHVDS1pjwdhYkx3vRyaAyRd5KPDKXZEXAqvxcX', logo_url = 'https://i.ibb.co/Q37PsY6r/pine-Analytics.png' where display_order = 55;
update public.validators set vote_account = 'sfo5vA1fFdPRsvqd8qdePtTnK97Qj6Jj3GupEzmNPjJ', logo_url = 'https://soltop.sh/public/full-logo.png' where display_order = 56;
update public.validators set vote_account = 'Defi89YpAhk3Gst1Jpsi3Nhj7yCu5HropESh37SQ2v9g', logo_url = 'https://i.imgur.com/gJnQkAW.jpeg' where display_order = 57;
update public.validators set vote_account = 'odc2aCE7yWTcV8ApP1cHmVqQZTkLNduqaYyKE1XhpE3', logo_url = 'https://i.ibb.co/zHFMvzRL/ODYSSET-CAPITAL-PFP-3.png' where display_order = 58;
update public.validators set vote_account = 'Gotas1PRPrkqqSNm1ZKcn8Tpx9qL8krSQzTZ5DPKzkFX', logo_url = 'https://pbs.twimg.com/profile_images/1891920539582640129/45X1IkMy_400x400.png' where display_order = 59;
update public.validators set vote_account = 'CtzNnqzSLwNtkzi2yEWvq4w3GYQ5gSpCagqFZ5TbdSKb', logo_url = 'https://i.ibb.co/zV6ZkWzy/citizennodebluelogo.png' where display_order = 60;
update public.validators set vote_account = 'vnd1jskPHR2gfMtgTtq6xCwANrAiNbQTKgVBAJHnMke', logo_url = 'https://i.ibb.co/9mZ3WXxv/vandal.jpg' where display_order = 61;
update public.validators set vote_account = 'unRgBLTLNXdBmenHXNPAg3AMn3KWcV3Mk4eoZBmTrdk', logo_url = 'https://i.ibb.co/n8rtNcjD/unruggable.png' where display_order = 62;
update public.validators set vote_account = 'b1uei1YN8YVb3qHy2JitBx4Fq9nAatLQFcNbnk6Ex8p', logo_url = 'https://i.ibb.co/Z6dHCFCW/bluesky.png' where display_order = 63;
update public.validators set vote_account = 'prt1s9dMM15LdsUX9HugajzqPB5WVN8a2mw3frAiCfj', logo_url = 'https://i.ibb.co/20nkJX9G/portals.jpg' where display_order = 64;
update public.validators set vote_account = 'YE111yizdzBA7JQKMXjy9VSx1shKAczUbs3b3e6vKQH', logo_url = 'https://i.ibb.co/99M6tmtN/mellowyellow.png' where display_order = 65;
update public.validators set vote_account = 'FoXyNdpkiQBsWgrYER43PcZ5rcpzMk8jGxN3NyEx5dmB', logo_url = 'https://i.ibb.co/C5HGdWdq/Foxes.jpg' where display_order = 66;
update public.validators set vote_account = 'G1EAMrJcvzs5SwqAQRgDTjYBEGrxxJVwNS7qiUtB3akg', logo_url = 'https://i.ibb.co/Bpgnvp9/gleam.png' where display_order = 67;
update public.validators set vote_account = 'LunarE7WQyxpPwKo2hkEZZquu6UDWMNjvf3JyzGmdfp', logo_url = 'https://luminal-solana.s3.us-east-1.amazonaws.com/logo.png' where display_order = 68;
update public.validators set vote_account = 'CarbnAxSfvsBdp6otKtoUa8XmUaX9PcsGq6R2WqZMuw2', logo_url = 'http://www.cloak.ag/logo.png' where display_order = 69;
update public.validators set vote_account = 'chrtyiAw8suFRvS7rTcfgcDyNu49bGPNZ2fjSPzNPFr', logo_url = 'https://i.ibb.co/WkSH759/image.png' where display_order = 70;
update public.validators set vote_account = 'adrePWHJJQNNuMfK3QrBKXDZZuRFPRjhovMMeSr3Drz', logo_url = 'https://gateway.irys.xyz/5fnMTb9h1QtU2hF9GaaqtNU4k1M1ynuCV7t3gSFcvFen' where display_order = 71;
update public.validators set vote_account = 'ExCHgw3CfdZTbsrDA2phe95jswV2bDr5oSJwyKJKzEdN', logo_url = 'https://i.ibb.co/LdV3wWJw/exchangeart.png' where display_order = 72;
update public.validators set vote_account = 'MFLKX9vSfWXa4ZcVVpp4GF64ZbNUiX9EjSqtqNMdFXB', logo_url = 'https://i.ibb.co/jtBWZ8F/mindfolk-logo.jpg' where display_order = 73;
update public.validators set vote_account = 'te1exfYnykh2cFGCwGSLQu26Dpr8n2PozvBqH5Eoi3K', logo_url = 'https://i.ibb.co/CK9g4rFT/telemetry.jpg' where display_order = 74;
update public.validators set vote_account = 'ABREUtpzkkMiPHrBebpsYDU3mubtSohjDKZbyRoTJLae', logo_url = 'https://i.imgur.com/zh8zzpv.jpeg' where display_order = 75;
update public.validators set vote_account = 'rapxbkwBSSvtqRFrsY83f51oUuZNuVXci74MuzYhiCy', logo_url = 'https://i.ibb.co/9vw81YV/raposa-Logo.png' where display_order = 76;
update public.validators set vote_account = 'mALLoAbdQrgsnm7kWJyPrhcQcmxfT73t8DaqEkpZNd6', logo_url = 'https://mallow.art/favicon-128x128.png' where display_order = 77;
update public.validators set vote_account = 'STBRgoYTmMwukhcBVjGpg3A4R9HBsrWo82wJgiBukaW', logo_url = 'https://i.imgur.com/gjtwSLR.jpeg' where display_order = 78;
update public.validators set vote_account = '7K8DVxtNJGnMtUY1CQJT5jcs8sFGSZTDiG7kowvFpECh', logo_url = 'https://tinyurl.com/hubra-logo' where display_order = 79;
update public.validators set vote_account = 'noMiSdYbNQmFDrH2qMvYRXXzb5DUvjyPyDkXadzAPUV', logo_url = 'https://cdn.nomis.cc/img/logo-icon-square-gradient.png' where display_order = 80;
update public.validators set vote_account = 'wetwJSUHT5afX3gP49q75gkz8FcCfvsw2kuSQ1UjT9R', logo_url = 'https://gateway.irys.xyz/5xXCy3n1Xn81wjjHHYE4F1NyTyt4U9az4knajn5SFrgU' where display_order = 81;
update public.validators set vote_account = 'H1SztaSNXFAYGRS7tL4APK7b6XmpXSx6L5C8h2YGtXnD', logo_url = 'https://speedlanding.trade/logos/333.png' where display_order = 82;
update public.validators set vote_account = 'ReFiSbuMcV8PMYcpvm9RmHDhF9HR3qyxsHZgf359NUx', logo_url = 'https://i.ibb.co/4zGhtPW/refihub.png' where display_order = 83;
update public.validators set vote_account = 'stsaYQJUhKZDHSqndGtgo6jgbhVaHBSHhtfVWxCwrhD', logo_url = 'https://vectorflags.s3.amazonaws.com/flags/za-square-01.png' where display_order = 84;
update public.validators set vote_account = 'kyvvvkDpDCtSxQMPhzRhmv14DgUBVEGGzn8Dnb8ircP', logo_url = 'https://creator-portal-bucket.s3.us-east-2.amazonaws.com/Kyzzen_Logo.png' where display_order = 85;
update public.validators set vote_account = 'DG6fVEB2Qy1jntvHVPui3R12CMqcwNNnjYPYdsbQ9ACP', logo_url = 'https://miladymaker.net/milady/2841.png' where display_order = 86;
update public.validators set vote_account = 'sdo2QoiSsPknraeCts5GeBkV3AYDdtuxJ3VpYCS1CxR', logo_url = 'https://i.ibb.co/nND1660g/skipline-primary-logo.png' where display_order = 87;
update public.validators set vote_account = 'sT34kbaqmHWbPwjhyeG1GnjoX82KpXawFsnzUkzJpYX', logo_url = 'https://steakstache.com/assets/images/logo.png' where display_order = 88;
-- ========================================================================
-- §00013_siws_challenges_store_message.sql
-- ========================================================================
-- Store the SIWS message text we sent to the client so the verify endpoint
-- can re-verify against the exact bytes — avoids ISO/Postgres timestamp
-- formatting drift that broke signature verification.

alter table public.siws_challenges add column if not exists message text;

-- ========================================================================
-- §00014_user_leaderboard_logo.sql
-- ========================================================================
-- Add validator_logo_url to user_leaderboard view so the UI can render the
-- user's chosen validator logo next to their ranking row.

drop view if exists public.user_leaderboard cascade;

create view public.user_leaderboard
with (security_invoker = true)
as
select
  u.id as user_id,
  u.username,
  u.wallet_address,
  u.validator_id,
  v.name as validator_name,
  v.logo_url as validator_logo_url,
  coalesce(sum(s.points), 0) as total_points,
  count(s.id) as score_events
from public.users u
left join public.validators v on v.id = u.validator_id
left join public.scores s on s.user_id = u.id
where u.validator_locked_at is not null
group by u.id, u.username, u.wallet_address, u.validator_id, v.name, v.logo_url;

grant select on public.user_leaderboard to anon, authenticated;

-- ========================================================================
-- §00015_rls_user_column_restriction.sql
-- ========================================================================
-- SECURITY FIX: previous users_self_update policy let users update ANY column
-- on their own row, including is_admin, validator_id, validator_locked_at.
-- A logged-in user could promote themselves to admin via the anon Supabase client.
-- Restrict authenticated users to only updating `username`. All other mutations
-- (validator selection, JagSOL balance, admin flag) route through SECURITY DEFINER
-- RPCs or service-role writes.

drop policy if exists users_self_update on public.users;

revoke update on public.users from authenticated;
grant update (username) on public.users to authenticated;

create policy users_self_update on public.users
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ========================================================================
-- §00016_rpc_hardening.sql
-- ========================================================================
-- RPC hardening from review:
-- 1. lock_validator: check user row exists (not just validator_locked_at null)
-- 2. submit_match_prediction: require user to have completed onboarding
-- 3. submit_group_prediction: require user to have completed onboarding

create or replace function public.lock_validator(p_validator_id uuid)
returns public.users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.users;
  v_validator_active boolean;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  select is_active into v_validator_active from public.validators where id = p_validator_id;
  if not coalesce(v_validator_active, false) then
    raise exception 'validator not found or inactive';
  end if;

  select * into v_user from public.users where id = auth.uid();
  if v_user.id is null then
    raise exception 'user profile not found';
  end if;
  if v_user.validator_locked_at is not null then
    raise exception 'validator already locked';
  end if;

  update public.users
  set validator_id = p_validator_id, validator_locked_at = now()
  where id = auth.uid()
  returning * into v_user;

  return v_user;
end;
$$;

create or replace function public.submit_match_prediction(
  p_match_id uuid, p_winner text, p_home_score int default null, p_away_score int default null
)
returns public.match_predictions
language plpgsql
security definer
set search_path = public
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

  insert into public.match_predictions (user_id, match_id, winner, home_score, away_score)
  values (auth.uid(), p_match_id, p_winner, p_home_score, p_away_score)
  on conflict (user_id, match_id)
  do update set winner = excluded.winner, home_score = excluded.home_score, away_score = excluded.away_score, updated_at = now()
  returning * into v_pred;

  return v_pred;
end;
$$;

create or replace function public.submit_group_prediction(
  p_tournament_id uuid, p_group_name text, p_team_1 text, p_team_2 text
)
returns public.group_predictions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pred public.group_predictions;
  v_lock_at timestamptz;
  v_user_locked timestamptz;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_team_1 = p_team_2 then raise exception 'teams must be different'; end if;

  select validator_locked_at into v_user_locked from public.users where id = auth.uid();
  if v_user_locked is null then raise exception 'must complete onboarding'; end if;

  select group_lock_at into v_lock_at from public.tournaments where id = p_tournament_id;
  if v_lock_at is not null and now() > v_lock_at then raise exception 'group predictions are locked'; end if;

  insert into public.group_predictions (user_id, tournament_id, group_name, advancing_team_1, advancing_team_2)
  values (auth.uid(), p_tournament_id, p_group_name, p_team_1, p_team_2)
  on conflict (user_id, tournament_id, group_name)
  do update set advancing_team_1 = excluded.advancing_team_1, advancing_team_2 = excluded.advancing_team_2, updated_at = now()
  returning * into v_pred;

  if v_pred.locked then raise exception 'prediction already locked'; end if;
  return v_pred;
end;
$$;

revoke execute on function public.lock_validator(uuid) from public, anon;
revoke execute on function public.submit_group_prediction(uuid, text, text, text) from public, anon;
revoke execute on function public.submit_match_prediction(uuid, text, int, int) from public, anon;
grant execute on function public.lock_validator(uuid) to authenticated;
grant execute on function public.submit_group_prediction(uuid, text, text, text) to authenticated;
grant execute on function public.submit_match_prediction(uuid, text, int, int) to authenticated;

-- ========================================================================
-- §00017_atomic_lock_matches_and_validation.sql
-- ========================================================================
-- Atomic match-locking RPC (replaces the two-step approach in /api/cron/lock-matches)
-- and stronger group_name validation on submit_group_prediction.

create or replace function public.lock_overdue_matches()
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_locked_count int;
begin
  -- 1) Mark predictions locked for any match whose kickoff is within the next minute
  --    and isn't already locked. Idempotent.
  update public.match_predictions mp
  set locked = true
  where locked = false
    and exists (
      select 1 from public.matches m
      where m.id = mp.match_id
        and m.locked_at is null
        and m.kickoff_at <= now() + interval '1 minute'
    );

  -- 2) Mark the matches themselves locked. Only flips rows where locked_at is null
  --    so the timestamp doesn't drift on retry.
  update public.matches
  set locked_at = now(), status = 'locked'
  where locked_at is null
    and kickoff_at <= now() + interval '1 minute';
  get diagnostics v_locked_count = row_count;

  -- 3) Opportunistic cleanup of expired SIWS challenges
  delete from public.siws_challenges where expires_at < now();

  return v_locked_count;
end;
$$;

revoke execute on function public.lock_overdue_matches() from public, anon, authenticated;
-- Only service_role calls this (from the cron endpoint).

-- Tighten submit_group_prediction: validate group_name is A..L
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
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_team_1 = p_team_2 then raise exception 'teams must be different'; end if;
  if p_group_name !~ '^[A-L]$' then raise exception 'invalid group name'; end if;
  if length(trim(p_team_1)) = 0 or length(trim(p_team_2)) = 0 then
    raise exception 'team names cannot be empty';
  end if;

  select validator_locked_at into v_user_locked from public.users where id = auth.uid();
  if v_user_locked is null then raise exception 'must complete onboarding'; end if;

  select group_lock_at into v_lock_at from public.tournaments where id = p_tournament_id;
  if v_lock_at is not null and now() > v_lock_at then raise exception 'group predictions are locked'; end if;

  insert into public.group_predictions (user_id, tournament_id, group_name, advancing_team_1, advancing_team_2)
  values (auth.uid(), p_tournament_id, p_group_name, p_team_1, p_team_2)
  on conflict (user_id, tournament_id, group_name)
  do update set advancing_team_1 = excluded.advancing_team_1, advancing_team_2 = excluded.advancing_team_2, updated_at = now()
  returning * into v_pred;

  if v_pred.locked then raise exception 'prediction already locked'; end if;
  return v_pred;
end;
$$;

revoke execute on function public.submit_group_prediction(uuid, text, text, text) from public, anon;
grant execute on function public.submit_group_prediction(uuid, text, text, text) to authenticated;

-- ========================================================================
-- §00018_leaderboard_rpcs_lockdown_idempotency.sql
-- ========================================================================
-- =====================================================================
-- TIER 1 FIXES (Codex audit)
-- 1. Leaderboard RLS bug — views joined users (self-only RLS), so each user
--    saw only their own row. Replace views with SECURITY DEFINER RPCs that
--    return the global leaderboard safely.
-- 2. Prediction lock bypass — revoke direct insert/update on prediction
--    tables; force writes through RPCs (which check kickoff_at + onboarding).
-- 3. Scoring idempotency — add unique indexes on (prediction_id, reason)
--    so concurrent crons can't double-insert and rescoring is safe.
-- =====================================================================

-- 1) Leaderboard RPCs that bypass user RLS
create or replace function public.get_user_leaderboard(p_limit int default 50)
returns table (
  user_id uuid,
  username text,
  wallet_address text,
  validator_id uuid,
  validator_name text,
  validator_logo_url text,
  total_points bigint,
  score_events bigint
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    u.id, u.username, u.wallet_address,
    u.validator_id, v.name, v.logo_url,
    coalesce(sum(s.points)::bigint, 0),
    count(s.id)::bigint
  from public.users u
  left join public.validators v on v.id = u.validator_id
  left join public.scores s on s.user_id = u.id
  where u.validator_locked_at is not null
  group by u.id, u.username, u.wallet_address, u.validator_id, v.name, v.logo_url
  order by coalesce(sum(s.points), 0) desc, u.username asc
  limit p_limit;
$$;

grant execute on function public.get_user_leaderboard(int) to anon, authenticated;

create or replace function public.get_validator_leaderboard()
returns table (
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
set search_path = public, pg_temp
as $$
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
$$;

grant execute on function public.get_validator_leaderboard() to anon, authenticated, service_role;

-- Drop the broken views — they leaked nothing (only showed self) but they're misleading
drop view if exists public.user_leaderboard cascade;
drop view if exists public.validator_leaderboard cascade;

-- 2) Lock down direct writes on prediction tables. RPCs are the only path.
drop policy if exists group_predictions_self_insert on public.group_predictions;
drop policy if exists group_predictions_self_update on public.group_predictions;
drop policy if exists match_predictions_self_insert on public.match_predictions;
drop policy if exists match_predictions_self_update on public.match_predictions;

revoke insert, update, delete on public.group_predictions from anon, authenticated;
revoke insert, update, delete on public.match_predictions from anon, authenticated;
-- Keep SELECT for users to read their own predictions (existing policies cover that)

-- 3) Scoring idempotency
create unique index if not exists scores_match_pred_reason_uniq
  on public.scores (match_prediction_id, reason)
  where match_prediction_id is not null;

create unique index if not exists scores_group_pred_reason_uniq
  on public.scores (group_prediction_id, reason)
  where group_prediction_id is not null;

-- ========================================================================
-- §00019_domain_rpcs_and_scoring_v2.sql
-- ========================================================================
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

-- ========================================================================
-- §00020_reward_snapshots_and_helpers.sql
-- ========================================================================
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

-- ========================================================================
-- §00021_admin_domain_rpcs.sql
-- ========================================================================
-- =====================================================================
-- Admin domain RPCs: replace raw field patching with safe, audited actions.
-- =====================================================================

create or replace function public.set_validator_active(
  p_validator_id uuid,
  p_is_active boolean
)
returns public.validators
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_validator public.validators;
  v_admin boolean;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select coalesce(is_admin, false) into v_admin from public.users where id = auth.uid();
  if not v_admin then raise exception 'forbidden: admin only'; end if;

  update public.validators
  set is_active = p_is_active
  where id = p_validator_id
  returning * into v_validator;

  if v_validator.id is null then raise exception 'validator not found'; end if;

  insert into public.admin_audit_log (admin_user_id, action, target_table, target_id, changes)
  values (auth.uid(), 'set_validator_active', 'validators', p_validator_id,
    jsonb_build_object('is_active', p_is_active));

  return v_validator;
end;
$$;

revoke execute on function public.set_validator_active(uuid, boolean) from public, anon;
grant execute on function public.set_validator_active(uuid, boolean) to authenticated;

create or replace function public.set_user_admin(
  p_target_user_id uuid,
  p_is_admin boolean
)
returns public.users
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user public.users;
  v_caller_admin boolean;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select coalesce(is_admin, false) into v_caller_admin from public.users where id = auth.uid();
  if not v_caller_admin then raise exception 'forbidden: admin only'; end if;

  if p_target_user_id = auth.uid() and not p_is_admin then
    raise exception 'cannot revoke your own admin privileges';
  end if;

  update public.users
  set is_admin = p_is_admin
  where id = p_target_user_id
  returning * into v_user;

  if v_user.id is null then raise exception 'user not found'; end if;

  insert into public.admin_audit_log (admin_user_id, action, target_table, target_id, changes)
  values (auth.uid(), 'set_user_admin', 'users', p_target_user_id,
    jsonb_build_object('is_admin', p_is_admin));

  return v_user;
end;
$$;

revoke execute on function public.set_user_admin(uuid, boolean) from public, anon;
grant execute on function public.set_user_admin(uuid, boolean) to authenticated;

create or replace function public.list_users_admin(
  p_limit int default 50,
  p_offset int default 0,
  p_search text default null
)
returns table (
  id uuid,
  username text,
  wallet_address text,
  validator_id uuid,
  validator_name text,
  validator_locked_at timestamptz,
  jagsol_balance numeric,
  is_admin boolean,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin boolean;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select coalesce(u.is_admin, false) into v_admin from public.users u where u.id = auth.uid();
  if not v_admin then raise exception 'forbidden: admin only'; end if;

  return query
  select
    u.id, u.username, u.wallet_address, u.validator_id,
    v.name, u.validator_locked_at, u.jagsol_balance, u.is_admin, u.created_at
  from public.users u
  left join public.validators v on v.id = u.validator_id
  where p_search is null
     or u.username ilike '%' || p_search || '%'
     or u.wallet_address ilike '%' || p_search || '%'
  order by u.created_at desc
  limit p_limit offset p_offset;
end;
$$;

revoke execute on function public.list_users_admin(int, int, text) from public, anon;
grant execute on function public.list_users_admin(int, int, text) to authenticated;

-- ========================================================================
-- §00022_security_fixes_and_snapshot_status.sql
-- ========================================================================
-- =====================================================================
-- Audit-driven fixes:
-- 1. CRITICAL RLS leak: get_*_for_scoring RPCs were granted to `authenticated`
--    despite returning ALL users' predictions. Revoke and restrict to service_role.
-- 2. set_user_admin must require target user has completed onboarding.
-- 3. Add set_reward_snapshot_status RPC so admins can move draft→finalized→paid.
-- =====================================================================

revoke execute on function public.get_group_predictions_for_scoring(uuid, text) from public, anon, authenticated;
revoke execute on function public.get_champion_predictions_for_scoring(uuid) from public, anon, authenticated;

create or replace function public.set_user_admin(
  p_target_user_id uuid,
  p_is_admin boolean
)
returns public.users
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user public.users;
  v_caller_admin boolean;
  v_target_locked timestamptz;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select coalesce(is_admin, false) into v_caller_admin from public.users where id = auth.uid();
  if not v_caller_admin then raise exception 'forbidden: admin only'; end if;

  if p_target_user_id = auth.uid() and not p_is_admin then
    raise exception 'cannot revoke your own admin privileges';
  end if;

  select validator_locked_at into v_target_locked from public.users where id = p_target_user_id;
  if v_target_locked is null and p_is_admin then
    raise exception 'cannot grant admin to a user who has not completed onboarding';
  end if;

  update public.users
  set is_admin = p_is_admin
  where id = p_target_user_id
  returning * into v_user;

  if v_user.id is null then raise exception 'user not found'; end if;

  insert into public.admin_audit_log (admin_user_id, action, target_table, target_id, changes)
  values (auth.uid(), 'set_user_admin', 'users', p_target_user_id,
    jsonb_build_object('is_admin', p_is_admin));

  return v_user;
end;
$$;

revoke execute on function public.set_user_admin(uuid, boolean) from public, anon;
grant execute on function public.set_user_admin(uuid, boolean) to authenticated;

create or replace function public.set_reward_snapshot_status(
  p_snapshot_id uuid,
  p_status reward_snapshot_status
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

  update public.reward_snapshots
  set status = p_status
  where id = p_snapshot_id
  returning * into v_snapshot;

  if v_snapshot.id is null then raise exception 'snapshot not found'; end if;

  insert into public.admin_audit_log (admin_user_id, action, target_table, target_id, changes)
  values (auth.uid(), 'set_reward_snapshot_status', 'reward_snapshots', p_snapshot_id,
    jsonb_build_object('status', p_status));

  return v_snapshot;
end;
$$;

revoke execute on function public.set_reward_snapshot_status(uuid, reward_snapshot_status) from public, anon;
grant execute on function public.set_reward_snapshot_status(uuid, reward_snapshot_status) to authenticated;

-- ========================================================================
-- §00023_rls_initplan_optimization.sql
-- ========================================================================
-- =====================================================================
-- Perf optimization: wrap `auth.uid()` calls in `(select auth.uid())` so
-- Postgres evaluates them once per query instead of once per row.
-- Flagged by Supabase advisor `auth_rls_initplan`.
-- =====================================================================

-- USERS
drop policy if exists users_self_select on public.users;
create policy users_self_select on public.users
  for select using ((select auth.uid()) = id);

drop policy if exists users_self_update on public.users;
create policy users_self_update on public.users
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- GROUP PREDICTIONS
drop policy if exists group_predictions_self_select on public.group_predictions;
create policy group_predictions_self_select on public.group_predictions
  for select using ((select auth.uid()) = user_id);

drop policy if exists group_predictions_self_insert on public.group_predictions;
create policy group_predictions_self_insert on public.group_predictions
  for insert with check ((select auth.uid()) = user_id and not locked);

drop policy if exists group_predictions_self_update on public.group_predictions;
create policy group_predictions_self_update on public.group_predictions
  for update using ((select auth.uid()) = user_id and not locked)
  with check ((select auth.uid()) = user_id and not locked);

-- MATCH PREDICTIONS
drop policy if exists match_predictions_self_select on public.match_predictions;
create policy match_predictions_self_select on public.match_predictions
  for select using ((select auth.uid()) = user_id);

drop policy if exists match_predictions_self_insert on public.match_predictions;
create policy match_predictions_self_insert on public.match_predictions
  for insert with check ((select auth.uid()) = user_id and not locked);

drop policy if exists match_predictions_self_update on public.match_predictions;
create policy match_predictions_self_update on public.match_predictions
  for update using ((select auth.uid()) = user_id and not locked)
  with check ((select auth.uid()) = user_id and not locked);

-- CHAMPION PREDICTIONS
drop policy if exists champion_predictions_self_select on public.champion_predictions;
create policy champion_predictions_self_select on public.champion_predictions
  for select to authenticated using ((select auth.uid()) = user_id);

-- ========================================================================
-- §00024_codex_audit_critical_fixes.sql
-- ========================================================================
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

-- ========================================================================
-- §00025_codex_followup_audit.sql
-- ========================================================================
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

-- ========================================================================
-- §00026_filter_zero_point_snapshot_rows.sql
-- ========================================================================
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

-- ========================================================================
-- §00027_advancer_predictions.sql
-- ========================================================================
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
-- Returns ONE row per user, with their predicted advancer teams aggregated into
-- an array, so the result stays well under PostgREST's 1000-row response cap. A
-- per-(user,team) shape returned 2000+ rows and truncated at 1000, silently
-- dropping ~half the users from scoring (see migration 00032).
-- ---------------------------------------------------------------------
create or replace function public.get_advancer_predictions_for_scoring(
  p_tournament_id uuid
)
returns table (user_id uuid, teams text[])
language sql
security definer
set search_path = public, pg_temp
as $$
  select user_id, array_agg(distinct team_name) as teams
  from public.advancer_predictions
  where tournament_id = p_tournament_id
  group by user_id;
$$;
revoke execute on function public.get_advancer_predictions_for_scoring(uuid) from public, anon, authenticated;
grant execute on function public.get_advancer_predictions_for_scoring(uuid) to service_role;

-- Advancer scores have NULL prediction-FK columns, so the other unique indexes
-- don't cover them. This partial unique guard stops a re-run or stray insert from
-- duplicating a user's advancer points (see migration 00032).
create unique index if not exists scores_advancer_uniq
  on public.scores (user_id, tournament_id)
  where reason = 'advancer';

-- ========================================================================
-- §00028_knockout_winner_only_and_propagation.sql
-- ========================================================================
-- =====================================================================
-- Knockout rework:
-- 1. finalize_match accepts NULL scores (early rounds are winner-only) and
--    allows a level score on knockout matches (penalty shootouts) — the
--    winner is then the shootout winner, not a draw.
-- 2. Wire the third-place match's parent links to the two semis (the seed
--    left them null) so winner/loser propagation can route losers there.
-- =====================================================================

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
  v_is_group boolean;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select coalesce(is_admin, false) into v_admin from public.users where id = auth.uid();
  if not v_admin then raise exception 'forbidden: admin only'; end if;

  if p_winner not in ('home', 'away', 'draw') then
    raise exception 'invalid winner value';
  end if;

  select * into v_match from public.matches where id = p_match_id;
  if v_match.id is null then raise exception 'match not found'; end if;

  if p_home_score is not null and (p_home_score < 0 or p_home_score > 99) then
    raise exception 'invalid home score';
  end if;
  if p_away_score is not null and (p_away_score < 0 or p_away_score > 99) then
    raise exception 'invalid away score';
  end if;

  v_is_group := (v_match.stage = 'group');

  if v_is_group then
    -- Group stage: scores required, draw allowed, full score↔winner consistency.
    if p_home_score is null or p_away_score is null then
      raise exception 'group matches require both scores';
    end if;
    if p_winner = 'home' and not (p_home_score > p_away_score) then
      raise exception 'winner=home but home_score <= away_score';
    end if;
    if p_winner = 'away' and not (p_away_score > p_home_score) then
      raise exception 'winner=away but away_score <= home_score';
    end if;
    if p_winner = 'draw' and p_home_score <> p_away_score then
      raise exception 'winner=draw but scores differ';
    end if;
  else
    -- Knockout: no draws. Scores optional (early rounds are winner-only).
    -- When both scores are present and differ, the winner must match the
    -- higher side; equal scores are allowed (decided on penalties).
    if p_winner = 'draw' then
      raise exception 'knockout matches cannot end in draw';
    end if;
    if p_home_score is not null and p_away_score is not null then
      if p_home_score > p_away_score and p_winner <> 'home' then
        raise exception 'winner must be home when home_score > away_score';
      end if;
      if p_away_score > p_home_score and p_winner <> 'away' then
        raise exception 'winner must be away when away_score > home_score';
      end if;
    end if;
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

-- Third-place match feeds from the two semis (seed left its parent links null).
update public.matches tp
set parent_match_a = (
      select id from public.matches
      where tournament_id = tp.tournament_id and match_number = 101
    ),
    parent_match_b = (
      select id from public.matches
      where tournament_id = tp.tournament_id and match_number = 102
    )
where tp.stage = 'third_place'
  and (tp.parent_match_a is null or tp.parent_match_b is null);

-- ========================================================================
-- §00029_atomic_replace_scores.sql
-- ========================================================================
-- =====================================================================
-- Atomic score replacement. The TS scoring helpers (advancer, champion) did
-- a separate DELETE then INSERT — two round-trips with no transaction, so a
-- failure between them zeroed those scores until a manual re-run. This RPC
-- does both in one transaction. Service-role only (called by scoring code).
-- =====================================================================

create or replace function public.replace_scores(
  p_tournament_id uuid,
  p_reason text,
  p_rows jsonb
)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count int;
begin
  -- Guard (§00034): an empty advancer payload is never legitimate (advancers are
  -- a fixed 32-team slate), so treat it as a no-op instead of a destructive
  -- delete+insert that would zero every user's advancer points. Champion is NOT
  -- guarded: it can legitimately be empty (nobody picked the actual champion).
  if p_reason = 'advancer' and coalesce(jsonb_array_length(p_rows), 0) = 0 then
    return -1;
  end if;

  delete from public.scores
  where tournament_id = p_tournament_id and reason = p_reason;

  insert into public.scores (
    user_id, tournament_id, match_id, group_prediction_id,
    match_prediction_id, champion_prediction_user_id, points, reason
  )
  select
    (e->>'user_id')::uuid,
    p_tournament_id,
    nullif(e->>'match_id', '')::uuid,
    nullif(e->>'group_prediction_id', '')::uuid,
    nullif(e->>'match_prediction_id', '')::uuid,
    nullif(e->>'champion_prediction_user_id', '')::uuid,
    (e->>'points')::int,
    p_reason
  from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) e;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.replace_scores(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.replace_scores(uuid, text, jsonb) to service_role;

-- ========================================================================
-- §00030_x_identity.sql
-- ========================================================================
-- Verified X (Twitter) identity replaces the typed username. Wallet/SIWS stays
-- the sole login; X is linked via auth.linkIdentity and the @handle is stored
-- in `username` (so leaderboard/admin/snapshot RPCs are untouched). x_user_id is
-- the immutable, rename-proof link + one-account-per-X guard; x_avatar_url is
-- the profile photo. See CLAUDE.md "Gotchas" for the Supabase/X dashboard setup.

alter table public.users
  drop constraint if exists users_username_check;

alter table public.users
  add column if not exists x_user_id text unique,
  add column if not exists x_avatar_url text;

revoke update (username) on public.users from authenticated;

drop function if exists public.get_user_leaderboard(int);
create or replace function public.get_user_leaderboard(p_limit int default 50)
returns table (
  user_id uuid,
  username text,
  x_avatar_url text,
  wallet_address text,
  validator_id uuid,
  validator_name text,
  validator_logo_url text,
  total_points bigint,
  score_events bigint
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    u.id, u.username, u.x_avatar_url, u.wallet_address,
    u.validator_id, v.name, v.logo_url,
    coalesce(sum(s.points)::bigint, 0),
    count(s.id)::bigint
  from public.users u
  left join public.validators v on v.id = u.validator_id
  left join public.scores s on s.user_id = u.id
  where u.validator_locked_at is not null
  group by u.id, u.username, u.x_avatar_url, u.wallet_address, u.validator_id, v.name, v.logo_url
  order by coalesce(sum(s.points), 0) desc, u.username asc
  limit p_limit;
$$;

grant execute on function public.get_user_leaderboard(int) to anon, authenticated;

-- ========================================================================
-- §00031_delete_reward_snapshot.sql
-- ========================================================================
-- Admin deletes a reward snapshot (draft/finalized only — `paid` is a real
-- payout record). Cascades to reward_users + reward_validators. Audited.

create or replace function public.delete_reward_snapshot(p_snapshot_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status reward_snapshot_status;
  v_admin boolean;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select coalesce(is_admin, false) into v_admin from public.users where id = auth.uid();
  if not v_admin then raise exception 'forbidden: admin only'; end if;

  select status into v_status from public.reward_snapshots where id = p_snapshot_id;
  if v_status is null then raise exception 'snapshot not found'; end if;
  if v_status = 'paid' then raise exception 'cannot delete a paid snapshot'; end if;

  delete from public.reward_snapshots where id = p_snapshot_id;

  insert into public.admin_audit_log (admin_user_id, action, target_table, target_id, changes)
  values (auth.uid(), 'delete_reward_snapshot', 'reward_snapshots', p_snapshot_id,
    jsonb_build_object('status', v_status));
end;
$$;

revoke execute on function public.delete_reward_snapshot(uuid) from public, anon;
grant execute on function public.delete_reward_snapshot(uuid) to authenticated;

-- ========================================================================
-- §00033_lock_predictions_4h_before_kickoff.sql
-- Knockout match predictions lock 4 HOURS before kickoff (was: at kickoff).
-- ========================================================================
create or replace function public.submit_match_prediction(
  p_match_id uuid,
  p_winner text,
  p_home_score integer default null,
  p_away_score integer default null
)
returns match_predictions
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
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
  -- Lock the prediction window at kickoff.
  if v_match.locked_at is not null or now() >= v_match.kickoff_at then
    raise exception 'match prediction window is closed';
  end if;

  if v_match.stage = 'group' then
    raise exception 'group stage uses group_predictions, not match_predictions';
  end if;

  if p_winner = 'draw' then
    raise exception 'knockout matches cannot have draw predictions';
  end if;

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
  do update set winner = excluded.winner, home_score = excluded.home_score,
                away_score = excluded.away_score, updated_at = now()
  returning * into v_pred;

  return v_pred;
end;
$$;
revoke execute on function public.submit_match_prediction(uuid, text, int, int) from public, anon;
grant execute on function public.submit_match_prediction(uuid, text, int, int) to authenticated;

create or replace function public.lock_overdue_matches()
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_locked_count int;
begin
  update public.match_predictions mp
  set locked = true
  where locked = false
    and exists (
      select 1 from public.matches m
      where m.id = mp.match_id
        and m.locked_at is null
        and m.kickoff_at <= now()
    );

  update public.matches
  set locked_at = now(), status = 'locked'
  where locked_at is null
    and kickoff_at <= now();
  get diagnostics v_locked_count = row_count;

  delete from public.siws_challenges where expires_at < now();

  return v_locked_count;
end;
$$;
revoke execute on function public.lock_overdue_matches() from public, anon, authenticated;
