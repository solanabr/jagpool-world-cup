import { requireOnboardedUser } from "@/lib/user-state";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { formatKickoffBRT } from "@/lib/wc2026/dates";
import { flagFor } from "@/lib/wc2026/flags";
import type { Match, MatchStage, MatchStatus } from "@/types/db";

export const dynamic = "force-dynamic";

const STAGE_LABELS: Record<MatchStage, string> = {
  group: "Group stage",
  round_of_32: "Round of 32",
  round_of_16: "Round of 16",
  quarter: "Quarterfinals",
  semi: "Semifinals",
  third_place: "Third-place playoff",
  final: "Final",
};

const STAGE_ORDER: MatchStage[] = [
  "group",
  "round_of_32",
  "round_of_16",
  "quarter",
  "semi",
  "third_place",
  "final",
];

export default async function MatchesPage() {
  await requireOnboardedUser();
  const supabase = await createServerSupabaseClient();

  const { data } = await supabase
    .from("matches")
    .select("*")
    .order("match_number", { ascending: true });

  const matches = (data as Match[]) ?? [];
  const byStage = {} as Record<MatchStage, Match[]>;
  for (const m of matches) {
    byStage[m.stage] ??= [];
    byStage[m.stage].push(m);
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold mb-1">All matches</h1>
        <p className="text-sm text-foreground/60">
          Full FIFA WC 2026 schedule. Times in Brasília (BRT, UTC-3).
        </p>
      </div>

      {STAGE_ORDER.map((stage) => {
        const stageMatches = byStage[stage] ?? [];
        if (stageMatches.length === 0) return null;
        return (
          <section key={stage}>
            <h2 className="text-lg font-semibold mb-3">
              {STAGE_LABELS[stage]}{" "}
              <span className="text-sm text-foreground/40 font-normal">
                ({stageMatches.length})
              </span>
            </h2>
            <ul className="bg-white/5 border border-white/10 rounded-xl divide-y divide-white/5">
              {stageMatches.map((m) => (
                <MatchRow key={m.id} match={m} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function MatchRow({ match }: { match: Match }) {
  const isDone = match.status === "completed";
  return (
    <li className="px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-xs text-foreground/40 font-mono w-9 shrink-0">
          #{match.match_number}
        </span>
        {match.group_name ? (
          <span className="text-[10px] px-1.5 py-0.5 rounded border border-white/10 bg-white/5 text-foreground/60 shrink-0">
            {match.group_name}
          </span>
        ) : null}
        <span className="truncate text-sm">
          <span className="mr-1">{flagFor(match.home_team ?? "")}</span>
          {match.home_team ?? "TBD"}
          {isDone && match.home_score != null ? (
            <span className="ml-2 font-mono text-foreground">
              {match.home_score}
            </span>
          ) : null}
          <span className="mx-2 text-foreground/40">vs</span>
          {isDone && match.away_score != null ? (
            <span className="mr-2 font-mono text-foreground">
              {match.away_score}
            </span>
          ) : null}
          <span className="mr-1">{flagFor(match.away_team ?? "")}</span>
          {match.away_team ?? "TBD"}
        </span>
      </div>
      <div className="text-xs text-foreground/50 whitespace-nowrap flex items-center gap-2 shrink-0">
        <StatusBadge status={match.status} />
        <span>{formatKickoffBRT(match.kickoff_at)}</span>
        {match.venue ? <span>· {match.venue}</span> : null}
      </div>
    </li>
  );
}

function StatusBadge({ status }: { status: MatchStatus }) {
  if (status === "upcoming") return null;
  const styles: Record<Exclude<MatchStatus, "upcoming">, string> = {
    live: "bg-jagpool-primary/20 text-jagpool-primary border-jagpool-primary/40",
    locked: "bg-amber-500/20 text-amber-400 border-amber-500/40",
    completed: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
    cancelled: "bg-red-500/20 text-red-400 border-red-500/40",
  };
  return (
    <span
      className={`text-[10px] uppercase px-1.5 py-0.5 rounded border ${styles[status]}`}
    >
      {status === "completed" ? "done" : status}
    </span>
  );
}
