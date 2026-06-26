-- Fix advancer scoring silently dropping users past PostgREST's 1000-row cap.
--
-- get_advancer_predictions_for_scoring returned one row per (user, team) — 2000+
-- rows for a full field — so scoreAdvancersAndPersist's un-paginated fetch
-- truncated at 1000 and only ~half the users were ever scored. Aggregate to one
-- row per user instead, so the result is <= (#users) rows and can't hit the cap.
--
-- Return type changes (team_name text -> teams text[]), so this is drop+create,
-- not create-or-replace (which can't change a function's return type, err 42P13).

drop function if exists public.get_advancer_predictions_for_scoring(uuid);

create function public.get_advancer_predictions_for_scoring(p_tournament_id uuid)
returns table(user_id uuid, teams text[])
language sql
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select user_id, array_agg(distinct team_name) as teams
  from public.advancer_predictions
  where tournament_id = p_tournament_id
  group by user_id;
$function$;

revoke execute on function public.get_advancer_predictions_for_scoring(uuid)
  from public, anon, authenticated;
grant execute on function public.get_advancer_predictions_for_scoring(uuid)
  to service_role;

-- Advancer scores had no uniqueness guard: the existing unique indexes are all on
-- the *_prediction_id columns, which are NULL for advancer rows (so they enforce
-- nothing there). Add a partial unique index so a re-run or stray insert can't
-- duplicate a user's advancer points.
create unique index if not exists scores_advancer_uniq
  on public.scores (user_id, tournament_id)
  where reason = 'advancer';
