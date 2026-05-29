import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SnapshotCreateForm } from "@/components/admin/snapshot-create-form";
import { SnapshotStatusButtons } from "@/components/admin/snapshot-status-buttons";

export const dynamic = "force-dynamic";

type Snapshot = {
  id: string;
  tournament_id: string;
  snapshotted_at: string;
  status: "draft" | "finalized" | "paid";
  notes: string | null;
};

const STATUS_BADGE: Record<Snapshot["status"], string> = {
  draft: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  finalized: "border-emerald-500/40 bg-emerald-500/10 text-[#129D49]",
  paid: "border-[#129D49]/40 bg-[#129D49]/10 text-[#129D49]",
};

export default async function AdminRewardsPage() {
  const auth = await requireAdmin();
  if (!auth.ok) redirect("/dashboard");

  const supabase = await createServerSupabaseClient();
  const [tournamentRes, snapshotsRes] = await Promise.all([
    supabase
      .from("tournaments")
      .select("id")
      .eq("is_active", true)
      .maybeSingle(),
    supabase
      .from("reward_snapshots")
      .select("*")
      .order("snapshotted_at", { ascending: false }),
  ]);

  if (tournamentRes.error) {
    console.error("[admin/rewards] tournament fetch failed", tournamentRes.error);
  }
  if (snapshotsRes.error) {
    console.error("[admin/rewards] snapshots fetch failed", snapshotsRes.error);
  }

  const tournamentId = tournamentRes.data?.id;
  if (!tournamentId) {
    return <p className="text-foreground/60">No active tournament.</p>;
  }

  const snapshots = (snapshotsRes.data as Snapshot[]) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Reward snapshots</h1>
        <p className="text-sm text-foreground/60">
          Create immutable leaderboard snapshots for payout. Snapshots store
          rank, points, wallet, and validator at the moment created.
        </p>
      </div>

      <SnapshotCreateForm tournamentId={tournamentId} />

      <section>
        <h2 className="text-sm uppercase text-foreground/60 mb-3">
          History ({snapshots.length})
        </h2>
        {snapshots.length === 0 ? (
          <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center text-sm text-foreground/50">
            No snapshots yet.
          </div>
        ) : (
          <ul className="bg-white/5 border border-white/10 rounded-xl divide-y divide-white/5">
            {snapshots.map((s) => (
              <li
                key={s.id}
                className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap"
              >
                <div className="min-w-0">
                  <div className="text-sm">
                    {new Date(s.snapshotted_at).toLocaleString()}
                  </div>
                  {s.notes ? (
                    <div className="text-xs text-foreground/50 truncate">
                      {s.notes}
                    </div>
                  ) : null}
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-[10px] uppercase px-2 py-1 rounded border ${STATUS_BADGE[s.status]}`}
                  >
                    {s.status}
                  </span>
                  <SnapshotStatusButtons snapshotId={s.id} current={s.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
