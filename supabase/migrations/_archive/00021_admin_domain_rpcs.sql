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
