"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { flagFor } from "@/lib/wc2026/flags";
import { formatKickoffBRT } from "@/lib/wc2026/dates";
import type { GroupPrediction, Match } from "@/types/db";

export type GroupConfig = {
  name: string;
  teams: string[];
};

export function GroupPredictionForm({
  tournamentId,
  groups,
  matchesByGroup = {},
  initialPredictions,
}: {
  tournamentId: string;
  groups: GroupConfig[];
  matchesByGroup?: Record<string, Match[]>;
  initialPredictions: Record<string, GroupPrediction | undefined>;
}) {
  const [picks, setPicks] = useState<
    Record<string, { team1: string; team2: string }>
  >(
    Object.fromEntries(
      groups.map((g) => [
        g.name,
        {
          team1: initialPredictions[g.name]?.advancing_team_1 ?? "",
          team2: initialPredictions[g.name]?.advancing_team_2 ?? "",
        },
      ]),
    ),
  );
  const [saving, setSaving] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  async function save(groupName: string) {
    const pick = picks[groupName];
    if (!pick?.team1 || !pick?.team2 || pick.team1 === pick.team2) {
      setErrors((e) => ({ ...e, [groupName]: "Pick 2 different teams" }));
      return;
    }
    setSaving(groupName);
    setErrors((e) => ({ ...e, [groupName]: null }));
    try {
      const res = await fetch("/api/predictions/group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tournamentId,
          groupName,
          team1: pick.team1,
          team2: pick.team2,
        }),
      });
      if (!res.ok) {
        const errJson = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(errJson?.error ?? "Could not save");
      }
    } catch (err) {
      setErrors((e) => ({ ...e, [groupName]: (err as Error).message }));
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {groups.map((group) => {
        const pick = picks[group.name];
        const locked = initialPredictions[group.name]?.locked;
        const matches = matchesByGroup?.[group.name] ?? [];

        return (
          <div
            key={group.name}
            className="bg-white/5 border border-white/10 rounded-lg p-4 flex flex-col gap-3"
          >
            <h3 className="font-semibold">Group {group.name}</h3>

            <ul className="text-sm divide-y divide-white/5 border border-white/10 rounded-md overflow-hidden bg-white/[0.02]">
              {matches.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between px-3 py-2 gap-2"
                >
                  <span className="truncate">
                    <span className="mr-1">{flagFor(m.home_team ?? "")}</span>
                    {m.home_team}
                    <span className="text-foreground/40 mx-2">vs</span>
                    <span className="mr-1">{flagFor(m.away_team ?? "")}</span>
                    {m.away_team}
                  </span>
                  <span className="text-xs text-foreground/50 whitespace-nowrap">
                    {formatKickoffBRT(m.kickoff_at)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="flex flex-col gap-2">
              <select
                disabled={locked}
                value={pick.team1}
                onChange={(e) =>
                  setPicks((p) => ({
                    ...p,
                    [group.name]: { ...p[group.name], team1: e.target.value },
                  }))
                }
                className="bg-white/5 border border-white/10 rounded px-2 py-1.5"
              >
                <option value="">1st place…</option>
                {group.teams.map((t) => (
                  <option key={t} value={t}>
                    {flagFor(t)} {t}
                  </option>
                ))}
              </select>
              <select
                disabled={locked}
                value={pick.team2}
                onChange={(e) =>
                  setPicks((p) => ({
                    ...p,
                    [group.name]: { ...p[group.name], team2: e.target.value },
                  }))
                }
                className="bg-white/5 border border-white/10 rounded px-2 py-1.5"
              >
                <option value="">2nd place…</option>
                {group.teams.map((t) => (
                  <option key={t} value={t}>
                    {flagFor(t)} {t}
                  </option>
                ))}
              </select>
            </div>

            {errors[group.name] ? (
              <p className="text-xs text-red-400">{errors[group.name]}</p>
            ) : null}

            <Button
              onClick={() => save(group.name)}
              disabled={!!saving || locked}
              size="sm"
              variant="secondary"
            >
              {locked
                ? "Locked"
                : saving === group.name
                  ? "Saving…"
                  : "Save group"}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
