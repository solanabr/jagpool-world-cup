import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { AdvancersGrid } from "@/components/admin/advancers-grid";
import { FinalizeMatchRow } from "@/components/admin/finalize-match-row";
import { WC2026_GROUPS } from "@/lib/wc2026/groups";
import type { Match, MatchStage } from "@/types/db";

export const dynamic = "force-dynamic";

const KNOCKOUT_ORDER: MatchStage[] = [
  "round_of_32",
  "round_of_16",
  "quarter",
  "semi",
  "third_place",
  "final",
];

const STAGE_LABELS: Record<MatchStage, string> = {
  group: "Group stage",
  round_of_32: "Round of 32",
  round_of_16: "Round of 16",
  quarter: "Quarterfinals",
  semi: "Semifinals",
  third_place: "Third-place playoff",
  final: "Final",
};

const LATE_STAGES = new Set<MatchStage>(["semi", "third_place", "final"]);

export default async function AdminResultsPage() {
  const auth = await requireAdmin();
  if (!auth.ok) redirect("/dashboard");

  const supabase = await createServerSupabaseClient();
  const [tournamentRes, matchesRes, advancersRes] = await Promise.all([
    supabase.from("tournaments").select("id").eq("is_active", true).maybeSingle(),
    supabase.from("matches").select("*").order("match_number", { ascending: true }),
    supabase.from("tournament_advancers").select("team_name"),
  ]);
  if (tournamentRes.error) console.error("[admin/results] tournament fetch failed", tournamentRes.error);
  if (matchesRes.error) console.error("[admin/results] matches fetch failed", matchesRes.error);
  if (advancersRes.error) console.error("[admin/results] advancers fetch failed", advancersRes.error);

  const tournamentId = tournamentRes.data?.id;
  if (!tournamentId) {
    return <p className="text-foreground/60">No active tournament.</p>;
  }

  const matches = (matchesRes.data as Match[]) ?? [];
  const byStage = {} as Record<MatchStage, Match[]>;
  for (const m of matches) {
    byStage[m.stage] ??= [];
    byStage[m.stage].push(m);
  }
  const initialTeams = ((advancersRes.data as { team_name: string }[]) ?? []).map(
    (r) => r.team_name,
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold mb-1">Results</h1>
        <p className="text-sm text-foreground/60">
          Mark group advancers and finalize knockout matches. Winners advance to
          the next round automatically.
        </p>
      </div>

      {/* Group stage — record the 32 advancers */}
      <details open className="rounded-xl border border-jagpool-primary/40 bg-jagpool-primary/5 group">
        <summary className="cursor-pointer list-none px-4 py-3 flex items-center gap-3">
          <Chevron />
          <h2 className="text-lg font-semibold">Group advancers</h2>
          <span className="text-[10px] uppercase px-2 py-0.5 rounded border border-jagpool-primary/40 bg-jagpool-primary/20 text-jagpool-primary">
            {initialTeams.length}/32 set
          </span>
        </summary>
        <div className="border-t border-white/5 p-4">
          <AdvancersGrid
            tournamentId={tournamentId}
            groups={WC2026_GROUPS}
            initialTeams={initialTeams}
          />
        </div>
      </details>

      {/* Knockout stages — finalize matches */}
      {KNOCKOUT_ORDER.map((stage) => {
        const stageMatches = byStage[stage] ?? [];
        if (stageMatches.length === 0) return null;
        const done = stageMatches.filter((m) => m.status === "completed").length;
        return (
          <details key={stage} className="rounded-xl border border-white/10 bg-white/5 group">
            <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <Chevron />
                <h2 className="text-lg font-semibold">{STAGE_LABELS[stage]}</h2>
              </div>
              <span className="text-xs text-foreground/40">
                {done}/{stageMatches.length} finalized ·{" "}
                {LATE_STAGES.has(stage) ? "score + winner" : "winner only"}
              </span>
            </summary>
            <ul className="border-t border-white/5 divide-y divide-white/5">
              {stageMatches.map((m) => (
                <FinalizeMatchRow key={m.id} match={m} />
              ))}
            </ul>
          </details>
        );
      })}
    </div>
  );
}

function Chevron() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-foreground/50 transition-transform group-open:rotate-90"
      aria-hidden
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}
