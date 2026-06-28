-- Knockout predictions now lock AT kickoff (was: 4h before, set in 00033).
--
-- The 4h lead closed games too early. It bit us on the very first R32 game: the
-- moment its real kickoff time was entered, the 4h-before point was already in
-- the past, so the cron locked it ~1.3h before kickoff and players lost the
-- window. Reverting the lead to 0 keeps each match predictable until it actually
-- starts. Three layers must agree: submit_match_prediction (the hard gate),
-- lock_overdue_matches (the cron that flips locked_at/status + the per-prediction
-- locked flag), and the frontend LOCK_LEAD_MS (now 0).

create or replace function public.submit_match_prediction(
  p_match_id uuid,
  p_winner text,
  p_home_score integer default null,
  p_away_score integer default null
)
returns match_predictions
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_pred public.match_predictions;
  v_match public.matches;
  v_user_locked timestamptz;
  v_home_real boolean;
  v_away_real boolean;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_winner not in ('home','away','draw') then raise exception 'invalid winner'; end if;

  select validator_locked_at into v_user_locked from public.users where id = auth.uid();
  if v_user_locked is null then raise exception 'must complete onboarding'; end if;

  select * into v_match from public.matches where id = p_match_id;
  if v_match.id is null then raise exception 'match not found'; end if;
  -- Lock the prediction window at kickoff.
  if v_match.locked_at is not null or now() >= v_match.kickoff_at then
    raise exception 'match prediction window is closed';
  end if;

  if v_match.stage = 'group' then
    raise exception 'group stage uses group_predictions, not match_predictions';
  end if;

  if p_winner = 'draw' then
    raise exception 'knockout matches cannot have draw predictions';
  end if;

  if v_match.home_team is null or v_match.away_team is null then
    raise exception 'cannot predict on placeholder match (teams not yet determined)';
  end if;
  select
    exists(select 1 from public.tournament_teams
            where tournament_id = v_match.tournament_id
              and team_name = v_match.home_team),
    exists(select 1 from public.tournament_teams
            where tournament_id = v_match.tournament_id
              and team_name = v_match.away_team)
  into v_home_real, v_away_real;
  if not v_home_real or not v_away_real then
    raise exception 'cannot predict on placeholder match (teams not yet determined)';
  end if;

  if p_home_score is not null and p_away_score is not null then
    if p_winner = 'home' and p_home_score <= p_away_score then
      raise exception 'home win requires home_score > away_score';
    end if;
    if p_winner = 'away' and p_away_score <= p_home_score then
      raise exception 'away win requires away_score > home_score';
    end if;
  end if;

  insert into public.match_predictions (user_id, match_id, winner, home_score, away_score)
  values (auth.uid(), p_match_id, p_winner, p_home_score, p_away_score)
  on conflict (user_id, match_id)
  do update set winner = excluded.winner, home_score = excluded.home_score,
                away_score = excluded.away_score, updated_at = now()
  returning * into v_pred;

  return v_pred;
end;
$function$;
revoke execute on function public.submit_match_prediction(uuid, text, int, int) from public, anon;
grant execute on function public.submit_match_prediction(uuid, text, int, int) to authenticated;

create or replace function public.lock_overdue_matches()
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_locked_count int;
begin
  -- Lock predictions for matches that have kicked off.
  update public.match_predictions mp
  set locked = true
  where locked = false
    and exists (
      select 1 from public.matches m
      where m.id = mp.match_id
        and m.locked_at is null
        and m.kickoff_at <= now()
    );

  update public.matches
  set locked_at = now(), status = 'locked'
  where locked_at is null
    and kickoff_at <= now();
  get diagnostics v_locked_count = row_count;

  delete from public.siws_challenges where expires_at < now();

  return v_locked_count;
end;
$function$;
revoke execute on function public.lock_overdue_matches() from public, anon, authenticated;
