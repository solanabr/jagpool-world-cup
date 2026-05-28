"use client";

import { TeamSelect } from "@/components/ui/team-select";
import { TEAMS } from "@/lib/wc2026/teams";

export function ChampionPicker({
  value,
  onChange,
  locked,
}: {
  value: string;
  onChange: (v: string) => void;
  locked: boolean;
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col gap-3">
      <div>
        <h2 className="font-semibold mb-1">Champion pick</h2>
        <p className="text-xs text-foreground/60">
          Pick the team you think will win the tournament. +30 pts if correct.
          Locks when the group stage closes.
        </p>
      </div>
      <TeamSelect
        value={value}
        onChange={onChange}
        disabled={locked}
        options={TEAMS.map((t) => ({ value: t, label: t }))}
        placeholder="Choose a team…"
      />
    </div>
  );
}
