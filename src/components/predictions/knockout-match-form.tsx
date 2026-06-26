"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TeamFlag } from "@/components/ui/team-flag";
import { formatKickoffBRT } from "@/lib/wc2026/dates";
import { isMatchReadyForPrediction, isPlaceholderTeam, isMatchLocked } from "@/lib/wc2026/knockout";
import type { Match, MatchPrediction } from "@/types/db";

export function KnockoutMatchForm({
  match,
  initial,
  isLateStage,
}: {
  match: Match;
  initial: MatchPrediction | null;
  isLateStage: boolean;
}) {
  const [winner, setWinner] = useState<"home" | "away" | "">(
    (initial?.winner as "home" | "away" | "") || "",
  );
  const [homeScore, setHomeScore] = useState<string>(
    initial?.home_score?.toString() ?? "",
  );
  const [awayScore, setAwayScore] = useState<string>(
    initial?.away_score?.toString() ?? "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const ready = isMatchReadyForPrediction(match.home_team, match.away_team);
  const locked = isMatchLocked(match);
  const disabled = !ready || locked;

  async function save() {
    setError(null);
    setSaved(false);
    if (!winner) {
      setError("Pick a winner");
      return;
    }
    const body: {
      matchId: string;
      winner: "home" | "away";
      homeScore?: number;
      awayScore?: number;
    } = { matchId: match.id, winner };

    if (isLateStage) {
      const hs = Number(homeScore);
      const as = Number(awayScore);
      if (!Number.isInteger(hs) || !Number.isInteger(as) || hs < 0 || as < 0) {
        setError("Enter both scores (integers >= 0)");
        return;
      }
      body.homeScore = hs;
      body.awayScore = as;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/predictions/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.details ?? json.error ?? "Could not save");
      setSaved(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="px-4 py-3 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="flex items-center gap-2 min-w-0">
          <span className="text-xs text-foreground/40 font-mono w-9 shrink-0">
            #{match.match_number}
          </span>
          <span className="truncate text-sm">
            <span className={isPlaceholderTeam(match.home_team) ? "text-foreground/50 italic" : ""}>
              {!isPlaceholderTeam(match.home_team) ? <TeamFlag team={match.home_team ?? ""} className="mr-1" /> : null}
              {match.home_team ?? "TBD"}
            </span>
            <span className="mx-2 text-foreground/40">vs</span>
            <span className={isPlaceholderTeam(match.away_team) ? "text-foreground/50 italic" : ""}>
              {!isPlaceholderTeam(match.away_team) ? <TeamFlag team={match.away_team ?? ""} className="mr-1" /> : null}
              {match.away_team ?? "TBD"}
            </span>
          </span>
        </span>
        <span className="text-xs text-foreground/50 whitespace-nowrap">
          {formatKickoffBRT(match.kickoff_at)}
          {locked ? " · locked" : ""}
        </span>
      </div>

      {!ready ? (
        <p className="text-xs text-foreground/50">
          Waiting for bracket — predictions open once admin fills in the teams.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {(["home", "away"] as const).map((side) => {
            const teamName = side === "home" ? (match.home_team ?? "TBD") : (match.away_team ?? "TBD");
            const isActive = winner === side;
            const isDisabled = disabled || busy;
            return (
              <button
                key={side}
                type="button"
                disabled={isDisabled}
                onClick={() => setWinner(isActive ? "" : side)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-sm font-medium transition-all ${
                  isDisabled
                    ? "opacity-40 cursor-not-allowed bg-white/3 border-white/8 text-foreground/40"
                    : isActive
                      ? "bg-[#129D49]/12 border-[#129D49]/40 text-[#129D49] shadow-sm shadow-[#129D49]/10"
                      : "bg-white/5 border-white/10 text-foreground/60 hover:border-white/20 hover:text-foreground/90"
                }`}
              >
                <TeamFlag team={teamName} />
                <span>{teamName}</span>
              </button>
            );
          })}

          {isLateStage ? (
            <>
              <input
                type="number"
                min={0}
                max={99}
                value={homeScore}
                onChange={(e) => setHomeScore(e.target.value)}
                placeholder="H"
                disabled={disabled || busy}
                className="w-14 bg-white/5 border border-white/10 rounded px-2 py-1.5 text-sm"
              />
              <input
                type="number"
                min={0}
                max={99}
                value={awayScore}
                onChange={(e) => setAwayScore(e.target.value)}
                placeholder="A"
                disabled={disabled || busy}
                className="w-14 bg-white/5 border border-white/10 rounded px-2 py-1.5 text-sm"
              />
            </>
          ) : null}

          <Button
            size="sm"
            variant="secondary"
            onClick={save}
            disabled={disabled || busy}
          >
            {locked ? "Locked" : busy ? "Saving…" : initial ? "Update" : "Save"}
          </Button>

          {saved ? (
            <span className="text-xs text-[#129D49]">Saved</span>
          ) : null}
          {error ? <span className="text-xs text-red-400">{error}</span> : null}
        </div>
      )}
    </li>
  );
}
