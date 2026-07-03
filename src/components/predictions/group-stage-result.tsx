import { TeamFlag } from "@/components/ui/team-flag";
import type { GroupConfig } from "./group-prediction-form";

type TeamState = "correct" | "wrong" | "missed" | "none";

const STATE_CLASS: Record<TeamState, string> = {
  correct: "bg-[#129D49]/15 border border-[#129D49]/40 text-white",
  wrong: "bg-red-500/12 border border-red-500/35 text-red-300",
  missed: "bg-jagpool-accent/10 border border-[#FFD23F]/30 text-jagpool-accent",
  none: "bg-white/3 border border-white/6 text-foreground/25",
};

// Read-only results view of the locked group-stage advancer picks, colour-coded
// against the official advancer set: green = correct pick, red = a pick that was
// eliminated, amber = a team that advanced but wasn't picked. Rendered by the
// predictions page in place of the editable GroupStageForm once the group stage
// is locked AND the official advancers are set — so Jota's form stays untouched.
export function GroupStageResult({
  groups,
  picks,
  officialAdvancers,
  championPick,
}: {
  groups: GroupConfig[];
  picks: string[];
  officialAdvancers: string[];
  championPick: string | null;
}) {
  const pickedSet = new Set(picks);
  const advancedSet = new Set(officialAdvancers);

  const stateOf = (team: string): TeamState => {
    const picked = pickedSet.has(team);
    const advanced = advancedSet.has(team);
    if (picked && advanced) return "correct";
    if (picked && !advanced) return "wrong";
    if (!picked && advanced) return "missed";
    return "none";
  };

  const correctCount = picks.filter((t) => advancedSet.has(t)).length;

  return (
    <div className="flex flex-col gap-5 px-4 pb-5 pt-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3 flex-wrap text-[11px]">
          <LegendDot className="bg-[#129D49]" label="Correct" />
          <LegendDot className="bg-red-500" label="Wrong" />
          <LegendDot className="bg-jagpool-accent" label="Missed" />
        </div>
        <span className="text-sm font-bold tabular-nums text-[#129D49]">
          {correctCount}/{picks.length} correct
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {groups.map((group) => {
          const groupCorrect = group.teams.filter(
            (t) => pickedSet.has(t) && advancedSet.has(t),
          ).length;
          const groupAdvanced = group.teams.filter((t) =>
            advancedSet.has(t),
          ).length;
          return (
            <div key={group.name} className="flex flex-col gap-2">
              <div className="flex items-center justify-between px-0.5">
                <span className="text-[11px] font-bold uppercase tracking-widest text-foreground/40">
                  Group {group.name}
                </span>
                <span className="text-[11px] font-semibold tabular-nums text-foreground/40">
                  {groupCorrect}/{groupAdvanced}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                {group.teams.map((team) => {
                  const state = stateOf(team);
                  return (
                    <div
                      key={team}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm ${STATE_CLASS[state]}`}
                    >
                      <TeamFlag team={team} className="shrink-0" />
                      <span className="truncate flex-1">{team}</span>
                      {state === "correct" ? (
                        <span aria-hidden className="text-[#129D49]">
                          ✓
                        </span>
                      ) : state === "wrong" ? (
                        <span aria-hidden className="text-red-400">
                          ✗
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {championPick ? (
        <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 flex items-center gap-2 text-sm flex-wrap">
          <span className="text-foreground/50">Champion pick:</span>
          <TeamFlag team={championPick} />
          <span className="font-semibold">{championPick}</span>
          <span className="ml-auto text-xs text-foreground/40">
            +30 pts if they win the final
          </span>
        </div>
      ) : null}
    </div>
  );
}

function LegendDot({
  className,
  label,
}: {
  className: string;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-foreground/45">
      <span className={`w-2.5 h-2.5 rounded-full ${className}`} />
      {label}
    </span>
  );
}
