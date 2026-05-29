"use client";

import { useState } from "react";
import { TeamFlag } from "@/components/ui/team-flag";

export type GroupConfig = {
  name: string;
  teams: string[];
};

const MAX_TOTAL = 32;
const MAX_PER_GROUP = 3;
const MAX_THIRD_PLACE_GROUPS = 8;

export function GroupPredictionForm({
  groups,
  initialPicks,
  onPickChange,
}: {
  groups: GroupConfig[];
  initialPicks: string[];
  onPickChange?: (picked: Set<string>) => void;
}) {
  const [picked, setPicked] = useState<Set<string>>(
    () => new Set(initialPicks),
  );

  function groupCount(groupTeams: string[], set: Set<string>) {
    return groupTeams.filter((t) => set.has(t)).length;
  }

  function groupsWithThree(set: Set<string>) {
    return groups.filter((g) => groupCount(g.teams, set) >= 3).length;
  }

  function canPick(
    team: string,
    groupTeams: string[],
    set: Set<string>,
  ): boolean {
    if (set.has(team)) return true;
    if (set.size >= MAX_TOTAL) return false;
    const gc = groupCount(groupTeams, set);
    if (gc >= MAX_PER_GROUP) return false;
    if (gc >= 2 && groupsWithThree(set) >= MAX_THIRD_PLACE_GROUPS) return false;
    return true;
  }

  function toggle(team: string, groupTeams: string[]) {
    if (!canPick(team, groupTeams, picked)) return;
    const next = new Set(picked);
    next.has(team) ? next.delete(team) : next.add(team);
    setPicked(next);
    onPickChange?.(next);
  }

  const total = picked.size;
  const done = total === MAX_TOTAL;
  const thirdSlotsFilled = groupsWithThree(picked);
  const thirdSlotsLeft = MAX_THIRD_PLACE_GROUPS - thirdSlotsFilled;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-foreground/50">
          Pick 32 advancing teams — up to 3 from 8 groups
        </p>
        <div className="flex items-center gap-4 w-full justify-between">
          <span className="text-xs text-foreground/35">
            3rd-place slots:{" "}
            <span
              className={
                thirdSlotsLeft === 0
                  ? "text-jagpool-accent font-semibold"
                  : "text-foreground/50"
              }
            >
              {thirdSlotsFilled}/{MAX_THIRD_PLACE_GROUPS}
            </span>
          </span>
          <span
            className={`text-sm font-bold tabular-nums ${done ? "text-[#129D49]" : "text-foreground/50"}`}
          >
            {total}/{MAX_TOTAL}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {groups.map((group) => {
          const gc = groupCount(group.teams, picked);
          const hasThird = gc >= 3;
          const isGroupFull = gc >= MAX_PER_GROUP;
          const noMoreThirds =
            !hasThird && gc >= 2 && thirdSlotsFilled >= MAX_THIRD_PLACE_GROUPS;
          const groupMax = hasThird || thirdSlotsLeft > 0 ? MAX_PER_GROUP : 2;

          return (
            <div key={group.name} className="flex flex-col gap-2">
              <div className="flex items-center justify-between px-0.5">
                <span className="text-[11px] font-bold uppercase tracking-widest text-foreground/40">
                  Group {group.name}
                </span>
                <span
                  className={`text-[11px] font-semibold tabular-nums ${
                    gc === 0
                      ? "text-foreground/20"
                      : hasThird
                        ? "text-jagpool-accent"
                        : gc === 2
                          ? "text-[#129D49]"
                          : "text-foreground/40"
                  }`}
                >
                  {gc}/{groupMax}
                </span>
              </div>

              <div className="flex flex-col gap-1">
                {group.teams.map((team) => {
                  const isPicked = picked.has(team);
                  const isBlocked =
                    !isPicked &&
                    (isGroupFull || total >= MAX_TOTAL || noMoreThirds);

                  return (
                    <button
                      key={team}
                      onClick={() => toggle(team, group.teams)}
                      disabled={isBlocked}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-left w-full transition-all ${
                        isPicked &&
                        hasThird &&
                        group.teams.filter((t) => picked.has(t)).at(-1) === team
                          ? "bg-jagpool-accent/12 border border-[#FFD23F]/25 text-white font-semibold"
                          : isPicked
                            ? "bg-[#129D49]/15 border border-[#129D49]/30 text-white font-semibold"
                            : isBlocked
                              ? "bg-white/3 border border-white/6 text-foreground/20 cursor-not-allowed"
                              : "bg-white/5 border border-white/8 text-foreground/60 hover:bg-white/8 hover:text-white cursor-pointer"
                      }`}
                    >
                      <TeamFlag team={team} className="shrink-0" />
                      <span className="truncate">{team}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
