"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KNOWN_MATCH_RESULTS } from "@/lib/wc2026/known-results";
import { isPlaceholderTeam } from "@/lib/wc2026/knockout";
import type { Match } from "@/types/db";

/**
 * Finalize every match in a round with its real result, one click. Posts each
 * match to the normal finalize endpoint (sequentially, in match order) so
 * bracket propagation and inline scoring behave exactly as if an admin had
 * entered them by hand — no separate code path to drift out of sync.
 */
export function PrefillRoundButton({ matches }: { matches: Match[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pending = matches.filter(
    (m) => !m.winner && KNOWN_MATCH_RESULTS[m.match_number],
  );
  if (pending.length === 0) return null;

  async function run() {
    setError(null);
    setMsg(null);
    setBusy(true);
    let done = 0;
    try {
      for (const m of [...pending].sort(
        (a, b) => a.match_number - b.match_number,
      )) {
        const known = KNOWN_MATCH_RESULTS[m.match_number];
        if (isPlaceholderTeam(m.home_team) || isPlaceholderTeam(m.away_team)) {
          throw new Error(
            `Match #${m.match_number} has no teams yet — finalize the previous round first`,
          );
        }
        const winner =
          known.winner === m.home_team
            ? "home"
            : known.winner === m.away_team
              ? "away"
              : null;
        if (!winner) {
          throw new Error(
            `Match #${m.match_number}: ${known.winner} isn't in this matchup`,
          );
        }
        const res = await fetch("/api/admin/finalize-match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            matchId: m.id,
            winner,
            homeScore: known.homeScore,
            awayScore: known.awayScore,
          }),
        });
        const json = await res.json();
        if (!res.ok && res.status !== 207) {
          throw new Error(
            `Match #${m.match_number}: ${json.details ?? json.error ?? "failed"}`,
          );
        }
        done++;
      }
      setMsg(`${done} match${done === 1 ? "" : "es"} finalized`);
      router.refresh();
    } catch (err) {
      setError(`${(err as Error).message}${done ? ` (${done} done)` : ""}`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <span
      className="flex items-center gap-2"
      onClick={(e) => e.stopPropagation()}
    >
      {msg ? <span className="text-[10px] text-[#129D49]">{msg}</span> : null}
      {error ? <span className="text-[10px] text-red-400">{error}</span> : null}
      <button
        type="button"
        disabled={busy}
        onClick={run}
        className={`text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-lg border transition-colors ${
          busy
            ? "opacity-50 cursor-wait border-white/10 bg-white/5 text-foreground/40"
            : "border-jagpool-accent/40 bg-jagpool-accent/10 text-jagpool-accent hover:bg-jagpool-accent/20"
        }`}
      >
        {busy ? "Filling…" : `Fill ${pending.length} result${pending.length === 1 ? "" : "s"}`}
      </button>
    </span>
  );
}
