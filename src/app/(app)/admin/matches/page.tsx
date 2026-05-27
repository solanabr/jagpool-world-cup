import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { FinalizeMatchRow } from "@/components/admin/finalize-match-row";
import type { Match, MatchStage } from "@/types/db";

export const dynamic = "force-dynamic";

const STAGE_LABELS: Record<MatchStage, string> = {
  group: "Group stage",
  round_of_32: "Round of 32",
  round_of_16: "Round of 16",
  quarter: "Quarterfinals",
  semi: "Semifinals",
  third_place: "Third-place playoff",
  final: "Final",
};

const STAGE_ORDER: MatchStage[] = [
  "group",
  "round_of_32",
  "round_of_16",
  "quarter",
  "semi",
  "third_place",
  "final",
];

export default async function AdminMatchesPage() {
  const auth = await requireAdmin();
  if (!auth.ok) redirect("/dashboard");

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("matches")
    .select("*")
    .order("match_number", { ascending: true });

  if (error) {
    console.error("[admin/matches] matches fetch failed", error);
  }

  const matches = (data as Match[]) ?? [];
  const byStage = {} as Record<MatchStage, Match[]>;
  for (const m of matches) {
    byStage[m.stage] ??= [];
    byStage[m.stage].push(m);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Match results</h1>
        <p className="text-sm text-foreground/60">
          Finalize matches with score + winner. Re-running scoring on a
          completed match clears its existing score events and recomputes.
        </p>
      </div>

      {STAGE_ORDER.map((stage) => {
        const stageMatches = byStage[stage] ?? [];
        if (stageMatches.length === 0) return null;
        return (
          <section key={stage}>
            <h2 className="text-sm font-semibold uppercase text-foreground/60 mb-2">
              {STAGE_LABELS[stage]} ({stageMatches.length})
            </h2>
            <ul className="bg-white/5 border border-white/10 rounded-xl divide-y divide-white/5">
              {stageMatches.map((m) => (
                <FinalizeMatchRow key={m.id} match={m} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
