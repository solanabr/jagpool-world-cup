import type {
  GroupPrediction,
  Match,
  MatchPrediction,
  MatchWinner,
} from "@/types/db";
import { POINTS, REASONS, isKnockout, isLateStage } from "./rules";

// Discriminated union — each variant carries ONLY the FKs it needs. This
// makes invalid states unrepresentable (e.g. you cannot construct a champion
// event that also has a matchId). Persist.ts has a single flattener that
// maps each variant to the wide `scores` row shape.
export type ScoreEvent =
  | {
      reason: typeof REASONS.GROUP_ADVANCER;
      userId: string;
      groupPredictionId: string;
      points: number;
    }
  | {
      reason:
        | typeof REASONS.KNOCKOUT_WINNER
        | typeof REASONS.LATE_STAGE_WINNER_SCORE
        | typeof REASONS.LATE_STAGE_LOSER_SCORE;
      userId: string;
      matchId: string;
      matchPredictionId: string;
      points: number;
    }
  | {
      reason: typeof REASONS.CHAMPION;
      userId: string;
      championPredictionUserId: string;
      points: number;
    };

/**
 * Score a knockout-stage match prediction (group-stage matches don't score
 * per-match in the JagPool rules — they score via group_predictions instead).
 *
 * Returns events for:
 *   - knockout_winner: prediction.winner === match.winner
 *   - late_stage_winner_score: late stage + predicted winner's score matches
 *   - late_stage_loser_score:  late stage + predicted loser's score matches
 */
export function scoreMatchPrediction(
  prediction: MatchPrediction,
  match: Match,
): ScoreEvent[] {
  if (match.status !== "completed" || !match.winner) return [];
  if (!isKnockout(match.stage)) return [];
  if (prediction.winner !== match.winner) return [];

  const events: ScoreEvent[] = [
    {
      reason: REASONS.KNOCKOUT_WINNER,
      userId: prediction.user_id,
      matchId: match.id,
      matchPredictionId: prediction.id,
      points: POINTS.KNOCKOUT_WINNER_HIT,
    },
  ];

  if (!isLateStage(match.stage)) return events;
  if (match.winner === "draw") return events; // shouldn't happen on knockout; defensive

  const [winnerScoreMatch, loserScoreMatch] = sidesForWinner(
    match.winner,
    match.home_score,
    match.away_score,
  );
  const [winnerScorePred, loserScorePred] = sidesForWinner(
    match.winner,
    prediction.home_score,
    prediction.away_score,
  );

  if (
    winnerScorePred != null &&
    winnerScoreMatch != null &&
    winnerScorePred === winnerScoreMatch
  ) {
    events.push({
      reason: REASONS.LATE_STAGE_WINNER_SCORE,
      userId: prediction.user_id,
      matchId: match.id,
      matchPredictionId: prediction.id,
      points: POINTS.LATE_STAGE_WINNER_SCORE_HIT,
    });
  }

  if (
    loserScorePred != null &&
    loserScoreMatch != null &&
    loserScorePred === loserScoreMatch
  ) {
    events.push({
      reason: REASONS.LATE_STAGE_LOSER_SCORE,
      userId: prediction.user_id,
      matchId: match.id,
      matchPredictionId: prediction.id,
      points: POINTS.LATE_STAGE_LOSER_SCORE_HIT,
    });
  }

  return events;
}

/**
 * Score a group advancement prediction against the realized advancers.
 * 5 pts per correct team. No "both correct" bonus (per the JagPool rules).
 */
export function scoreGroupPrediction(
  prediction: GroupPrediction,
  actualAdvancing: { team1: string; team2: string },
): ScoreEvent[] {
  const actualSet = new Set([actualAdvancing.team1, actualAdvancing.team2]);
  const predictedSet = new Set([
    prediction.advancing_team_1,
    prediction.advancing_team_2,
  ]);

  let hits = 0;
  for (const team of predictedSet) {
    if (actualSet.has(team)) hits++;
  }

  if (hits === 0) return [];

  return [
    {
      reason: REASONS.GROUP_ADVANCER,
      userId: prediction.user_id,
      groupPredictionId: prediction.id,
      points: hits * POINTS.GROUP_ADVANCER_HIT,
    },
  ];
}

export type ChampionPrediction = {
  user_id: string;
  tournament_id: string;
  team: string;
};

/**
 * Score a champion prediction against the realized tournament champion.
 * 30 pts if correct, 0 otherwise.
 */
export function scoreChampionPrediction(
  prediction: ChampionPrediction,
  actualChampion: string,
): ScoreEvent[] {
  if (prediction.team !== actualChampion) return [];
  return [
    {
      reason: REASONS.CHAMPION,
      userId: prediction.user_id,
      championPredictionUserId: prediction.user_id,
      points: POINTS.CHAMPION_HIT,
    },
  ];
}

/**
 * Returns [winnerScore, loserScore] given the winner side. Returns [null, null]
 * for draw (caller is expected to skip score scoring for draws).
 */
function sidesForWinner(
  winner: MatchWinner,
  homeScore: number | null,
  awayScore: number | null,
): [number | null, number | null] {
  if (winner === "home") return [homeScore, awayScore];
  if (winner === "away") return [awayScore, homeScore];
  return [null, null];
}
