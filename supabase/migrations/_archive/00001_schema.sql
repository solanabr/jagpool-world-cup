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
