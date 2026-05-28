-- =====================================================================
-- Atomic score replacement. The TS scoring helpers (advancer, champion) did
-- a separate DELETE then INSERT — two round-trips with no transaction, so a
-- failure between them zeroed those scores until a manual re-run. This RPC
-- does both in one transaction. Service-role only (called by scoring code).
-- =====================================================================

create or replace function public.replace_scores(
  p_tournament_id uuid,
  p_reason text,
  p_rows jsonb
)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count int;
begin
  delete from public.scores
  where tournament_id = p_tournament_id and reason = p_reason;

  insert into public.scores (
    user_id, tournament_id, match_id, group_prediction_id,
    match_prediction_id, champion_prediction_user_id, points, reason
  )
  select
    (e->>'user_id')::uuid,
    p_tournament_id,
    nullif(e->>'match_id', '')::uuid,
    nullif(e->>'group_prediction_id', '')::uuid,
    nullif(e->>'match_prediction_id', '')::uuid,
    nullif(e->>'champion_prediction_user_id', '')::uuid,
    (e->>'points')::int,
    p_reason
  from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) e;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.replace_scores(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.replace_scores(uuid, text, jsonb) to service_role;
