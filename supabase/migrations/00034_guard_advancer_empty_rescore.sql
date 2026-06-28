-- Guard replace_scores against an empty advancer re-score wiping the leaderboard.
--
-- Failure mode this prevents: a deploy skew where prod runs an older
-- scoreAdvancersAndPersist whose result-shape assumptions don't match the
-- current get_advancer_predictions_for_scoring RPC. The mismatch yields zero
-- score events, so the helper calls replace_scores(..., 'advancer', '[]') —
-- which DELETEs every advancer row and inserts nothing, zeroing all 64 users.
-- This bit us live twice when the admin re-saved group advancers.
--
-- An empty advancer payload is never legitimate: advancers are a fixed 32-team
-- slate (set_group_advancers), so once they exist every predictor scores at
-- least their correct picks => a non-empty payload. So we treat empty-advancer
-- as a no-op (return -1) instead of a destructive replace.
--
-- Champion is intentionally NOT guarded: it CAN be legitimately empty (nobody
-- picked the actual champion) and that empty replace must still clear stale rows.

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
  if p_reason = 'advancer' and coalesce(jsonb_array_length(p_rows), 0) = 0 then
    return -1;
  end if;

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
