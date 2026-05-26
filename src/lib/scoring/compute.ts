import type {
  GroupPrediction,
  Match,
  MatchPrediction,
} from "@/types/db";
import { POINTS, REASONS, STAGE_MULTIPLIER } from "./rules";

export type ScoreEvent = {
  userId: string;
  matchId: string | null;
  groupPredictionId: string | null;
  matchPredictionId: string | null;
  points: number;
  reason: string;
};

export function scoreMatchPrediction(
  prediction: MatchPrediction,
  match: Match,
): ScoreEvent[] {
  if (match.status !== "completed" || !match.winner) return [];

  const events: ScoreEvent[] = [];
  const multiplier = STAGE_MULTIPLIER[match.stage];

  if (prediction.winner === match.winner) {
    events.push({
      userId: prediction.user_id,
      matchId: match.id,
      groupPredictionId: null,
      matchPredictionId: prediction.id,
      points: Math.round(POINTS.MATCH_CORRECT_WINNER * multiplier),
      reason: REASONS.MATCH_WINNER,
    });

    if (
      prediction.home_score != null &&
      prediction.away_score != null &&
      prediction.home_score === match.home_score &&
      prediction.away_score === match.away_score
    ) {
      events.push({
        userId: prediction.user_id,
        matchId: match.id,
        groupPredictionId: null,
        matchPredictionId: prediction.id,
        points: Math.round(POINTS.MATCH_EXACT_SCORE_BONUS * multiplier),
        reason: REASONS.MATCH_EXACT_SCORE,
      });
    }
  }

  return events;
}

/**
 * Score a group-stage advancement prediction against the realized standings.
 * `actualAdvancing` should be the two team names that actually advanced from the group.
 */
export function scoreGroupPrediction(
  prediction: GroupPrediction,
  actualAdvancing: { team1: string; team2: string },
): ScoreEvent[] {
  const events: ScoreEvent[] = [];
  const actualSet = new Set([actualAdvancing.team1, actualAdvancing.team2]);
  const predictedSet = new Set([
    prediction.advancing_team_1,
    prediction.advancing_team_2,
  ]);

  let hits = 0;
  for (const team of predictedSet) {
    if (actualSet.has(team)) hits++;
  }

  if (hits > 0) {
    events.push({
      userId: prediction.user_id,
      matchId: null,
      groupPredictionId: prediction.id,
      matchPredictionId: null,
      points: hits * POINTS.GROUP_TEAM_ADVANCING,
      reason: REASONS.GROUP_ADVANCE_HIT,
    });
  }
  if (hits === 2) {
    events.push({
      userId: prediction.user_id,
      matchId: null,
      groupPredictionId: prediction.id,
      matchPredictionId: null,
      points: POINTS.GROUP_BOTH_TEAMS_CORRECT_BONUS,
      reason: REASONS.GROUP_BOTH_TEAMS,
    });
  }

  return events;
}
