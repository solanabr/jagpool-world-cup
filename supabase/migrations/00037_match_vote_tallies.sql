-- Per-match community vote split for the predictions page (shown on locked /
-- finalized knockout rows). match_predictions is self-only under RLS, so this
-- SECURITY DEFINER RPC exposes the AGGREGATE counts only — never individual
-- picks — and is restricted to matches that have already started or finalized,
-- so an open match's tally can't drive bandwagon voting.

create or replace function public.get_match_vote_tallies()
returns table(match_id uuid, home_votes bigint, away_votes bigint)
language sql
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select
    mp.match_id,
    count(*) filter (where mp.winner = 'home')::bigint as home_votes,
    count(*) filter (where mp.winner = 'away')::bigint as away_votes
  from public.match_predictions mp
  join public.matches m on m.id = mp.match_id
  where m.winner is not null or m.kickoff_at <= now()
  group by mp.match_id;
$function$;

grant execute on function public.get_match_vote_tallies() to anon, authenticated, service_role;
