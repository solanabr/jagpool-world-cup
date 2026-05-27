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
