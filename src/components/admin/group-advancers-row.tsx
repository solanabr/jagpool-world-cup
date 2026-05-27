"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { flagFor } from "@/lib/wc2026/flags";
import type { WcGroup } from "@/lib/wc2026/groups";
import type { GroupResult } from "@/types/db";

export function GroupAdvancersRow({
  tournamentId,
  group,
  existing,
}: {
  tournamentId: string;
  group: WcGroup;
  existing: GroupResult | null;
}) {
  const router = useRouter();
  const [first, setFirst] = useState(existing?.first_place_team ?? "");
  const [second, setSecond] = useState(existing?.second_place_team ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function save() {
    setError(null);
    setSuccess(null);
    if (!first || !second || first === second) {
      setError("Pick two different teams");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/group-advancers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tournamentId,
          groupName: group.name,
          firstPlace: first,
          secondPlace: second,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.details ?? json.error ?? "Save failed");
      setSuccess(`Saved · scored ${json.scoring?.eventsWritten ?? 0} events`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Group {group.name}</h3>
        {existing ? (
          <span className="text-[10px] text-emerald-400 uppercase">finalized</span>
        ) : null}
      </div>
      <div className="flex flex-col gap-2">
        <select
          value={first}
          onChange={(e) => setFirst(e.target.value)}
          className="bg-white/5 border border-white/10 rounded px-2 py-1.5 text-sm"
        >
          <option value="">1st place…</option>
          {group.teams.map((t) => (
            <option key={t} value={t}>
              {flagFor(t)} {t}
            </option>
          ))}
        </select>
        <select
          value={second}
          onChange={(e) => setSecond(e.target.value)}
          className="bg-white/5 border border-white/10 rounded px-2 py-1.5 text-sm"
        >
          <option value="">2nd place…</option>
          {group.teams.map((t) => (
            <option key={t} value={t}>
              {flagFor(t)} {t}
            </option>
          ))}
        </select>
      </div>
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
      {success ? <p className="text-xs text-emerald-400">{success}</p> : null}
      <Button size="sm" variant="secondary" onClick={save} disabled={busy}>
        {busy ? "Saving…" : existing ? "Update" : "Save advancers"}
      </Button>
    </div>
  );
}
