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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Stat label="Upcoming" value={upcomingRes.count ?? 0} />
          <Stat label="Completed" value={completedRes.count ?? 0} />
          <Stat
            label="Needs winner set"
            value={pendingScoringRes.count ?? 0}
            highlight={!!pendingScoringRes.count}
          />
        </div>
      </div>

      <p className="text-xs text-foreground/40">
        Admin APIs: <code>POST /api/admin/matches</code>,{" "}
        <code>PATCH /api/admin/matches/[id]</code>,{" "}
        <code>POST /api/admin/validators</code>,{" "}
        <code>PATCH /api/admin/tournament</code>. Full UI is the frontend dev&apos;s scope.
      </p>
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
