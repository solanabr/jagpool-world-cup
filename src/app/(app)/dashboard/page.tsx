import Link from "next/link";
import { Target } from "lucide-react";
import { requireOnboardedUser } from "@/lib/user-state";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ValidatorLogo } from "@/components/ui/validator-logo";
import { Countdown } from "@/components/predictions/countdown";
import { formatKickoffBRT } from "@/lib/wc2026/dates";
import { flagFor } from "@/lib/wc2026/flags";
import type { Match, Tournament } from "@/types/db";
import type { UserLeaderboardRow } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const state = await requireOnboardedUser();
  const supabase = await createServerSupabaseClient();

  const validatorId = state.profile?.validator_id ?? null;

  const [
    tournamentRes,
    leaderboardRes,
    validatorRes,
    predsCountRes,
    championRes,
    nextMatchRes,
  ] = await Promise.all([
    supabase.from("tournaments").select("*").eq("is_active", true).maybeSingle(),
    supabase.rpc("get_user_leaderboard", { p_limit: 1000 }),
    validatorId
      ? supabase
          .from("validators")
          .select("name, logo_url, location, region")
          .eq("id", validatorId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("advancer_predictions")
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

  const allUsers = (leaderboardRes.data as UserLeaderboardRow[] | null) ?? [];
  const myIndex = allUsers.findIndex((r) => r.user_id === state.userId);
  const myRow = myIndex >= 0 ? allUsers[myIndex] : null;
  const points = myRow?.total_points ?? 0;
  const myRank = myIndex >= 0 ? myIndex + 1 : null;
  const totalRanked = allUsers.length;
  const top3 = allUsers.slice(0, 3);

  const validator = validatorRes.data;
  const advancersPicked = predsCountRes.count ?? 0;
  const championPicked = !!(championRes.data as { team: string } | null);
  const nextMatch = nextMatchRes.data as Match | null;
  const tournament = tournamentRes.data as Tournament | null;
  const totalAdvancers = 32;

  const lockAtIso = tournament?.group_lock_at ?? nextMatch?.kickoff_at ?? null;
  const lockPassed = lockAtIso ? new Date(lockAtIso) <= new Date() : false;
  const allPicksSubmitted = advancersPicked >= totalAdvancers && championPicked;
  const predProgress = Math.round(
    ((advancersPicked + (championPicked ? 1 : 0)) / (totalAdvancers + 1)) * 100,
  );
  const advancersLeft = Math.max(0, totalAdvancers - advancersPicked);

  return (
    <div className="flex flex-col gap-5">

      <div className="relative overflow-hidden bg-white/4 border border-white/10 rounded-2xl px-6 py-5">
        <div className="absolute inset-0 bg-linear-to-r from-[#129D49]/8 via-transparent to-transparent pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-8">

          <div className="flex items-center gap-4 flex-1 min-w-0">
            {validator ? (
              <div className="relative shrink-0">
                <ValidatorLogo url={validator.logo_url ?? null} name={validator.name} size={52} />
                <span className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5"><Target size={12} className="text-[#129D49]" /></span>
              </div>
            ) : null}
            <div className="min-w-0">
              <h1 className="text-xl font-black truncate">
                {state.profile?.username}
              </h1>
              {validator ? (
                <p className="text-sm text-foreground/55 flex items-center gap-1.5 mt-0.5 flex-wrap">
                  <span>Team:</span>
                  <span className="text-foreground/80 font-medium">{validator.name}</span>
                  {validator.region ? <RegionTag region={validator.region} /> : null}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-6">
            <Kpi label="points" value={String(points)} highlight={points > 0} />
            <div className="h-8 w-px bg-white/10 shrink-0" />
            <Kpi
              label="rank"
              value={myRank ? `#${myRank}` : "—"}
              sub={totalRanked > 0 ? `of ${totalRanked}` : undefined}
            />
            <div className="h-8 w-px bg-white/10 shrink-0" />
            <Kpi
              label="picks"
              value={`${advancersPicked + Number(championPicked)}/${totalAdvancers + 1}`}
              highlight={allPicksSubmitted}
            />
          </div>
        </div>
      </div>

      {!lockPassed && lockAtIso && !allPicksSubmitted ? (
        <PredictionsCta
          lockAtIso={lockAtIso}
          advancersPicked={advancersPicked}
          totalAdvancers={totalAdvancers}
          championPicked={championPicked}
          progress={predProgress}
        />
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

        <Link href="/predictions" className="group no-underline">
          <div className="relative overflow-hidden rounded-2xl border border-jagpool-primary/25 bg-linear-to-br from-jagpool-primary/12 via-jagpool-primary/4 to-transparent p-5 h-full flex flex-col hover:-translate-y-0.5 hover:shadow-lg hover:shadow-jagpool-primary/12 transition-all">
            <div className="flex items-start justify-between mb-5">
              <span className="text-2xl">⚽</span>
              <span className="text-[10px] text-jagpool-primary/80 uppercase tracking-widest font-semibold">
                Predictions
              </span>
            </div>

            <div className="flex-1 flex flex-col gap-2.5">
              <PickRow
                label="Advancers"
                value={`${advancersPicked} / ${totalAdvancers}`}
                done={advancersPicked >= totalAdvancers}
              />
              <PickRow
                label="Champion"
                value={championPicked ? "Locked in ✓" : "Not yet"}
                done={championPicked}
              />
              <div className="mt-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-linear-to-r from-jagpool-primary to-jagpool-primary-hover transition-all"
                  style={{ width: `${predProgress}%` }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between mt-5 pt-4 border-t border-jagpool-primary/15">
              <span className="text-sm font-semibold text-jagpool-primary">
                {allPicksSubmitted
                  ? "Review picks"
                  : advancersLeft > 0
                    ? `${advancersLeft} advancer${advancersLeft > 1 ? "s" : ""} left`
                    : "Pick champion"}
              </span>
              <Chevron className="text-jagpool-primary" />
            </div>
          </div>
        </Link>

        <Link href="/matches" className="group no-underline">
          <div className="relative overflow-hidden rounded-2xl border border-sky-500/20 bg-linear-to-br from-sky-500/12 via-sky-500/4 to-transparent p-5 h-full flex flex-col hover:-translate-y-0.5 hover:shadow-lg hover:shadow-sky-500/10 transition-all">
            <div className="flex items-start justify-between mb-5">
              <span className="text-2xl">🗓️</span>
              <span className="text-[10px] text-sky-400/60 uppercase tracking-widest font-semibold">
                Matches
              </span>
            </div>

            <div className="flex-1">
              {nextMatch ? (
                <div className="flex flex-col gap-2">
                  <p className="text-[10px] text-foreground/40 uppercase tracking-wider font-medium">
                    Next match
                  </p>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{flagFor(nextMatch.home_team ?? "")}</span>
                    <span className="text-xs text-foreground/30 font-bold">vs</span>
                    <span className="text-2xl">{flagFor(nextMatch.away_team ?? "")}</span>
                  </div>
                  <p className="text-sm font-medium text-foreground/80 leading-tight">
                    {nextMatch.home_team ?? "TBD"} — {nextMatch.away_team ?? "TBD"}
                  </p>
                  <p className="text-xs text-foreground/40">
                    {formatKickoffBRT(nextMatch.kickoff_at)}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-foreground/55 leading-relaxed">
                  Full tournament schedule and live results.
                </p>
              )}
            </div>

            <div className="flex items-center justify-between mt-5 pt-4 border-t border-sky-500/15">
              <span className="text-sm font-semibold text-sky-400">Schedule</span>
              <Chevron className="text-sky-400" />
            </div>
          </div>
        </Link>

        <Link href="/leaderboard" className="group no-underline">
          <div className="relative overflow-hidden rounded-2xl border border-[#FFD23F]/25 bg-linear-to-br from-jagpool-accent/12 via-jagpool-accent/4 to-transparent p-5 h-full flex flex-col hover:-translate-y-0.5 hover:shadow-lg hover:shadow-jagpool-accent/10 transition-all">
            <div className="flex items-start justify-between mb-5">
              <span className="text-2xl">🏆</span>
              <span className="text-[10px] text-jagpool-accent/60 uppercase tracking-widest font-semibold">
                Leaderboard
              </span>
            </div>

            <div className="flex-1 flex flex-col gap-2">
              {top3.length === 0 ? (
                <p className="text-sm text-foreground/45">No scores yet — be the first!</p>
              ) : (
                top3.map((u, i) => {
                  const isMe = u.user_id === state.userId;
                  return (
                    <div
                      key={u.user_id}
                      className={`flex items-center gap-2 text-xs ${isMe ? "text-[#FFD23F] font-semibold" : "text-foreground/60"}`}
                    >
                      <span className="w-4 shrink-0 text-[10px] text-foreground/30 tabular-nums">
                        {i + 1}
                      </span>
                      <span className="flex-1 truncate">{u.username}</span>
                      <span className="tabular-nums text-foreground/40 shrink-0">
                        {u.total_points} pts
                      </span>
                    </div>
                  );
                })
              )}
              {myRank && myRank > 3 ? (
                <>
                  <div className="text-foreground/20 text-[10px] text-center leading-none">
                    ···
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[#FFD23F] font-semibold">
                    <span className="w-4 shrink-0 tabular-nums">#{myRank}</span>
                    <span className="flex-1 truncate">{state.profile?.username}</span>
                    <span className="tabular-nums shrink-0">{points} pts</span>
                  </div>
                </>
              ) : null}
            </div>

            <div className="flex items-center justify-between mt-5 pt-4 border-t border-[#FFD23F]/15">
              <span className="text-sm font-semibold text-jagpool-accent">Rankings</span>
              <Chevron className="text-jagpool-accent" />
            </div>
          </div>
        </Link>
      </div>

      {state.profile?.jagsol_balance && state.profile.jagsol_balance !== "0" ? (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[#129D49]/5 border border-[#129D49]/20 text-sm">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-[#129D49] shrink-0">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
          <span className="text-foreground/60">JagSOL balance:</span>
          <span className="font-mono font-medium text-[#129D49]">
            {state.profile.jagsol_balance}
          </span>
          <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[#129D49] uppercase font-medium">
            Verified
          </span>
        </div>
      ) : null}
    </div>
  );
}


function RegionTag({ region }: { region: string }) {
  const colors: Record<string, string> = {
    LATAM: "text-region-latam bg-region-latam/10 border-region-latam/20",
    APAC:  "text-region-apac bg-region-apac/10 border-region-apac/20",
    ZA:    "text-region-za bg-region-za/10 border-region-za/20",
  };
  return (
    <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded border font-medium ${colors[region] ?? "text-foreground/50 border-white/10"}`}>
      {region}
    </span>
  );
}

function Kpi({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div className="text-center">
      <p className={`text-xl sm:text-2xl font-black tabular-nums leading-none ${highlight ? "text-[#129D49]" : ""}`}>
        {value}
        {sub ? (
          <span className="text-[10px] sm:text-[11px] font-normal text-foreground/30 ml-1">{sub}</span>
        ) : null}
      </p>
      <p className="text-[9px] sm:text-[10px] text-foreground/40 uppercase tracking-wide mt-1">{label}</p>
    </div>
  );
}

function PickRow({
  label,
  value,
  done,
}: {
  label: string;
  value: string;
  done: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-foreground/50">{label}</span>
      <span className={`text-xs font-medium tabular-nums ${done ? "text-[#129D49]" : "text-amber-300"}`}>
        {value}
      </span>
    </div>
  );
}

function Chevron({ className }: { className?: string }) {
  return (
    <svg
      className={`transition-transform group-hover:translate-x-0.5 ${className ?? "text-foreground/40"}`}
      width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}


function PredictionsCta({
  lockAtIso,
  advancersPicked,
  totalAdvancers,
  championPicked,
  progress,
}: {
  lockAtIso: string;
  advancersPicked: number;
  totalAdvancers: number;
  championPicked: boolean;
  progress: number;
}) {
  const advancersLeft = Math.max(0, totalAdvancers - advancersPicked);
  const ctaLabel = advancersLeft > 0
    ? `Finish ${advancersLeft} more advancer${advancersLeft === 1 ? "" : "s"} →`
    : "Pick your champion →";

  return (
    <div className="relative overflow-hidden border border-[#129D49]/40 bg-[#129D49]/5 rounded-2xl p-5">
      <div className="absolute inset-0 bg-linear-to-br from-[#129D49]/5 to-transparent pointer-events-none" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1 min-w-0">
          <div className="text-xs text-[#129D49] uppercase font-semibold mb-1">
            Submit your picks
          </div>
          <div className="font-semibold mb-2">
            Lock in your group + champion picks before time runs out.
          </div>
          <div className="flex items-center gap-2 text-xs flex-wrap">
            <span className={advancersLeft > 0 ? "text-amber-300" : "text-[#129D49]"}>
              Advancers {advancersPicked}/{totalAdvancers}
            </span>
            <span className="text-white/20">·</span>
            <span className={!championPicked ? "text-amber-300" : "text-[#129D49]"}>
              Champion {championPicked ? "✓" : "—"}
            </span>
            <span className="text-white/20">·</span>
            <span className="text-foreground/50">{formatKickoffBRT(lockAtIso)}</span>
          </div>
          <div className="mt-3 h-1.5 rounded-full bg-white/10 overflow-hidden w-full max-w-xs">
            <div
              className="h-full rounded-full bg-linear-to-r from-[#129D49] to-jagpool-accent transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <div className="flex flex-col sm:items-end gap-3 shrink-0">
          <Countdown target={lockAtIso} label="Locked" />
          <Link
            href="/predictions"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-[#129D49] text-white text-sm font-semibold hover:bg-[#129D49]-hover no-underline transition-colors shadow-md shadow-[#129D49]/20"
          >
            {ctaLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}
