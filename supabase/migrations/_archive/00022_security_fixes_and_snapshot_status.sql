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
