/**
 * Helpers for the knockout stage UI.
 */
import type { MatchStage, MatchWinner } from "@/types/db";

const PLACEHOLDER_RE = /^(winner of|loser of|group [a-l] —|3rd from)/i;

/** True if the team name is a bracket placeholder (no actual team known yet). */
export function isPlaceholderTeam(team: string | null | undefined): boolean {
  if (!team) return true;
  return PLACEHOLDER_RE.test(team);
}

/** True if both teams are known (admin has filled in real names). */
export function isMatchReadyForPrediction(home: string | null, away: string | null): boolean {
  return !isPlaceholderTeam(home) && !isPlaceholderTeam(away);
}

type FinalizedParent = {
  id: string;
  winner: MatchWinner | null;
  home_team: string | null;
  away_team: string | null;
};

type ChildMatch = {
  id: string;
  stage: MatchStage;
  status: string;
  parent_match_a: string | null;
  parent_match_b: string | null;
};

export type BracketAdvancement = {
  childId: string;
  patch: { home_team?: string; away_team?: string };
  childWasCompleted: boolean;
};

/**
 * Given a finalized parent match and its candidate children, compute which
 * child slots advance to. A child takes the parent's winner — except the
 * third-place match, which takes the loser. Pure so it can be unit-tested
 * apart from the DB write.
 */
export function resolveBracketAdvancement(
  parent: FinalizedParent,
  children: ChildMatch[],
): BracketAdvancement[] {
  if (
    !parent.winner ||
    parent.winner === "draw" ||
    !parent.home_team ||
    !parent.away_team
  ) {
    return [];
  }
  const winnerTeam =
    parent.winner === "home" ? parent.home_team : parent.away_team;
  const loserTeam =
    parent.winner === "home" ? parent.away_team : parent.home_team;

  const out: BracketAdvancement[] = [];
  for (const child of children) {
    const team = child.stage === "third_place" ? loserTeam : winnerTeam;
    const patch: { home_team?: string; away_team?: string } = {};
    if (child.parent_match_a === parent.id) patch.home_team = team;
    if (child.parent_match_b === parent.id) patch.away_team = team;
    if (Object.keys(patch).length > 0) {
      out.push({
        childId: child.id,
        patch,
        childWasCompleted: child.status === "completed",
      });
    }
  }
  return out;
}
