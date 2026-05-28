"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { flagFor } from "@/lib/wc2026/flags";
import { formatKickoffBRT } from "@/lib/wc2026/dates";
import type { Match, MatchStage } from "@/types/db";

const LATE_STAGES = new Set<MatchStage>(["semi", "third_place", "final"]);

export function FinalizeMatchRow({ match }: { match: Match }) {
  const router = useRouter();
  const isGroup = match.stage === "group";
  const isLate = LATE_STAGES.has(match.stage);
  // Early knockout (R32/R16/QF) is winner-only; group + late stages take scores.
  const needsScore = isGroup || isLate;

  const [homeScore, setHomeScore] = useState(match.home_score?.toString() ?? "");
  const [awayScore, setAwayScore] = useState(match.away_score?.toString() ?? "");
  const [winner, setWinner] = useState<"home" | "away" | "">(
    match.winner === "home" || match.winner === "away" ? match.winner : "",
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const tie =
    homeScore !== "" && awayScore !== "" && Number(homeScore) === Number(awayScore);
  const showPenalty = isLate && tie;

  async function finalize() {
    setError(null);
    let payload: {
      matchId: string;
      winner: string;
      homeScore?: number;
      awayScore?: number;
    };

    if (needsScore) {
      const hs = Number(homeScore);
      const as = Number(awayScore);
      if (!Number.isInteger(hs) || !Number.isInteger(as) || hs < 0 || as < 0) {
        setError("Enter both scores");
        return;
      }
      let w: string;
      if (hs > as) w = "home";
      else if (as > hs) w = "away";
      else if (isGroup) w = "draw";
      else {
        if (!winner) {
          setError("Tie — pick who won on penalties");
          return;
        }
        w = winner;
      }
      payload = { matchId: match.id, winner: w, homeScore: hs, awayScore: as };
    } else {
      if (!winner) {
        setError("Pick the winner");
        return;
      }
      payload = { matchId: match.id, winner };
    }

    setBusy("finalize");
    try {
      const res = await fetch("/api/admin/finalize-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.details ?? json.error ?? "Finalize failed");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function rescore() {
    setError(null);
    setBusy("rescore");
    try {
      const res = await fetch("/api/admin/rescore-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId: match.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.details ?? json.error ?? "Rescore failed");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  function WinnerBtn({ side, label }: { side: "home" | "away"; label: string }) {
    const active = winner === side;
    return (
      <button
        onClick={() => setWinner(side)}
        className={`px-2.5 py-1 rounded text-sm border transition ${
          active
            ? "bg-jagpool-primary border-jagpool-primary text-white"
            : "bg-white/5 border-white/10 text-foreground/60 hover:bg-white/10"
        }`}
      >
        {label}
      </button>
    );
  }

  return (
    <li className="px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className="text-xs text-foreground/40 font-mono w-9 shrink-0">
          #{match.match_number}
        </span>
        <span className="truncate text-sm">
          {flagFor(match.home_team ?? "")} {match.home_team ?? "TBD"}
          <span className="mx-2 text-foreground/40">vs</span>
          {flagFor(match.away_team ?? "")} {match.away_team ?? "TBD"}
        </span>
        <span className="text-xs text-foreground/40 ml-2 hidden sm:inline">
          {formatKickoffBRT(match.kickoff_at)}
        </span>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {needsScore ? (
          <>
            <input
              type="number"
              min={0}
              max={99}
              value={homeScore}
              onChange={(e) => setHomeScore(e.target.value)}
              placeholder="H"
              className="w-14 bg-white/5 border border-white/10 rounded px-2 py-1 text-sm"
            />
            <input
              type="number"
              min={0}
              max={99}
              value={awayScore}
              onChange={(e) => setAwayScore(e.target.value)}
              placeholder="A"
              className="w-14 bg-white/5 border border-white/10 rounded px-2 py-1 text-sm"
            />
            {showPenalty ? (
              <span className="flex items-center gap-1">
                <span className="text-[10px] uppercase text-foreground/40">
                  pens
                </span>
                <WinnerBtn side="home" label="H" />
                <WinnerBtn side="away" label="A" />
              </span>
            ) : null}
          </>
        ) : (
          <span className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase text-foreground/40">
              advances
            </span>
            <WinnerBtn side="home" label={match.home_team ?? "Home"} />
            <WinnerBtn side="away" label={match.away_team ?? "Away"} />
          </span>
        )}
        <Button size="sm" onClick={finalize} disabled={busy !== null}>
          {busy === "finalize" ? "…" : "Finalize"}
        </Button>
        {match.status === "completed" ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={rescore}
            disabled={busy !== null}
          >
            {busy === "rescore" ? "…" : "Rescore"}
          </Button>
        ) : null}
        {error ? (
          <span className="text-xs text-red-400 w-full">{error}</span>
        ) : null}
      </div>
    </li>
  );
}
