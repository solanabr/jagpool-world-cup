import { TeamFlag } from "@/components/ui/team-flag";
import { formatKickoffBRT } from "@/lib/wc2026/dates";
import type { Match, MatchPrediction } from "@/types/db";

// Read-only row for a knockout match that can no longer be edited — locked
// (awaiting result) or finalized. Always surfaces the user's pick. For a
// finalized LATE-STAGE match it splits the outcome into Winner / each team's
// score, each with its own ✓/✗ — because the score bonuses score INDEPENDENTLY
// of the winner pick (a right scoreline still earns +5/side even if you picked
// the wrong team to advance). Rendered by the predictions page in place of
// KnockoutMatchForm so the editable form component stays untouched.
export function KnockoutMatchResult({
  match,
  prediction,
  pointsEarned,
  votes,
}: {
  match: Match;
  prediction: MatchPrediction | null;
  pointsEarned: number;
  votes?: { home: number; away: number };
}) {
  const finalized = match.winner === "home" || match.winner === "away";
  const isLate =
    match.stage === "semi" ||
    match.stage === "third_place" ||
    match.stage === "final";
  const totalVotes = (votes?.home ?? 0) + (votes?.away ?? 0);
  const homePct =
    totalVotes > 0 ? Math.round(((votes?.home ?? 0) / totalVotes) * 100) : 0;
  const awayPct = 100 - homePct;
  const winnerTeam = !finalized
    ? null
    : match.winner === "home"
      ? match.home_team
      : match.away_team;
  const pickedTeam = prediction
    ? prediction.winner === "home"
      ? match.home_team
      : match.away_team
    : null;
  const winnerOk =
    finalized && prediction != null && prediction.winner === match.winner;
  const hasScore = match.home_score != null && match.away_score != null;
  const hasPickedScore =
    prediction != null &&
    prediction.home_score != null &&
    prediction.away_score != null;
  // Late-stage finalized with a full scoreline → show the split breakdown.
  const showBreakdown = isLate && finalized && hasPickedScore && hasScore;

  const homeClass =
    match.winner === "home"
      ? "font-semibold"
      : finalized
        ? "text-foreground/45"
        : "";
  const awayClass =
    match.winner === "away"
      ? "font-semibold"
      : finalized
        ? "text-foreground/45"
        : "";
  const pickChipClass = !finalized
    ? "border-white/15 bg-white/8 text-foreground/80"
    : winnerOk
      ? "border-[#129D49]/40 bg-[#129D49]/10 text-[#129D49]"
      : "border-red-500/30 bg-red-500/10 text-red-400";

  return (
    <li className="px-4 py-3 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="flex items-center gap-2 min-w-0">
          <span className="text-xs text-foreground/40 font-mono w-9 shrink-0">
            #{match.match_number}
          </span>
          <span className="truncate text-sm">
            <span className={homeClass}>
              <TeamFlag team={match.home_team ?? ""} className="mr-1" />
              {match.home_team ?? "TBD"}
              {totalVotes > 0 ? (
                <span className="ml-1 text-xs font-normal text-foreground/30 tabular-nums">
                  {homePct}%
                </span>
              ) : null}
            </span>
            <span className="mx-2 text-foreground/40">vs</span>
            <span className={awayClass}>
              <TeamFlag team={match.away_team ?? ""} className="mr-1" />
              {match.away_team ?? "TBD"}
              {totalVotes > 0 ? (
                <span className="ml-1 text-xs font-normal text-foreground/30 tabular-nums">
                  {awayPct}%
                </span>
              ) : null}
            </span>
          </span>
        </span>
        <span className="text-xs text-foreground/50 whitespace-nowrap">
          {formatKickoffBRT(match.kickoff_at)}
          {finalized && hasScore
            ? ` · ${match.home_score}–${match.away_score}`
            : ""}
        </span>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap text-xs">
        {!prediction ? (
          <span className="text-foreground/40">No pick made</span>
        ) : showBreakdown ? (
          <>
            <span className="text-foreground/40">Your pick:</span>
            <OutcomeTag
              team={pickedTeam}
              label={`${pickedTeam} to advance`}
              ok={winnerOk}
              points={winnerOk ? 10 : 0}
            />
            <OutcomeTag
              team={match.home_team}
              label={`${match.home_team} ${prediction.home_score}`}
              ok={prediction.home_score === match.home_score}
              points={prediction.home_score === match.home_score ? 5 : 0}
            />
            <OutcomeTag
              team={match.away_team}
              label={`${match.away_team} ${prediction.away_score}`}
              ok={prediction.away_score === match.away_score}
              points={prediction.away_score === match.away_score ? 5 : 0}
            />
          </>
        ) : (
          <>
            <span className="text-foreground/40">Your pick:</span>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-medium ${pickChipClass}`}
            >
              <TeamFlag team={pickedTeam ?? ""} />
              <span>{pickedTeam}</span>
              {hasPickedScore ? (
                <span className="opacity-70">
                  {prediction.home_score}–{prediction.away_score}
                </span>
              ) : null}
              {finalized ? (
                <span aria-hidden>{winnerOk ? "✓" : "✗"}</span>
              ) : null}
            </span>
          </>
        )}
        {finalized ? (
          <span
            className={`font-bold tabular-nums ml-1 ${
              pointsEarned > 0 ? "text-[#129D49]" : "text-foreground/35"
            }`}
          >
            +{pointsEarned} pts
          </span>
        ) : prediction ? (
          <span className="text-foreground/40 uppercase text-[10px] tracking-wide">
            Locked · awaiting result
          </span>
        ) : null}
        {winnerTeam && !showBreakdown ? (
          <span className="text-foreground/35 ml-auto truncate">
            {winnerTeam} won
          </span>
        ) : null}
      </div>
    </li>
  );
}

// One part of a late-stage breakdown: a team + label with a ✓/✗ and the points
// it earned. Green when it hit, red when it missed.
function OutcomeTag({
  team,
  label,
  ok,
  points,
}: {
  team: string | null;
  label: string;
  ok: boolean;
  points: number;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border ${
        ok
          ? "border-[#129D49]/40 bg-[#129D49]/10 text-[#129D49]"
          : "border-red-500/30 bg-red-500/10 text-red-400"
      }`}
    >
      {team ? <TeamFlag team={team} /> : null}
      <span className="truncate max-w-[9rem]">{label}</span>
      <span aria-hidden>{ok ? `✓ +${points}` : "✗"}</span>
    </span>
  );
}
