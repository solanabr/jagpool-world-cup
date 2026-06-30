import { TeamFlag } from "@/components/ui/team-flag";
import { formatKickoffBRT } from "@/lib/wc2026/dates";
import type { Match, MatchPrediction } from "@/types/db";

// Read-only row for a FINALIZED knockout match: shows the actual result plus the
// user's pick, whether it hit, and the points it earned. The predictions page
// renders this instead of KnockoutMatchForm once a match has a winner, so the
// editable form component stays untouched.
export function KnockoutMatchResult({
  match,
  prediction,
  pointsEarned,
}: {
  match: Match;
  prediction: MatchPrediction | null;
  pointsEarned: number;
}) {
  const winnerTeam =
    match.winner === "home"
      ? match.home_team
      : match.winner === "away"
        ? match.away_team
        : null;
  const pickedTeam = prediction
    ? prediction.winner === "home"
      ? match.home_team
      : match.away_team
    : null;
  const correct =
    prediction != null &&
    match.winner != null &&
    prediction.winner === match.winner;
  const hasScore = match.home_score != null && match.away_score != null;

  return (
    <li className="px-4 py-3 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="flex items-center gap-2 min-w-0">
          <span className="text-xs text-foreground/40 font-mono w-9 shrink-0">
            #{match.match_number}
          </span>
          <span className="truncate text-sm">
            <span
              className={
                match.winner === "home"
                  ? "font-semibold"
                  : "text-foreground/50"
              }
            >
              <TeamFlag team={match.home_team ?? ""} className="mr-1" />
              {match.home_team ?? "TBD"}
            </span>
            <span className="mx-2 text-foreground/40">vs</span>
            <span
              className={
                match.winner === "away"
                  ? "font-semibold"
                  : "text-foreground/50"
              }
            >
              <TeamFlag team={match.away_team ?? ""} className="mr-1" />
              {match.away_team ?? "TBD"}
            </span>
          </span>
        </span>
        <span className="text-xs text-foreground/50 whitespace-nowrap">
          {formatKickoffBRT(match.kickoff_at)}
          {hasScore ? ` · ${match.home_score}–${match.away_score}` : ""}
        </span>
      </div>

      <div className="flex items-center gap-2 flex-wrap text-xs">
        {prediction ? (
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-medium ${
              correct
                ? "border-[#129D49]/40 bg-[#129D49]/10 text-[#129D49]"
                : "border-red-500/30 bg-red-500/10 text-red-400"
            }`}
          >
            <TeamFlag team={pickedTeam ?? ""} />
            <span>{pickedTeam}</span>
            <span aria-hidden>{correct ? "✓" : "✗"}</span>
          </span>
        ) : (
          <span className="px-2.5 py-1 rounded-lg border border-white/10 bg-white/3 text-foreground/40">
            No pick
          </span>
        )}
        <span
          className={`font-bold tabular-nums ${
            pointsEarned > 0 ? "text-[#129D49]" : "text-foreground/35"
          }`}
        >
          +{pointsEarned} pts
        </span>
        {winnerTeam ? (
          <span className="text-foreground/35 ml-auto truncate">
            {winnerTeam} won
          </span>
        ) : null}
      </div>
    </li>
  );
}
