import type { MatchStage } from "@/types/db";

export const POINTS = {
  GROUP_TEAM_ADVANCING: 5,
  GROUP_BOTH_TEAMS_CORRECT_BONUS: 5,
  MATCH_CORRECT_WINNER: 10,
  MATCH_EXACT_SCORE_BONUS: 15,
} as const;

export const STAGE_MULTIPLIER: Record<MatchStage, number> = {
  group: 1,
  round_of_32: 1.25,
  round_of_16: 1.5,
  quarter: 2,
  semi: 2.5,
  third_place: 2,
  final: 3,
};

export const REASONS = {
  GROUP_ADVANCE_HIT: "group_advance_hit",
  GROUP_BOTH_TEAMS: "group_both_teams_bonus",
  MATCH_WINNER: "match_correct_winner",
  MATCH_EXACT_SCORE: "match_exact_score_bonus",
} as const;
