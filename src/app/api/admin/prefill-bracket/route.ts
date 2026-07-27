import { NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  createServiceRoleClient,
} from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import { scoreAdvancersAndPersist } from "@/lib/scoring/persist";
import {
  KNOWN_ADVANCERS,
  KNOWN_R32_MATCHUPS,
} from "@/lib/wc2026/known-results";

/**
 * One-click shortcut: record the 32 known group advancers (scoring them, same
 * as a manual save) AND fill the Round-of-32 team slots. R32 has no parent
 * matches, so nothing propagates into it — without this the slots keep their
 * "Group A — 2nd" placeholders even after advancers are set.
 */
export async function POST() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: 403 });
  }

  const supabase = await createServerSupabaseClient();
  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();
  if (!tournament) {
    return NextResponse.json({ error: "no_active_tournament" }, { status: 400 });
  }

  const { data: advancersSet, error: advError } = await supabase.rpc(
    "set_tournament_advancers",
    { p_tournament_id: tournament.id, p_advancers: KNOWN_ADVANCERS },
  );
  if (advError) {
    console.error("[admin/prefill-bracket] set advancers failed", advError);
    return NextResponse.json(
      { error: "set_advancers_failed", details: advError.message },
      { status: 400 },
    );
  }

  const service = await createServiceRoleClient();
  const warnings: string[] = [];

  // Fill the R32 slots. Only touch matches that haven't been finalized, so this
  // can't overwrite a round the admin already played out.
  let matchesFilled = 0;
  for (const [num, [home, away]] of Object.entries(KNOWN_R32_MATCHUPS)) {
    const { error, count } = await service
      .from("matches")
      .update({ home_team: home, away_team: away }, { count: "exact" })
      .eq("tournament_id", tournament.id)
      .eq("match_number", Number(num))
      .is("winner", null);
    if (error) {
      console.error("[admin/prefill-bracket] match fill failed", num, error);
      warnings.push(`match ${num} not filled`);
    } else {
      matchesFilled += count ?? 0;
    }
  }

  const scoring = await scoreAdvancersAndPersist(service, tournament.id);
  if (scoring.error) {
    console.error("[admin/prefill-bracket] scoring failed", scoring.error);
    warnings.push("advancers saved but scoring failed — re-save to retry");
  }

  const result = {
    advancersSet,
    matchesFilled,
    scoring: { eventsWritten: scoring.eventsWritten, error: scoring.error ?? null },
    ...(warnings.length > 0 ? { warning: warnings.join("; ") } : {}),
  };
  return NextResponse.json(result, { status: warnings.length > 0 ? 207 : 200 });
}
