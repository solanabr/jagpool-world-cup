"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { flagFor } from "@/lib/wc2026/flags";
import { TEAMS } from "@/lib/wc2026/teams";

export function ChampionPicker({
  tournamentId,
  initial,
  locked,
}: {
  tournamentId: string;
  initial: string | null;
  locked: boolean;
}) {
  const [team, setTeam] = useState<string>(initial ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function save() {
    setError(null);
    setSuccess(null);
    if (!team) {
      setError("Pick a team");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/predictions/champion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tournamentId, team }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.details ?? json.error ?? "Save failed");
      setSuccess(`Champion pick: ${team}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col gap-3">
      <div>
        <h2 className="font-semibold mb-1">Champion pick</h2>
        <p className="text-xs text-foreground/60">
          Pick the team you think will win the tournament. +30 pts if correct.
          Locks when the group stage closes.
        </p>
      </div>
      <select
        value={team}
        onChange={(e) => {
          setTeam(e.target.value);
          // Clear stale success/error when the user re-edits.
          setSuccess(null);
          setError(null);
        }}
        disabled={locked}
        className="bg-white/5 border border-white/10 rounded px-2 py-2 text-sm"
      >
        <option value="">Choose a team…</option>
        {TEAMS.map((t) => (
          <option key={t} value={t}>
            {flagFor(t)} {t}
          </option>
        ))}
      </select>
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
      {success ? <p className="text-xs text-emerald-400">{success}</p> : null}
      <Button
        size="sm"
        variant="secondary"
        onClick={save}
        disabled={busy || locked}
      >
        {locked
          ? "Locked"
          : busy
            ? "Saving…"
            : initial
              ? "Update champion"
              : "Save champion pick"}
      </Button>
    </div>
  );
}
