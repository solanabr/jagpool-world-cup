"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { flagFor } from "@/lib/wc2026/flags";
import { formatKickoffBRT } from "@/lib/wc2026/dates";
import type { Match } from "@/types/db";

export function FinalizeMatchRow({ match }: { match: Match }) {
  const router = useRouter();
  const [homeScore, setHomeScore] = useState<string>(
    match.home_score?.toString() ?? "",
  );
  const [awayScore, setAwayScore] = useState<string>(
    match.away_score?.toString() ?? "",
  );
  const [winner, setWinner] = useState<"home" | "away" | "draw" | "">(
    match.winner ?? "",
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isGroup = match.stage === "group";
  const canDraw = isGroup;

  async function finalize() {
    setError(null);
    const hs = Number(homeScore);
    const as = Number(awayScore);
    if (!Number.isInteger(hs) || !Number.isInteger(as)) {
      setError("Scores must be integers");
      return;
    }
    if (!winner) {
      setError("Pick a winner");
      return;
    }
    setBusy("finalize");
    try {
      const res = await fetch("/api/admin/finalize-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchId: match.id,
          homeScore: hs,
          awayScore: as,
          winner,
        }),
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
        <span className="text-xs text-foreground/40 ml-2">
          {formatKickoffBRT(match.kickoff_at)}
        </span>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
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
        <select
          value={winner}
          onChange={(e) =>
            setWinner(e.target.value as "home" | "away" | "draw" | "")
          }
          className="bg-white/5 border border-white/10 rounded px-2 py-1 text-sm"
        >
          <option value="">winner…</option>
          <option value="home">home</option>
          <option value="away">away</option>
          {canDraw ? <option value="draw">draw</option> : null}
        </select>
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
