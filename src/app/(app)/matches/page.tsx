import { requireOnboardedUser } from "@/lib/user-state";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { flagFor } from "@/lib/wc2026/flags";
import type { Match, MatchStage, MatchStatus } from "@/types/db";

export const dynamic = "force-dynamic";

const STAGE_SHORT: Partial<Record<MatchStage, string>> = {
  round_of_32: "R32",
  round_of_16: "R16",
  quarter:     "QF",
  semi:        "SF",
  third_place: "3rd",
  final:       "Final",
};


function toBRTDateKey(iso: string): string {
  const ms = new Date(iso).getTime() - 3 * 60 * 60 * 1000;
  return new Date(ms).toISOString().slice(0, 10);
}

function formatTime(iso: string): string {
  const ms = new Date(iso).getTime() - 3 * 60 * 60 * 1000;
  const d = new Date(ms);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

function parseDateKey(dateKey: string) {
  const d = new Date(dateKey + "T12:00:00Z");
  return {
    day:     d.toLocaleDateString("en-US", { day: "numeric",     timeZone: "UTC" }),
    month:   d.toLocaleDateString("en-US", { month: "short",     timeZone: "UTC" }),
    weekday: d.toLocaleDateString("en-US", { weekday: "long",    timeZone: "UTC" }),
  };
}

function todayBRT(): string {
  return toBRTDateKey(new Date().toISOString());
}


export default async function MatchesPage() {
  await requireOnboardedUser();
  const supabase = await createServerSupabaseClient();

  const { data } = await supabase
    .from("matches")
    .select("*")
    .order("match_number", { ascending: true });

  const matches = (data as Match[]) ?? [];
  const today = todayBRT();

  const byDay = new Map<string, Match[]>();
  for (const m of matches) {
    const key = toBRTDateKey(m.kickoff_at);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(m);
  }
  const days = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-black mb-1">All matches</h1>
        <p className="text-sm text-foreground/50">
          {matches.length} matches · Brasília time (BRT, UTC-3)
        </p>
      </div>

      {days.map(([dateKey, dayMatches]) => {
        const { day, month, weekday } = parseDateKey(dateKey);
        const isToday = dateKey === today;
        const allDone = dayMatches.every((m) => m.status === "completed");
        const hasLive = dayMatches.some((m) => m.status === "live");

        return (
          <div
            key={dateKey}
            className={`rounded-2xl border overflow-hidden transition-opacity ${
              allDone ? "opacity-60" : ""
            } ${
              isToday
                ? "border-[#129D49]/40"
                : hasLive
                  ? "border-[#129D49]/25"
                  : "border-white/10"
            }`}
          >
            <div
              className={`flex items-center justify-between px-4 py-3 border-b ${
                isToday
                  ? "bg-[#129D49]/8 border-[#129D49]/20"
                  : hasLive
                    ? "bg-[#129D49]/5 border-[#129D49]/12"
                    : "bg-white/4 border-white/8"
              }`}
            >
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black leading-none">{day}</span>
                <span className="text-base font-semibold text-foreground/60">{month}</span>
                {isToday ? (
                  <span className="text-[10px] font-bold text-[#129D49] bg-[#129D49]/15 border border-[#129D49]/30 px-1.5 py-0.5 rounded uppercase tracking-wide">
                    Today
                  </span>
                ) : null}
                {hasLive ? (
                  <span className="text-[10px] font-bold text-[#129D49] uppercase tracking-wide">
                    ● Live
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-foreground/30">{weekday}</span>
                <span className="text-xs text-foreground/20 font-mono">
                  {dayMatches.length} {dayMatches.length === 1 ? "match" : "matches"}
                </span>
              </div>
            </div>

            {dayMatches.map((m, i) => (
              <MatchRow
                key={m.id}
                match={m}
                last={i === dayMatches.length - 1}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}


function MatchRow({ match, last }: { match: Match; last: boolean }) {
  const isDone = match.status === "completed";
  const isLive = match.status === "live";

  return (
    <div
      className={`flex items-center gap-3 px-4 py-2.5 ${
        last ? "" : "border-b border-white/5"
      } ${!isDone ? "hover:bg-white/3 transition-colors" : ""}`}
    >
      <span
        className={`text-xs font-mono tabular-nums w-10 shrink-0 ${
          isDone ? "text-foreground/25" : isLive ? "text-[#129D49] font-bold" : "text-foreground/45"
        }`}
      >
        {isLive ? "LIVE" : formatTime(match.kickoff_at)}
      </span>

      <div className="flex-1 flex items-center gap-1.5 min-w-0 text-sm">
        <span className="leading-none">{flagFor(match.home_team ?? "")}</span>
        <span className={`font-medium truncate ${isDone ? "text-foreground/45" : "text-foreground/85"}`}>
          {match.home_team ?? "TBD"}
        </span>

        {isDone ? (
          <span className="mx-1.5 font-black text-white tabular-nums shrink-0">
            {match.home_score} – {match.away_score}
          </span>
        ) : (
          <span className="mx-1.5 text-foreground/20 text-xs shrink-0">vs</span>
        )}

        <span className="leading-none">{flagFor(match.away_team ?? "")}</span>
        <span className={`font-medium truncate ${isDone ? "text-foreground/45" : "text-foreground/85"}`}>
          {match.away_team ?? "TBD"}
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {match.venue ? (
          <span className="hidden lg:block text-xs text-foreground/20 truncate max-w-36">
            {match.venue}
          </span>
        ) : null}
        {match.group_name ? (
          <span className="text-[10px] w-5 h-5 rounded-md bg-white/6 border border-white/10 flex items-center justify-center font-bold text-foreground/40">
            {match.group_name}
          </span>
        ) : match.stage !== "group" ? (
          <span className="text-[10px] font-semibold text-foreground/30 uppercase tracking-wide">
            {STAGE_SHORT[match.stage]}
          </span>
        ) : null}
      </div>
    </div>
  );
}
