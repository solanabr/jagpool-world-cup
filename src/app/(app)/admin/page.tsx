import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const auth = await requireAdmin();
  if (!auth.ok) redirect("/dashboard");

  // Service-role client (RLS-bypass) is safe here: requireAdmin() above has
  // already proven the caller is an admin, and this is a server component so
  // the service key never reaches the browser. The user-scoped client would
  // count only the admin's own `users` row — `users_self_select` RLS is
  // self-only — making the Users / New-users stats always read 1.
  const supabase = await createServiceRoleClient();
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
      .from("tournament_advancers")
      .select("team_name", { count: "exact", head: true }),
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
            label="Advancers set"
            value={`${finalizedGroupsRes.count ?? 0}/32`}
          />
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
