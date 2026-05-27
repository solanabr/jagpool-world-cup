import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const auth = await requireAdmin();
  if (!auth.ok) redirect("/dashboard");

  const supabase = await createServerSupabaseClient();
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();

  const [
    usersRes,
    validatorsRes,
    matchesRes,
    upcomingRes,
    completedRes,
    pendingScoringRes,
    newUsersRes,
    finalizedGroupsRes,
  ] = await Promise.all([
    supabase.from("users").select("id", { count: "exact", head: true }),
    supabase
      .from("validators")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true),
    supabase.from("matches").select("id", { count: "exact", head: true }),
    supabase
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq("status", "upcoming"),
    supabase
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq("status", "completed"),
    supabase
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq("status", "completed")
      .is("winner", null),
    supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .gte("created_at", dayAgo),
    supabase
      .from("group_results")
      .select("group_name", { count: "exact", head: true }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-3xl font-bold">Admin</h1>

      <div>
        <h2 className="text-sm text-foreground/60 uppercase mb-3">Overview</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Users" value={usersRes.count ?? 0} />
          <Stat label="Active validators" value={validatorsRes.count ?? 0} />
          <Stat label="Matches" value={matchesRes.count ?? 0} />
          <Stat label="New users (24h)" value={newUsersRes.count ?? 0} />
        </div>
      </div>

      <div>
        <h2 className="text-sm text-foreground/60 uppercase mb-3">
          Match status
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Stat label="Upcoming" value={upcomingRes.count ?? 0} />
          <Stat label="Completed" value={completedRes.count ?? 0} />
          <Stat
            label="Needs winner set"
            value={pendingScoringRes.count ?? 0}
            highlight={!!pendingScoringRes.count}
          />
          <Stat
            label="Groups finalized"
            value={finalizedGroupsRes.count ?? 0}
          />
        </div>
      </div>

      <div>
        <h2 className="text-sm text-foreground/60 uppercase mb-3">Admin tools</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <AdminLink
            href="/admin/matches"
            title="Match results"
            body="Finalize matches with score + winner. Rescore on correction."
          />
          <AdminLink
            href="/admin/groups"
            title="Group advancers"
            body="Record who actually advanced from each group. Auto-scores predictions."
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
  value: number;
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
