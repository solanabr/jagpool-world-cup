import { requireOnboardedUser } from "@/lib/user-state";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { GroupStageForm } from "@/components/predictions/group-stage-form";
import { GroupStageResult } from "@/components/predictions/group-stage-result";
import { KnockoutMatchForm } from "@/components/predictions/knockout-match-form";
import { KnockoutMatchResult } from "@/components/predictions/knockout-match-result";
import { Countdown } from "@/components/predictions/countdown";
import { WC2026_GROUPS } from "@/lib/wc2026/groups";
import { isMatchReadyForPrediction, isMatchLocked } from "@/lib/wc2026/knockout";
import type {
  ChampionPrediction,
  Match,
  MatchPrediction,
  MatchStage,
} from "@/types/db";

export const dynamic = "force-dynamic";

const KNOCKOUT_STAGE_ORDER: MatchStage[] = [
  "round_of_32",
  "round_of_16",
  "quarter",
  "semi",
  "third_place",
  "final",
];

const STAGE_LABELS: Record<MatchStage, string> = {
  group: "Group stage",
  round_of_32: "Round of 32",
  round_of_16: "Round of 16",
  quarter: "Quarterfinals",
  semi: "Semifinals",
  third_place: "Third-place playoff",
  final: "Final",
};

const LATE_STAGES = new Set<MatchStage>(["semi", "third_place", "final"]);

type StageStatus = "active" | "pending" | "locked";

