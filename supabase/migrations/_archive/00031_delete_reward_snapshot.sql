-- =====================================================================
-- 00031_delete_reward_snapshot.sql
-- Admin can delete reward snapshots — draft/finalized only, since a `paid`
-- snapshot is a real payout record. Deleting the snapshot cascades to
-- reward_users + reward_validators (both FK with on delete cascade). Audited,
-- like the other snapshot mutations.
-- =====================================================================

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
