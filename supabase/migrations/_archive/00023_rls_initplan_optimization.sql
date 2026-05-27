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
