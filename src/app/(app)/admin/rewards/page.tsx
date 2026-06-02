import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import Link from "next/link";
import { SnapshotCreateForm } from "@/components/admin/snapshot-create-form";
import { SnapshotCsvButton } from "@/components/admin/snapshot-csv-button";
import { SnapshotStatusButtons } from "@/components/admin/snapshot-status-buttons";
import { SnapshotDeleteButton } from "@/components/admin/snapshot-delete-button";

export const dynamic = "force-dynamic";

type Snapshot = {
  id: string;
  tournament_id: string;
  snapshotted_at: string;
  status: "draft" | "finalized" | "paid";
  notes: string | null;
};

type CsvRow = {
  rank: number;
  username: string;
  wallet_address: string;
  total_points: number;
  validator_name: string | null;
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

  // Pull every snapshot's ranked rows in one query so each history row can
  // export its own CSV without a navigation.
  const rowsBySnapshot = new Map<string, CsvRow[]>();
  if (snapshots.length) {
    const { data: rewardUsersData } = await supabase
      .from("reward_users")
      .select(
        "snapshot_id, rank, username, wallet_address, total_points, validator_name",
      )
      .in(
        "snapshot_id",
        snapshots.map((s) => s.id),
      )
      .order("rank", { ascending: true });
    for (const r of (rewardUsersData as (CsvRow & { snapshot_id: string })[]) ??
      []) {
      const list = rowsBySnapshot.get(r.snapshot_id) ?? [];
      list.push(r);
      rowsBySnapshot.set(r.snapshot_id, list);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Reward snapshots</h1>
        <p className="text-sm text-foreground/60">
          Freeze the leaderboard for payout — each snapshot stores rank, points,
          wallet, and validator at the moment created. View, export CSV, or
          delete below.
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
                <Link
                  href={`/admin/rewards/${s.id}`}
                  className="min-w-0 no-underline hover:opacity-80 transition"
                >
                  <div className="text-sm">
                    {new Date(s.snapshotted_at).toLocaleString()}
                  </div>
                  {s.notes ? (
                    <div className="text-xs text-foreground/50 truncate">
                      {s.notes}
                    </div>
                  ) : (
                    <div className="text-xs text-foreground/40">View rows →</div>
                  )}
                </Link>
                <div className="flex items-center gap-2.5 flex-wrap justify-end">
                  <span
                    className={`text-[10px] uppercase px-2 py-1 rounded border ${STATUS_BADGE[s.status]}`}
                  >
                    {s.status}
                  </span>
                  {(rowsBySnapshot.get(s.id)?.length ?? 0) > 0 ? (
                    <SnapshotCsvButton
                      rows={rowsBySnapshot.get(s.id) ?? []}
                      filename={`snapshot-${new Date(s.snapshotted_at)
                        .toISOString()
                        .slice(0, 19)
                        .replace(/[:T]/g, "-")}.csv`}
                    />
                  ) : null}
                  <SnapshotStatusButtons snapshotId={s.id} current={s.status} />
                  <SnapshotDeleteButton snapshotId={s.id} status={s.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
