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
