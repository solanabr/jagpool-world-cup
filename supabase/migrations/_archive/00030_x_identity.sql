-- =====================================================================
-- 00030_x_identity.sql
-- Verified X (Twitter) identity replaces the typed username.
--
-- Wallet/SIWS stays the sole login. X is linked to the existing session via
-- Supabase manual identity linking (auth.linkIdentity) and the @handle becomes
-- the display name. The handle is stored in the existing `username` column so
-- the leaderboard / admin / reward-snapshot RPCs keep working untouched. We add
-- the immutable X user id (the durable, rename-proof link + one-account-per-X
-- guard) and the avatar. Required Supabase/X dashboard setup lives in CLAUDE.md.
-- =====================================================================

-- `username` now holds an X handle (1-15 chars), so the old typed-username
-- 3-20 CHECK would reject valid handles. X is the source of truth for validity.
alter table public.users
  drop constraint if exists users_username_check;

alter table public.users
  add column if not exists x_user_id text unique,
  add column if not exists x_avatar_url text;

-- The handle is written server-side by the X sync (service role), never typed
-- by the user, so the self-service username update grant is no longer needed.
revoke update (username) on public.users from authenticated;

-- Surface the avatar alongside the handle (username) on the global leaderboard.
-- DROP first: adding x_avatar_url changes the return type, which CREATE OR
-- REPLACE cannot do.
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
