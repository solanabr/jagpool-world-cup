"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GroupPredictionForm, type GroupConfig } from "./group-prediction-form";
import { ChampionPicker } from "./champion-picker";

const MAX_TOTAL = 32;

export function GroupStageForm({
  tournamentId,
  groups,
  initialPicks,
  initialChampion,
  locked,
}: {
  tournamentId: string;
  groups: GroupConfig[];
  initialPicks: string[];
  initialChampion: string | null;
  locked: boolean;
}) {
  const router = useRouter();
  const [picked, setPicked] = useState<Set<string>>(() => new Set(initialPicks));
  const [champion, setChampion] = useState(initialChampion ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const groupOf = new Map<string, string>();
  for (const g of groups) for (const t of g.teams) groupOf.set(t, g.name);

  const total = picked.size;

  async function save() {
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      const picks = [...picked].map((teamName) => ({
        groupName: groupOf.get(teamName) ?? "",
        teamName,
      }));
      const res = await fetch("/api/predictions/advancers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tournamentId, picks, champion: champion || null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.details ?? json.error ?? "Save failed");
      setSuccess(`Saved ${json.count ?? picks.length} advancers`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const btnLabel = locked
    ? "Locked"
    : busy
      ? "Saving…"
      : total >= MAX_TOTAL
        ? "Save picks"
        : `Save ${total}/${MAX_TOTAL} picks`;

  return (
    <div className="flex flex-col gap-6 px-4 pb-5 pt-2">
      <GroupPredictionForm
        groups={groups}
        initialPicks={initialPicks}
        onPickChange={(p) => {
          setPicked(p);
          setSuccess(null);
        }}
      />
      <ChampionPicker
        value={champion}
        onChange={(v) => {
          setChampion(v);
          setSuccess(null);
        }}
        locked={locked}
      />
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
      {success ? <p className="text-xs text-emerald-400">{success}</p> : null}
      <button
        onClick={save}
        disabled={locked || busy}
        className={`w-full py-3 rounded-xl text-sm font-semibold transition-all ${
          !locked && !busy
            ? "bg-jagpool-primary border border-jagpool-primary text-white hover:bg-jagpool-primary-hover"
            : "bg-white/5 border border-white/10 text-foreground/30 cursor-not-allowed"
        }`}
      >
        {btnLabel}
      </button>
    </div>
  );
}
