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
