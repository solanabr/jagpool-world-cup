import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { GroupAdvancersRow } from "@/components/admin/group-advancers-row";
import { WC2026_GROUPS } from "@/lib/wc2026/groups";
import type { GroupResult } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function AdminGroupsPage() {
  const auth = await requireAdmin();
  if (!auth.ok) redirect("/dashboard");

  const supabase = await createServerSupabaseClient();
  const [tournamentRes, resultsRes] = await Promise.all([
    supabase
      .from("tournaments")
      .select("id")
      .eq("is_active", true)
      .maybeSingle(),
    supabase.from("group_results").select("*"),
  ]);

  if (tournamentRes.error) {
    console.error("[admin/groups] tournament fetch failed", tournamentRes.error);
  }
  if (resultsRes.error) {
    console.error("[admin/groups] group_results fetch failed", resultsRes.error);
  }

  const tournamentId = tournamentRes.data?.id;
  if (!tournamentId) {
    return <p className="text-foreground/60">No active tournament.</p>;
  }

  const resultsByGroup = {} as Record<string, GroupResult>;
  for (const r of (resultsRes.data as GroupResult[]) ?? []) {
    resultsByGroup[r.group_name] = r;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Group advancers</h1>
        <p className="text-sm text-foreground/60">
          Record who actually advances from each group. Saving auto-scores all
          users&apos; group predictions for that group.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {WC2026_GROUPS.map((g) => (
          <GroupAdvancersRow
            key={g.name}
            tournamentId={tournamentId}
            group={g}
            existing={resultsByGroup[g.name] ?? null}
          />
        ))}
      </div>
    </div>
  );
}
