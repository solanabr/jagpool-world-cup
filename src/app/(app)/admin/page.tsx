import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const auth = await requireAdmin();
  if (!auth.ok) redirect("/dashboard");

  // Service-role (RLS-bypass) is safe: requireAdmin() proved the caller is an
  // admin and this is a server component, so the key never reaches the browser.
  // Needed because the user-scoped client's self-only RLS would under-count.
  const supabase = await createServiceRoleClient();
  const nowIso = new Date().toISOString();

  const [
    awaitingRes,
    advancersSetRes,
    snapshotRes,
    onboardedRes,
    championRes,
    advancerUsersRes,
  ] = await Promise.all([
    // Matches whose kickoff has passed but aren't finalized — the to-do list.
    supabase
      .from("matches")
      .select("id", { count: "exact", head: true })
      .lte("kickoff_at", nowIso)
      .neq("status", "completed"),
    supabase
      .from("tournament_advancers")
      .select("team_name", { count: "exact", head: true }),
    supabase
      .from("reward_snapshots")
      .select("status")
      .order("snapshotted_at", { ascending: false })
      .limit(1),
    supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .not("validator_locked_at", "is", null),
    supabase
      .from("champion_predictions")
      .select("user_id", { count: "exact", head: true }),
    supabase.from("advancer_predictions").select("user_id"),
  ]);

  if (awaitingRes.error) console.error("[admin] awaiting fetch failed", awaitingRes.error);
  if (advancersSetRes.error) console.error("[admin] advancers fetch failed", advancersSetRes.error);
  if (snapshotRes.error) console.error("[admin] snapshot fetch failed", snapshotRes.error);
  if (onboardedRes.error) console.error("[admin] onboarded fetch failed", onboardedRes.error);
  if (championRes.error) console.error("[admin] champion fetch failed", championRes.error);
  if (advancerUsersRes.error) console.error("[admin] advancer-users fetch failed", advancerUsersRes.error);

  const awaitingResults = awaitingRes.count ?? 0;
  const advancersSet = advancersSetRes.count ?? 0;
  const snapshotStatus =
    (snapshotRes.data as { status: string }[] | null)?.[0]?.status ?? "none";
  const onboarded = onboardedRes.count ?? 0;
  const championPicked = championRes.count ?? 0;
  const predictors = new Set(
    ((advancerUsersRes.data as { user_id: string }[]) ?? []).map((r) => r.user_id),
  ).size;
  const noPicks = Math.max(0, onboarded - predictors);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-3xl font-bold">Admin</h1>

      <div>
        <h2 className="text-sm text-foreground/60 uppercase mb-3">
          Needs attention
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Stat
            label="Matches awaiting results"
            value={awaitingResults}
            highlight={awaitingResults > 0}
          />
          <Stat label="Advancers set" value={`${advancersSet}/32`} />
          <Stat label="Reward snapshot" value={snapshotStatus} />
        </div>
      </div>

      <div>
        <h2 className="text-sm text-foreground/60 uppercase mb-3">Engagement</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Stat
            label="Predicted advancers"
            value={`${predictors}/${onboarded}`}
          />
          <Stat label="Champion picked" value={championPicked} />
          <Stat label="Onboarded, no picks" value={noPicks} />
        </div>
      </div>

      <div>
        <h2 className="text-sm text-foreground/60 uppercase mb-3">Admin tools</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <AdminLink
            href="/admin/results"
            title="Results"
            body="Mark group advancers + finalize knockout matches. Winners advance automatically; scoring runs on save."
          />
          <AdminLink
            href="/admin/users"
            title="User management"
            body="Grant/revoke admin. View signed-in users."
          />
          <AdminLink
            href="/admin/rewards"
            title="Reward snapshots"
            body="Snapshot the final leaderboard. Track payout status."
          />
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number | string;
  highlight?: boolean;
}) {
  return (
    <Card>
      <h3 className="text-xs text-foreground/60 mb-1">{label}</h3>
      <p
        className={`text-2xl font-bold ${highlight ? "text-jagpool-primary" : ""}`}
      >
        {value}
      </p>
    </Card>
  );
}

function AdminLink({
  href,
  title,
  body,
}: {
  href: string;
  title: string;
  body: string;
}) {
  return (
    <Link href={href} className="no-underline">
      <Card className="hover:border-jagpool-primary/50 transition cursor-pointer">
        <h3 className="font-semibold mb-1">{title}</h3>
        <p className="text-sm text-foreground/70">{body}</p>
      </Card>
    </Link>
  );
}
