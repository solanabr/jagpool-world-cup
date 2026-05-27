/**
 * Helpers for the knockout stage UI.
 */

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
