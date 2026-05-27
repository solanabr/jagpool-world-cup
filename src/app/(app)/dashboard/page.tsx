import Link from "next/link";
import { requireOnboardedUser } from "@/lib/user-state";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { ValidatorLogo } from "@/components/ui/validator-logo";
import { Countdown } from "@/components/predictions/countdown";
import { formatKickoffBRT } from "@/lib/wc2026/dates";
import { flagFor } from "@/lib/wc2026/flags";
import { WC2026_GROUPS } from "@/lib/wc2026/groups";
import type { Match, Tournament } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const state = await requireOnboardedUser();
  const supabase = await createServerSupabaseClient();

  const validatorId = state.profile?.validator_id ?? null;

  const [
    tournamentRes,
    pointsRes,
    validatorRes,
    predsCountRes,
    championRes,
    nextMatchRes,
  ] = await Promise.all([
    supabase
      .from("tournaments")
      .select("*")
      .eq("is_active", true)
      .maybeSingle(),
    supabase.rpc("get_user_leaderboard", { p_limit: 1000 }),
    validatorId
      ? supabase
          .from("validators")
          .select("name, logo_url, location, region")
          .eq("id", validatorId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("group_predictions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", state.userId),
    supabase
      .from("champion_predictions")
      .select("team")
      .eq("user_id", state.userId)
      .maybeSingle(),
    supabase
      .from("matches")
      .select("*")
      .eq("status", "upcoming")
      .order("kickoff_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  if (tournamentRes.error) console.error("[dashboard] tournament fetch failed", tournamentRes.error);
  if (pointsRes.error) console.error("[dashboard] leaderboard RPC failed", pointsRes.error);
  if ("error" in validatorRes && validatorRes.error) {
    console.error("[dashboard] validator fetch failed", validatorRes.error);
  }
  if (predsCountRes.error) console.error("[dashboard] preds count failed", predsCountRes.error);
  if (championRes.error) console.error("[dashboard] champion fetch failed", championRes.error);
  if (nextMatchRes.error) console.error("[dashboard] next match fetch failed", nextMatchRes.error);

  const myRow = (pointsRes.data as { user_id: string; total_points: number }[] | null)?.find(
    (r) => r.user_id === state.userId,
  );
  const points = myRow?.total_points ?? 0;
  const validator = validatorRes.data;
  const groupsPicked = predsCountRes.count ?? 0;
  const championPicked = !!(championRes.data as { team: string } | null);
  const nextMatch = nextMatchRes.data as Match | null;
  const tournament = tournamentRes.data as Tournament | null;
  const totalGroups = WC2026_GROUPS.length;

  // The lock deadline is the moment that matters for the user — that's when
  // they can no longer submit picks. If no lock_at is configured, fall back
  // to the first match's kickoff (predictions effectively lock when matches
  // start anyway).
  const lockAtIso = tournament?.group_lock_at ?? nextMatch?.kickoff_at ?? null;
  const lockPassed = lockAtIso ? new Date(lockAtIso) <= new Date() : false;
  const allPicksSubmitted = groupsPicked >= totalGroups && championPicked;

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

      {/* Pre-lock: drive action ("submit your picks"). Post-lock: show next
          match info — by then the user can't act on group/champion anymore. */}
      {!lockPassed && lockAtIso ? (
        <PredictionsCta
          lockAtIso={lockAtIso}
          groupsPicked={groupsPicked}
          totalGroups={totalGroups}
          championPicked={championPicked}
          allSubmitted={allPicksSubmitted}
        />
      ) : nextMatch ? (
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

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <NavCard
          href="/predictions"
          title="Predictions"
          body="Groups, knockout, champion — all picks in one place"
        />
        <NavCard
          href="/matches"
          title="Matches"
          body="Schedule + results"
        />
        <NavCard
          href="/leaderboard"
          title="Leaderboard & rewards"
          body="Your rank, top users, payouts"
        />
      </div>
    </div>
  );
}

function NavCard({
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
      <Card className="hover:border-jagpool-primary/50 transition cursor-pointer h-full">
        <h3 className="font-semibold mb-1">{title}</h3>
        <p className="text-sm text-foreground/70">{body}</p>
      </Card>
    </Link>
  );
}

function PredictionsCta({
  lockAtIso,
  groupsPicked,
  totalGroups,
  championPicked,
  allSubmitted,
}: {
  lockAtIso: string;
  groupsPicked: number;
  totalGroups: number;
  championPicked: boolean;
  allSubmitted: boolean;
}) {
  const groupsRemaining = Math.max(0, totalGroups - groupsPicked);
  // CTA destination — all on one timeline page; the group section auto-opens
  // when the user lands.
  const ctaHref = "/predictions#group";
  const ctaLabel = allSubmitted
    ? "Review your picks"
    : groupsRemaining > 0
      ? `Finish ${groupsRemaining} group ${groupsRemaining === 1 ? "pick" : "picks"}`
      : "Pick your champion";

  return (
    <Card className="border-jagpool-primary/40 bg-jagpool-primary/5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-xs text-jagpool-primary uppercase mb-1 font-semibold">
            {allSubmitted ? "You're all set" : "Submit your picks"}
          </div>
          <div className="font-medium">
            {allSubmitted
              ? "Predictions lock at the deadline below — good luck!"
              : "Lock in your group + champion picks before the deadline."}
          </div>
          <div className="text-xs text-foreground/60 mt-1">
            Locks {formatKickoffBRT(lockAtIso)} ·{" "}
            <span className={groupsRemaining > 0 ? "text-amber-300" : ""}>
              Groups {groupsPicked}/{totalGroups}
            </span>{" "}
            ·{" "}
            <span className={!championPicked ? "text-amber-300" : ""}>
              Champion {championPicked ? "✓" : "—"}
            </span>
          </div>
        </div>
        <div className="flex flex-col sm:items-end gap-3">
          <Countdown target={lockAtIso} label="Locked" />
          <Link
            href={ctaHref}
            className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-jagpool-primary text-white text-sm font-medium hover:bg-jagpool-primary-hover no-underline"
          >
            {ctaLabel} →
          </Link>
        </div>
      </div>
    </Card>
  );
}
