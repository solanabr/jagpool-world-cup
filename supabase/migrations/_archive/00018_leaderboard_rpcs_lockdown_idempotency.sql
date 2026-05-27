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
  total_points bigint
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    v.id, v.name, v.logo_url, v.vote_account,
    count(distinct u.id)::bigint,
    coalesce(sum(s.points)::bigint, 0)
  from public.validators v
  left join public.users u on u.validator_id = v.id and u.validator_locked_at is not null
  left join public.scores s on s.user_id = u.id
  where v.is_active
  group by v.id, v.name, v.logo_url, v.vote_account
  order by coalesce(sum(s.points), 0) desc, count(distinct u.id) desc;
$$;

grant execute on function public.get_validator_leaderboard() to anon, authenticated;

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
