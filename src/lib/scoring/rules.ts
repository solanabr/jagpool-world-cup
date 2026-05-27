import type { MatchStage } from "@/types/db";

/**
 * JagPool World Cup 2026 scoring rules
 * ────────────────────────────────────
 * Group stage
 *   - Each correct advancer: 5 pts (no bonus)
 *
 * Knockout (round_of_32, round_of_16, quarter)
 *   - Correct winner / advancing team: 10 pts
 *
 * Late stage (semi, third_place, final)
 *   - Correct winner: 10 pts
 *   - Correct winner score: +5 pts
 *   - Correct loser score: +5 pts
 *
 * Champion
 *   - Correct tournament champion: +30 pts
 */
export const POINTS = {
  GROUP_ADVANCER_HIT: 5,
  KNOCKOUT_WINNER_HIT: 10,
  LATE_STAGE_WINNER_SCORE_HIT: 5,
  LATE_STAGE_LOSER_SCORE_HIT: 5,
  CHAMPION_HIT: 30,
} as const;

export const REASONS = {
  GROUP_ADVANCER: "group_advancer",
  KNOCKOUT_WINNER: "knockout_winner",
  LATE_STAGE_WINNER_SCORE: "late_stage_winner_score",
  LATE_STAGE_LOSER_SCORE: "late_stage_loser_score",
  CHAMPION: "champion",
} as const;

const LATE_STAGE_SET = new Set<MatchStage>(["semi", "third_place", "final"]);
const KNOCKOUT_STAGE_SET = new Set<MatchStage>([
  "round_of_32",
  "round_of_16",
  "quarter",
  "semi",
  "third_place",
  "final",
]);

export function isKnockout(stage: MatchStage): boolean {
  return KNOCKOUT_STAGE_SET.has(stage);
}

export function isLateStage(stage: MatchStage): boolean {
  return LATE_STAGE_SET.has(stage);
}
