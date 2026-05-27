-- RPC hardening from review:
-- 1. lock_validator: check user row exists (not just validator_locked_at null)
-- 2. submit_match_prediction: require user to have completed onboarding
-- 3. submit_group_prediction: require user to have completed onboarding

create or replace function public.lock_validator(p_validator_id uuid)
returns public.users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.users;
  v_validator_active boolean;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  select is_active into v_validator_active from public.validators where id = p_validator_id;
  if not coalesce(v_validator_active, false) then
    raise exception 'validator not found or inactive';
  end if;

  select * into v_user from public.users where id = auth.uid();
  if v_user.id is null then
    raise exception 'user profile not found';
  end if;
  if v_user.validator_locked_at is not null then
    raise exception 'validator already locked';
  end if;

  update public.users
  set validator_id = p_validator_id, validator_locked_at = now()
  where id = auth.uid()
  returning * into v_user;

  return v_user;
end;
$$;

create or replace function public.submit_match_prediction(
  p_match_id uuid, p_winner text, p_home_score int default null, p_away_score int default null
)
returns public.match_predictions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pred public.match_predictions;
  v_match public.matches;
  v_user_locked timestamptz;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_winner not in ('home','away','draw') then raise exception 'invalid winner'; end if;

  select validator_locked_at into v_user_locked from public.users where id = auth.uid();
  if v_user_locked is null then raise exception 'must complete onboarding'; end if;

  select * into v_match from public.matches where id = p_match_id;
  if v_match.id is null then raise exception 'match not found'; end if;
  if v_match.locked_at is not null or now() >= v_match.kickoff_at then
    raise exception 'match prediction window is closed';
  end if;

  insert into public.match_predictions (user_id, match_id, winner, home_score, away_score)
  values (auth.uid(), p_match_id, p_winner, p_home_score, p_away_score)
  on conflict (user_id, match_id)
  do update set winner = excluded.winner, home_score = excluded.home_score, away_score = excluded.away_score, updated_at = now()
  returning * into v_pred;

  return v_pred;
end;
$$;

create or replace function public.submit_group_prediction(
  p_tournament_id uuid, p_group_name text, p_team_1 text, p_team_2 text
)
returns public.group_predictions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pred public.group_predictions;
  v_lock_at timestamptz;
  v_user_locked timestamptz;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_team_1 = p_team_2 then raise exception 'teams must be different'; end if;

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

revoke execute on function public.lock_validator(uuid) from public, anon;
revoke execute on function public.submit_group_prediction(uuid, text, text, text) from public, anon;
revoke execute on function public.submit_match_prediction(uuid, text, int, int) from public, anon;
grant execute on function public.lock_validator(uuid) to authenticated;
grant execute on function public.submit_group_prediction(uuid, text, text, text) to authenticated;
grant execute on function public.submit_match_prediction(uuid, text, int, int) to authenticated;