export default async function PredictionsPage() {
  const state = await requireOnboardedUser();
  const supabase = await createServerSupabaseClient();

  const { data: tournament, error: tournamentError } = await supabase
    .from("tournaments")
    .select("id, group_lock_at")
    .eq("is_active", true)
    .maybeSingle();
  if (tournamentError) {
    console.error("[predictions] tournament fetch failed", tournamentError);
  }
  if (!tournament) {
    return (
      <div className="text-center py-16">
        <p className="text-foreground/60">No active tournament.</p>
      </div>
    );
  }

  const [
    advancerPredsRes,
    matchPredsRes,
    championRes,
    matchesRes,
    scoresRes,
    votesRes,
    officialAdvancersRes,
  ] = await Promise.all([
      supabase
        .from("advancer_predictions")
        .select("team_name")
        .eq("user_id", state.userId)
        .eq("tournament_id", tournament.id),
      supabase
        .from("match_predictions")
        .select("*")
        .eq("user_id", state.userId),
      supabase
        .from("champion_predictions")
        .select("*")
        .eq("user_id", state.userId)
        .eq("tournament_id", tournament.id)
        .maybeSingle(),
      supabase
        .from("matches")
        .select("*")
        .eq("tournament_id", tournament.id)
        .order("match_number", { ascending: true }),
      supabase
        .from("scores")
        .select("match_id, points")
        .eq("user_id", state.userId),
      supabase.rpc("get_match_vote_tallies"),
      supabase
        .from("tournament_advancers")
        .select("team_name")
        .eq("tournament_id", tournament.id),
    ]);
  if (advancerPredsRes.error) console.error("[predictions] advancer preds fetch failed", advancerPredsRes.error);
  if (matchPredsRes.error) console.error("[predictions] match preds fetch failed", matchPredsRes.error);
  if (championRes.error) console.error("[predictions] champion fetch failed", championRes.error);
  if (matchesRes.error) console.error("[predictions] matches fetch failed", matchesRes.error);
  if (scoresRes.error) console.error("[predictions] scores fetch failed", scoresRes.error);
  if (votesRes.error) console.error("[predictions] vote tallies fetch failed", votesRes.error);
  if (officialAdvancersRes.error) console.error("[predictions] official advancers fetch failed", officialAdvancersRes.error);

  const advancerPicks = (
    (advancerPredsRes.data as { team_name: string }[]) ?? []
  ).map((r) => r.team_name);
  const officialAdvancers = (
    (officialAdvancersRes.data as { team_name: string }[]) ?? []
  ).map((r) => r.team_name);
  const matchPredictions = (matchPredsRes.data as MatchPrediction[]) ?? [];
  const championPrediction = championRes.data as ChampionPrediction | null;
  const matches = (matchesRes.data as Match[]) ?? [];

  const matchPredsByMatchId = new Map<string, MatchPrediction>();
  for (const p of matchPredictions) matchPredsByMatchId.set(p.match_id, p);

  // Sum each finalized match's score rows (knockout winner + late-stage score
  // bonuses) so a result row can show the points the user actually earned.
  const pointsByMatchId = new Map<string, number>();
  for (const r of (scoresRes.data as { match_id: string | null; points: number }[]) ?? []) {
    if (!r.match_id) continue;
    pointsByMatchId.set(r.match_id, (pointsByMatchId.get(r.match_id) ?? 0) + r.points);
  }

  // Community vote split per match (aggregate only, started/finalized matches).
  const votesByMatchId = new Map<string, { home: number; away: number }>();
  for (const r of (votesRes.data as
    | { match_id: string; home_votes: number; away_votes: number }[]
    | null) ?? []) {
    votesByMatchId.set(r.match_id, { home: r.home_votes, away: r.away_votes });
  }

  const matchesByStage = {} as Record<MatchStage, Match[]>;
  for (const m of matches) {
    matchesByStage[m.stage] ??= [];
    matchesByStage[m.stage].push(m);
  }
  const groupMatchesByGroup: Record<string, Match[]> = {};
  for (const m of matchesByStage.group ?? []) {
    if (!m.group_name) continue;
    groupMatchesByGroup[m.group_name] ??= [];
    groupMatchesByGroup[m.group_name].push(m);
  }

  // Compute each stage's status. Determines headline + which stage auto-opens.
  const now = Date.now();
  const groupLockAt = tournament.group_lock_at
    ? new Date(tournament.group_lock_at).getTime()
    : null;
  const groupsLocked = groupLockAt !== null && groupLockAt <= now;
  const advancersCompleted = advancerPicks.length >= 32;
  const championPicked = !!championPrediction;
  const groupStatus: StageStatus = groupsLocked ? "locked" : "active";

  const knockoutStatuses = new Map<MatchStage, StageStatus>();
  for (const stage of KNOCKOUT_STAGE_ORDER) {
    const stageMatches = matchesByStage[stage] ?? [];
    if (stageMatches.length === 0) {
      knockoutStatuses.set(stage, "pending");
      continue;
    }
    const allLocked = stageMatches.every((m) => isMatchLocked(m, now));
    if (allLocked) {
      knockoutStatuses.set(stage, "locked");
      continue;
    }
    const anyOpen = stageMatches.some(
      (m) =>
        isMatchReadyForPrediction(m.home_team, m.away_team) &&
        !isMatchLocked(m, now),
    );
    knockoutStatuses.set(stage, anyOpen ? "active" : "pending");
  }

  // Auto-expand: the first stage the user can act on right now.
  // Groups first if not yet locked AND not complete. Otherwise first active
  // knockout stage. If nothing is active, leave everything collapsed.
  const groupsNeedsAction =
    groupStatus === "active" && (!advancersCompleted || !championPicked);
  let autoOpenStage: MatchStage | "group" | null = null;
  if (groupsNeedsAction) {
    autoOpenStage = "group";
  } else {
    for (const stage of KNOCKOUT_STAGE_ORDER) {
      if (knockoutStatuses.get(stage) === "active") {
        autoOpenStage = stage;
        break;
      }
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold mb-1">Predictions</h1>
          <p className="text-foreground/70 text-sm max-w-xl">
            Lock in your picks for the World Cup. Each stage opens as the
            previous one resolves.
          </p>
        </div>
        {tournament.group_lock_at && !groupsLocked ? (
          <div>
            <div className="text-xs text-foreground/50 uppercase mb-1">
              Group + champion lock in
            </div>
            <Countdown target={tournament.group_lock_at} label="Locked" />
          </div>
        ) : null}
      </div>

      {/* Group stage section — wraps both groups + champion picker */}
      <StageDetails
        id="group"
        title={STAGE_LABELS.group}
        status={groupStatus}
        open={autoOpenStage === "group"}
        summary={
          <>
            <ProgressChip
              label={`Advancers ${advancerPicks.length}/32`}
              done={advancersCompleted}
            />
            <ProgressChip
              label={`Champion ${championPicked ? "✓" : "—"}`}
              done={championPicked}
            />
            {tournament.group_lock_at ? (
              <span className="text-[10px] text-foreground/50 uppercase">
                {groupsLocked ? "Locked" : "Locks soon"}
              </span>
            ) : null}
          </>
        }
      >
        {groupsLocked && officialAdvancers.length > 0 ? (
          <GroupStageResult
            groups={WC2026_GROUPS}
            picks={advancerPicks}
            officialAdvancers={officialAdvancers}
            championPick={championPrediction?.team ?? null}
          />
        ) : (
          <GroupStageForm
            tournamentId={tournament.id}
            groups={WC2026_GROUPS}
            initialPicks={advancerPicks}
            initialChampion={championPrediction?.team ?? null}
            locked={groupsLocked}
          />
        )}
      </StageDetails>

      {KNOCKOUT_STAGE_ORDER.map((stage) => {
        const stageMatches = matchesByStage[stage] ?? [];
        const status = knockoutStatuses.get(stage) ?? "pending";
        const isLateStage = LATE_STAGES.has(stage);
        const openCount = stageMatches.filter((m) =>
          isMatchReadyForPrediction(m.home_team, m.away_team) &&
          !isMatchLocked(m)
        ).length;
        const predictedCount = stageMatches.filter((m) =>
          matchPredsByMatchId.has(m.id),
        ).length;

        return (
          <StageDetails
            key={stage}
            id={stage}
            title={STAGE_LABELS[stage]}
            status={status}
            open={autoOpenStage === stage}
            summary={
              <>
                {status === "active" ? (
                  <ProgressChip
                    label={`${predictedCount}/${stageMatches.length} predicted`}
                    done={predictedCount === stageMatches.length && stageMatches.length > 0}
                  />
                ) : status === "locked" ? (
                  <span className="text-[10px] text-foreground/50 uppercase">
                    Locked
                  </span>
                ) : (
                  <span className="text-[10px] text-foreground/50 uppercase">
                    {stageMatches.length === 0
                      ? "Bracket not set"
                      : `Opens when ${openCount === 0 ? "advancers resolve" : "more matches resolve"}`}
                  </span>
                )}
                <span className="text-[10px] text-foreground/40 uppercase">
                  {isLateStage ? "Winner + scores" : "Winner only"}
                </span>
              </>
            }
          >
            {stageMatches.length === 0 ? (
              <p className="px-4 py-4 text-sm text-foreground/50">
                Bracket for this round hasn&apos;t been set up yet.
              </p>
            ) : (
              <ul className="divide-y divide-white/5">
                {stageMatches.map((m) =>
                  m.winner || isMatchLocked(m, now) ? (
                    <KnockoutMatchResult
                      key={m.id}
                      match={m}
                      prediction={matchPredsByMatchId.get(m.id) ?? null}
                      pointsEarned={pointsByMatchId.get(m.id) ?? 0}
                      votes={votesByMatchId.get(m.id)}
                    />
                  ) : (
                    <KnockoutMatchForm
                      key={m.id}
                      match={m}
                      initial={matchPredsByMatchId.get(m.id) ?? null}
                      isLateStage={isLateStage}
                    />
                  ),
                )}
              </ul>
            )}
          </StageDetails>
        );
      })}
    </div>
  );
}

function StageDetails({
  id,
  title,
  status,
  open,
  summary,
  children,
}: {
  id: string;
  title: string;
  status: StageStatus;
  open: boolean;
  summary: React.ReactNode;
  children: React.ReactNode;
}) {
  // Native <details> — zero JS, free a11y. The summary row is the clickable
  // header; the body is rendered when open. Browser handles the toggle.
  const borderClass =
    status === "active"
      ? "border-[#129D49]/40 bg-[#129D49]/5"
      : status === "locked"
        ? "border-white/10 bg-white/[0.02] opacity-80"
        : "border-white/10 bg-white/5";
  return (
    <details
      id={id}
      open={open}
      className={`rounded-xl border ${borderClass} group`}
    >
      <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Chevron />
          <h2 className="text-lg font-semibold">{title}</h2>
          <StatusBadge status={status} />
        </div>
        <div className="flex items-center gap-3 text-xs">{summary}</div>
      </summary>
      <div className="border-t border-white/5">{children}</div>
    </details>
  );
}

function StatusBadge({ status }: { status: StageStatus }) {
  const styles: Record<StageStatus, string> = {
    active: "bg-[#129D49]/20 text-[#129D49] border-[#129D49]/40",
    pending: "bg-white/5 text-foreground/50 border-white/10",
    locked: "bg-white/5 text-foreground/40 border-white/10",
  };
  const labels: Record<StageStatus, string> = {
    active: "Open",
    pending: "Waiting",
    locked: "Locked",
  };
  return (
    <span
      className={`text-[10px] uppercase px-2 py-0.5 rounded border ${styles[status]}${status === "pending" ? " hidden sm:inline" : ""}`}
    >
      {labels[status]}
    </span>
  );
}

function ProgressChip({ label, done }: { label: string; done: boolean }) {
  return (
    <span
      className={`text-[10px] uppercase ${
        done ? "text-[#129D49]" : "text-amber-300"
      }`}
    >
      {label}
    </span>
  );
}

function Chevron() {
  // Rotates on <details open> via group-open: utility — provided by Tailwind v4.
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-foreground/50 transition-transform group-open:rotate-90"
      aria-hidden
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}
