"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function SnapshotCreateForm({ tournamentId }: { tournamentId: string }) {
  const router = useRouter();
  const [topUsers, setTopUsers] = useState("10");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setError(null);
    const n = Number(topUsers);
    if (!Number.isInteger(n) || n < 1 || n > 100) {
      setError("Top users must be between 1 and 100");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/reward-snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tournamentId,
          topUsers: n,
          notes: notes.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.details ?? json.error ?? "Snapshot failed");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col gap-3">
      <div>
        <h2 className="font-semibold mb-1">Create snapshot</h2>
        <p className="text-xs text-foreground/60">
          Captures the current leaderboard immutably. Top N users + all active
          validators (ranked). You can create multiple drafts; finalize the
          chosen one later by updating its status.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="number"
          min={1}
          max={100}
          value={topUsers}
          onChange={(e) => setTopUsers(e.target.value)}
          className="w-24 bg-white/5 border border-white/10 rounded px-3 py-2 text-sm"
        />
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional)"
          className="flex-1 bg-white/5 border border-white/10 rounded px-3 py-2 text-sm"
        />
        <Button size="md" onClick={create} disabled={busy}>
          {busy ? "Snapshotting…" : "Create snapshot"}
        </Button>
      </div>
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
    </div>
  );
}
