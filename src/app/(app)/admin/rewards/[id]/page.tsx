import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isValidUuid } from "@/lib/security";
import { shortAddress } from "@/lib/format";
import { SnapshotCsvButton } from "@/components/admin/snapshot-csv-button";

export const dynamic = "force-dynamic";

type RewardUser = {
  rank: number;
  username: string;
  wallet_address: string;
  total_points: number;
  validator_name: string | null;
};

export default async function SnapshotDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const auth = await requireAdmin();
  if (!auth.ok) redirect("/dashboard");

  const { id } = await params;
  if (!isValidUuid(id)) redirect("/admin/rewards");

  const supabase = await createServerSupabaseClient();
  const [snapRes, rowsRes] = await Promise.all([
    supabase.from("reward_snapshots").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("reward_users")
      .select(
        "rank, username, wallet_address, total_points, validator_name",
      )
      .eq("snapshot_id", id)
      .order("rank", { ascending: true }),
  ]);

  const snapshot = snapRes.data as {
    snapshotted_at: string;
    status: string;
    notes: string | null;
  } | null;
  if (!snapshot) redirect("/admin/rewards");
  const rows = (rowsRes.data as RewardUser[]) ?? [];

  const stamp = new Date(snapshot.snapshotted_at);
  const filename = `snapshot-${stamp.toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <Link
            href="/admin/rewards"
            className="text-xs text-foreground/50 hover:text-foreground/80 no-underline"
          >
            ← Reward snapshots
          </Link>
          <h1 className="text-2xl font-bold mt-1">
            Snapshot · {stamp.toLocaleString()}
          </h1>
          <p className="text-sm text-foreground/55">
            {snapshot.status} · {rows.length} ranked
            {snapshot.notes ? ` · ${snapshot.notes}` : ""}
          </p>
        </div>
        {rows.length > 0 ? (
          <SnapshotCsvButton rows={rows} filename={filename} />
        ) : null}
      </div>

      {rows.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center text-sm text-foreground/50">
          This snapshot has no ranked users.
        </div>
      ) : (
        <div className="bg-white/4 border border-white/10 rounded-2xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-foreground/40 border-b border-white/8">
                <th className="px-4 py-2.5 font-medium">#</th>
                <th className="px-4 py-2.5 font-medium">Handle</th>
                <th className="px-4 py-2.5 font-medium">Wallet</th>
                <th className="px-4 py-2.5 font-medium text-right">Points</th>
                <th className="px-4 py-2.5 font-medium">Validator</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map((r) => (
                <tr key={r.rank}>
                  <td className="px-4 py-2.5 tabular-nums text-foreground/50">
                    {r.rank}
                  </td>
                  <td className="px-4 py-2.5 font-medium">@{r.username}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-foreground/55">
                    {shortAddress(r.wallet_address)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold">
                    {r.total_points}
                  </td>
                  <td className="px-4 py-2.5 text-foreground/60">
                    {r.validator_name ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
