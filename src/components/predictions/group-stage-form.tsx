"use client";

import { useState } from "react";
import { GroupPredictionForm, type GroupConfig } from "./group-prediction-form";
import { ChampionPicker } from "./champion-picker";
import type { GroupPrediction } from "@/types/db";

const MAX_TOTAL = 32;

export function GroupStageForm({
  tournamentId,
  groups,
  initialPredictions,
  initialChampion,
  locked,
}: {
  tournamentId: string;
  groups: GroupConfig[];
  initialPredictions: Record<string, GroupPrediction | undefined>;
  initialChampion: string | null;
  locked: boolean;
}) {
  const [pickedCount, setPickedCount] = useState(() => {
    let n = 0;
    for (const g of groups) {
      const pred = initialPredictions[g.name];
      if (pred?.advancing_team_1) n++;
      if (pred?.advancing_team_2) n++;
    }
    return n;
  });
  const [champion, setChampion] = useState(initialChampion ?? "");

  const allDone = pickedCount === MAX_TOTAL && champion !== "";
  const remaining = MAX_TOTAL - pickedCount;

  const btnLabel = locked
    ? "Locked"
    : allDone
      ? "Save picks"
      : remaining > 0 && !champion
        ? `${remaining} team${remaining === 1 ? "" : "s"} + champion needed`
        : remaining > 0
          ? `${remaining} more team${remaining === 1 ? "" : "s"} needed`
          : "Pick your champion to save";

  return (
    <div className="flex flex-col gap-6 px-4 pb-5 pt-2">
      <GroupPredictionForm
        tournamentId={tournamentId}
        groups={groups}
        initialPredictions={initialPredictions}
        onPickChange={(p) => setPickedCount(p.size)}
      />
      <ChampionPicker
        value={champion}
        onChange={setChampion}
        locked={locked}
      />
      <button
        disabled={!allDone || locked}
        className={`w-full py-3 rounded-xl text-sm font-semibold transition-all ${
          allDone && !locked
            ? "bg-jagpool-primary border border-jagpool-primary text-white hover:bg-jagpool-primary-hover"
            : "bg-white/5 border border-white/10 text-foreground/30 cursor-not-allowed"
        }`}
      >
        {btnLabel}
      </button>
    </div>
  );
}
