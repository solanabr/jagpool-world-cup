import { requireOnboardedUser } from "@/lib/user-state";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { GroupPredictionForm } from "@/components/predictions/group-prediction-form";
import { Countdown } from "@/components/predictions/countdown";
import { WC2026_GROUPS } from "@/lib/wc2026/groups";
import type { GroupPrediction, Match } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function GroupPredictionsPage() {
  const state = await requireOnboardedUser();
  const supabase = await createServerSupabaseClient();

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id, group_lock_at")
    .eq("is_active", true)
    .maybeSingle();

  if (!tournament) {
    return (
      <div className="text-center py-16">
        <p>No active tournament.</p>
      </div>
    );
  }

  const [predictionsRes, matchesRes] = await Promise.all([
    supabase
      .from("group_predictions")
      .select("*")
      .eq("user_id", state.userId)
      .eq("tournament_id", tournament.id),
    supabase
      .from("matches")
      .select("*")
      .eq("tournament_id", tournament.id)
      .eq("stage", "group")
      .order("kickoff_at", { ascending: true }),
  ]);

  const predictionMap: Record<string, GroupPrediction | undefined> = {};
  for (const p of (predictionsRes.data as GroupPrediction[]) ?? []) {
    predictionMap[p.group_name] = p;
  }

  const matchesByGroup: Record<string, Match[]> = {};
  for (const m of (matchesRes.data as Match[]) ?? []) {
    if (!m.group_name) continue;
    matchesByGroup[m.group_name] ??= [];
    matchesByGroup[m.group_name].push(m);
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-1">Group stage</h1>
          <p className="text-foreground/70 text-sm max-w-xl">
            Pick the 2 teams from each group you think will advance to the
            round of 32. You can edit until the first match kicks off.
          </p>
        </div>
        {tournament.group_lock_at ? (
          <div>
            <div className="text-xs text-foreground/50 uppercase mb-1">
              Predictions lock in
            </div>
            <Countdown target={tournament.group_lock_at} label="Locked" />
          </div>
        ) : null}
      </div>

      <GroupPredictionForm
        tournamentId={tournament.id}
        groups={WC2026_GROUPS}
        matchesByGroup={matchesByGroup}
        initialPredictions={predictionMap}
      />
    </div>
  );
}
