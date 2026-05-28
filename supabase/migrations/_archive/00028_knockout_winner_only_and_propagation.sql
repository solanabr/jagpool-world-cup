-- =====================================================================
-- Knockout rework:
-- 1. finalize_match accepts NULL scores (early rounds are winner-only) and
--    allows a level score on knockout matches (penalty shootouts) — the
--    winner is then the shootout winner, not a draw.
-- 2. Wire the third-place match's parent links to the two semis (the seed
--    left them null) so winner/loser propagation can route losers there.
-- =====================================================================

create or replace function public.finalize_match(
  p_match_id uuid,
  p_home_score int,
  p_away_score int,
  p_winner text
)
returns public.matches
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.matches;
  v_admin boolean;
  v_is_group boolean;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select coalesce(is_admin, false) into v_admin from public.users where id = auth.uid();
  if not v_admin then raise exception 'forbidden: admin only'; end if;

  if p_winner not in ('home', 'away', 'draw') then
    raise exception 'invalid winner value';
  end if;

  select * into v_match from public.matches where id = p_match_id;
  if v_match.id is null then raise exception 'match not found'; end if;

  if p_home_score is not null and (p_home_score < 0 or p_home_score > 99) then
    raise exception 'invalid home score';
  end if;
  if p_away_score is not null and (p_away_score < 0 or p_away_score > 99) then
    raise exception 'invalid away score';
  end if;

  v_is_group := (v_match.stage = 'group');

  if v_is_group then
    -- Group stage: scores required, draw allowed, full score↔winner consistency.
    if p_home_score is null or p_away_score is null then
      raise exception 'group matches require both scores';
    end if;
    if p_winner = 'home' and not (p_home_score > p_away_score) then
      raise exception 'winner=home but home_score <= away_score';
    end if;
    if p_winner = 'away' and not (p_away_score > p_home_score) then
      raise exception 'winner=away but away_score <= home_score';
    end if;
    if p_winner = 'draw' and p_home_score <> p_away_score then
      raise exception 'winner=draw but scores differ';
    end if;
  else
    -- Knockout: no draws. Scores optional (early rounds are winner-only).
    -- When both scores are present and differ, the winner must match the
    -- higher side; equal scores are allowed (decided on penalties).
    if p_winner = 'draw' then
      raise exception 'knockout matches cannot end in draw';
    end if;
    if p_home_score is not null and p_away_score is not null then
      if p_home_score > p_away_score and p_winner <> 'home' then
        raise exception 'winner must be home when home_score > away_score';
      end if;
      if p_away_score > p_home_score and p_winner <> 'away' then
        raise exception 'winner must be away when away_score > home_score';
      end if;
    end if;
  end if;

  update public.matches
  set home_score = p_home_score,
      away_score = p_away_score,
      winner = p_winner,
      status = 'completed',
      locked_at = coalesce(locked_at, now())
  where id = p_match_id
  returning * into v_match;

  update public.match_predictions set locked = true where match_id = p_match_id;

  insert into public.admin_audit_log (admin_user_id, action, target_table, target_id, changes)
  values (auth.uid(), 'finalize_match', 'matches', p_match_id,
    jsonb_build_object(
      'home_score', p_home_score,
      'away_score', p_away_score,
      'winner', p_winner,
      'stage', v_match.stage
    ));

  return v_match;
end;
$$;

revoke execute on function public.finalize_match(uuid, int, int, text) from public, anon;
grant execute on function public.finalize_match(uuid, int, int, text) to authenticated;

-- Third-place match feeds from the two semis (seed left its parent links null).
update public.matches tp
set parent_match_a = (
      select id from public.matches
      where tournament_id = tp.tournament_id and match_number = 101
    ),
    parent_match_b = (
      select id from public.matches
      where tournament_id = tp.tournament_id and match_number = 102
    )
where tp.stage = 'third_place'
  and (tp.parent_match_a is null or tp.parent_match_b is null);
