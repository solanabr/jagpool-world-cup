"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TeamFlag } from "@/components/ui/team-flag";
import type { WcGroup } from "@/lib/wc2026/groups";

const MAX_TOTAL = 32;
const MAX_PER_GROUP = 3;
const MAX_THIRD_PLACE_GROUPS = 8;

export function AdvancersGrid({
  tournamentId,
  groups,
  initialTeams,
}: {
  tournamentId: string;
  groups: WcGroup[];
  initialTeams: string[];
}) {
  const router = useRouter();
  const [picked, setPicked] = useState<Set<string>>(
    () => new Set(initialTeams),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function groupCount(teams: string[], set: Set<string>) {
    return teams.filter((t) => set.has(t)).length;
  }
  function groupsWithThree(set: Set<string>) {
    return groups.filter((g) => groupCount(g.teams, set) >= 3).length;
  }
  function canPick(team: string, teams: string[], set: Set<string>): boolean {
    if (set.has(team)) return true;
    if (set.size >= MAX_TOTAL) return false;
    const gc = groupCount(teams, set);
    if (gc >= MAX_PER_GROUP) return false;
    if (gc >= 2 && groupsWithThree(set) >= MAX_THIRD_PLACE_GROUPS) return false;
    return true;
  }
  function toggle(team: string, teams: string[]) {
    if (!canPick(team, teams, picked)) return;
    const next = new Set(picked);
    next.has(team) ? next.delete(team) : next.add(team);
    setPicked(next);
    setSuccess(null);
    setError(null);
  }

  const total = picked.size;
  const complete = total === MAX_TOTAL;
  const thirds = groupsWithThree(picked);

  async function save() {
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      const advancers: { groupName: string; teamName: string }[] = [];
      for (const g of groups) {
        for (const t of g.teams) {
          if (picked.has(t)) advancers.push({ groupName: g.name, teamName: t });
        }
      }
      const res = await fetch("/api/admin/group-advancers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tournamentId, advancers }),
      });
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.details ?? json.error ?? "Save failed");
      setSuccess(`Saved · scored ${json.scoring?.eventsWritten ?? 0} users`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-foreground/50">
          Mark the 32 teams that advanced — 2 or 3 per group
        </p>
        <div className="flex items-center gap-4">
          <span className="text-xs text-foreground/40">
            3rd-place: {thirds}/{MAX_THIRD_PLACE_GROUPS}
          </span>
          <span
            className={`text-sm font-bold tabular-nums ${complete ? "text-[#129D49]" : "text-foreground/50"}`}
          >
            {total}/{MAX_TOTAL}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {groups.map((group) => {
          const gc = groupCount(group.teams, picked);
          return (
            <div key={group.name} className="flex flex-col gap-2">
              <div className="flex items-center justify-between px-0.5">
                <span className="text-[11px] font-bold uppercase tracking-widest text-foreground/40">
                  Group {group.name}
                </span>
                <span
                  className={`text-[11px] font-semibold tabular-nums ${
                    gc >= 2 ? "text-[#129D49]" : "text-foreground/30"
                  }`}
                >
                  {gc}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                {group.teams.map((team) => {
                  const isPicked = picked.has(team);
                  const blocked = !isPicked && !canPick(team, group.teams, picked);
                  return (
                    <button
                      key={team}
                      onClick={() => toggle(team, group.teams)}
                      disabled={blocked}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left w-full transition-all ${
                        isPicked
                          ? "bg-[#129D49]/15 border border-[#129D49]/30 text-white font-semibold"
                          : blocked
                            ? "bg-white/3 border border-white/6 text-foreground/20 cursor-not-allowed"
                            : "bg-white/5 border border-white/8 text-foreground/60 hover:bg-white/8 hover:text-white"
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

      {error ? <p className="text-xs text-red-400">{error}</p> : null}
      {success ? <p className="text-xs text-[#129D49]">{success}</p> : null}

      <button
        onClick={save}
        disabled={!complete || busy}
        className={`w-full py-3 rounded-xl text-sm font-semibold transition-all ${
          complete && !busy
            ? "bg-[#129D49] text-white hover:bg-[#129D49]-hover"
            : "bg-white/5 border border-white/10 text-foreground/30 cursor-not-allowed"
        }`}
      >
        {busy
          ? "Saving…"
          : complete
            ? "Save advancers & score"
            : `${MAX_TOTAL - total} more to mark`}
      </button>
    </div>
  );
}
