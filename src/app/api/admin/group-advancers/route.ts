import { NextResponse, type NextRequest } from "next/server";
import {
  createServerSupabaseClient,
  createServiceRoleClient,
} from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import { isValidUuid } from "@/lib/security";
import { scoreGroupAndPersist } from "@/lib/scoring/persist";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: 403 });
  }

  let body: {
    tournamentId?: string;
    groupName?: string;
    firstPlace?: string;
    secondPlace?: string;
  } | null;
  try {
    body = (await request.json()) as typeof body;
  } catch (err) {
    console.error("[admin/group-advancers] invalid JSON", err);
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  if (
    !body?.tournamentId ||
    !isValidUuid(body.tournamentId) ||
    !body.groupName ||
    !/^[A-L]$/.test(body.groupName) ||
    !body.firstPlace ||
    !body.secondPlace ||
    body.firstPlace === body.secondPlace
  ) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("set_group_advancers", {
    p_tournament_id: body.tournamentId,
    p_group_name: body.groupName,
    p_first_place: body.firstPlace,
    p_second_place: body.secondPlace,
  });

  if (error) {
    return NextResponse.json(
      { error: "set_advancers_failed", details: error.message },
      { status: 400 },
    );
  }

  // Auto-score group predictions now that the truth is recorded.
  // Service-role client because `scores` writes must bypass user RLS.
  const service = await createServiceRoleClient();
  const scoring = await scoreGroupAndPersist(
    service,
    body.tournamentId,
    body.groupName,
    { team1: body.firstPlace, team2: body.secondPlace },
  );

  if (scoring.error) {
    console.error(
      "[admin/group-advancers] group_result saved but scoring failed",
      scoring.error,
    );
    return NextResponse.json(
      {
        groupResult: data,
        scoring: { eventsWritten: 0, error: scoring.error },
        warning:
          "group result saved, but scoring failed — run rescore from admin UI",
      },
      { status: 207 },
    );
  }

  return NextResponse.json({
    groupResult: data,
    scoring: { eventsWritten: scoring.eventsWritten, error: null },
  });
}
