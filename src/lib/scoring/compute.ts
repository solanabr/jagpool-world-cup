import type { Match, MatchPrediction, MatchWinner } from "@/types/db";
import { POINTS, REASONS, isKnockout, isLateStage } from "./rules";

// Discriminated union — each variant carries ONLY the FKs it needs, so a
// flattener in persist.ts maps each to the wide `scores` row shape.
export type ScoreEvent =
  | {
      reason: typeof REASONS.ADVANCER;
      userId: string;
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
      points: number;
    };

/**
 * Score a knockout-stage match prediction (group-stage matches don't score
 * per-match in the JagPool rules — they score via advancer predictions instead).
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

/** 5 pts per predicted team that's in the official advancer set. */
export function scoreAdvancerPrediction(
  userId: string,
  predictedTeams: string[],
  officialTeams: ReadonlySet<string>,
): ScoreEvent[] {
  const seen = new Set<string>();
  let hits = 0;
  for (const team of predictedTeams) {
    if (seen.has(team)) continue;
    seen.add(team);
    if (officialTeams.has(team)) hits++;
  }

  if (hits === 0) return [];

  return [
    {
      reason: REASONS.ADVANCER,
      userId,
      points: hits * POINTS.ADVANCER_HIT,
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
