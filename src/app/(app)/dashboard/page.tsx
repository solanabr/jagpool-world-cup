import Link from "next/link";
import { requireOnboardedUser } from "@/lib/user-state";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { ValidatorLogo } from "@/components/ui/validator-logo";
import { Countdown } from "@/components/predictions/countdown";
import { formatKickoffBRT } from "@/lib/wc2026/dates";
import { flagFor } from "@/lib/wc2026/flags";
import { WC2026_GROUPS } from "@/lib/wc2026/groups";
import type { Match } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const state = await requireOnboardedUser();
  const supabase = await createServerSupabaseClient();

  const validatorId = state.profile?.validator_id ?? null;

  const [tournamentRes, pointsRes, validatorRes, predsCountRes, nextMatchRes] =
    await Promise.all([
      supabase
        .from("tournaments")
        .select("*")
        .eq("is_active", true)
        .maybeSingle(),
      supabase
        .from("user_leaderboard")
        .select("total_points")
        .eq("user_id", state.userId)
        .maybeSingle(),
      validatorId
        ? supabase
            .from("validators")
            .select("name, logo_url, location, region")
            .eq("id", validatorId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("group_predictions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", state.userId),
      supabase
        .from("matches")
        .select("*")
        .eq("status", "upcoming")
        .order("kickoff_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);

  const points = pointsRes.data?.total_points ?? 0;
  const validator = validatorRes.data;
  const groupsPicked = predsCountRes.count ?? 0;
  const nextMatch = nextMatchRes.data as Match | null;
  const totalGroups = WC2026_GROUPS.length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        {validator ? (
          <ValidatorLogo
            url={validator.logo_url ?? null}
            name={validator.name}
            size={48}
          />
        ) : null}
        <div>
          <h1 className="text-2xl font-bold">
            Hello, {state.profile?.username}
          </h1>
          {validator ? (
            <p className="text-sm text-foreground/60">
              Team: <span className="text-foreground/90">{validator.name}</span>
              {validator.region ? ` · ${validator.region}` : null}
            </p>
          ) : null}
        </div>
      </div>

      {nextMatch ? (
        <Card>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="text-xs text-foreground/50 uppercase mb-1">
                Next match
              </div>
              <div className="font-medium">
                <span className="mr-1">{flagFor(nextMatch.home_team ?? "")}</span>
                {nextMatch.home_team}
                <span className="mx-2 text-foreground/40">vs</span>
                <span className="mr-1">{flagFor(nextMatch.away_team ?? "")}</span>
                {nextMatch.away_team}
              </div>
              <div className="text-xs text-foreground/60 mt-1">
                {formatKickoffBRT(nextMatch.kickoff_at)}
                {nextMatch.venue ? ` · ${nextMatch.venue}` : null}
              </div>
            </div>
            <Countdown target={nextMatch.kickoff_at} />
          </div>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <h3 className="text-sm text-foreground/60 mb-1">Your points</h3>
          <p className="text-3xl font-bold">{points}</p>
        </Card>
        <Card>
          <h3 className="text-sm text-foreground/60 mb-1">Group picks</h3>
          <p className="text-3xl font-bold">
            {groupsPicked}
            <span className="text-base text-foreground/40">/{totalGroups}</span>
          </p>
        </Card>
        <Card>
          <h3 className="text-sm text-foreground/60 mb-1">JagSOL</h3>
          <p className="text-3xl font-bold">
            {state.profile?.jagsol_balance ?? "—"}
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/predictions/groups" className="no-underline">
          <Card className="hover:border-jagpool-primary/50 transition cursor-pointer">
            <h3 className="font-semibold mb-1">Group stage</h3>
            <p className="text-sm text-foreground/70">
              Pick 2 teams per group to advance
            </p>
          </Card>
        </Link>
        <Link href="/matches" className="no-underline">
          <Card className="hover:border-jagpool-primary/50 transition cursor-pointer">
            <h3 className="font-semibold mb-1">Matches</h3>
            <p className="text-sm text-foreground/70">
              Full schedule, dates, and results
            </p>
          </Card>
        </Link>
        <Link href="/leaderboard" className="no-underline">
          <Card className="hover:border-jagpool-primary/50 transition cursor-pointer">
            <h3 className="font-semibold mb-1">Leaderboard</h3>
            <p className="text-sm text-foreground/70">
              Global ranking + per-validator standings
            </p>
          </Card>
        </Link>
      </div>
    </div>
  );
}
