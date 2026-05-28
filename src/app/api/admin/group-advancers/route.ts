import { NextResponse, type NextRequest } from "next/server";
import {
  createServerSupabaseClient,
  createServiceRoleClient,
} from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import { isValidUuid } from "@/lib/security";
import { scoreAdvancersAndPersist } from "@/lib/scoring/persist";

type Advancer = { groupName?: string; teamName?: string };

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: 403 });
  }

  let body: { tournamentId?: string; advancers?: Advancer[] } | null;
  try {
    body = (await request.json()) as typeof body;
  } catch (err) {
    console.error("[admin/group-advancers] invalid JSON", err);
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  if (
    !body?.tournamentId ||
    !isValidUuid(body.tournamentId) ||
    !Array.isArray(body.advancers)
  ) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const advancers = body.advancers
    .filter(
      (a): a is Required<Advancer> =>
        typeof a?.groupName === "string" && typeof a?.teamName === "string",
    )
    .map((a) => ({ groupName: a.groupName, teamName: a.teamName }));

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("set_tournament_advancers", {
    p_tournament_id: body.tournamentId,
    p_advancers: advancers,
  });

  if (error) {
    return NextResponse.json(
      { error: "set_advancers_failed", details: error.message },
      { status: 400 },
    );
  }

  const service = await createServiceRoleClient();
  const scoring = await scoreAdvancersAndPersist(service, body.tournamentId);

  if (scoring.error) {
    console.error(
      "[admin/group-advancers] advancers saved but scoring failed",
      scoring.error,
    );
    return NextResponse.json(
      {
        advancersSet: data,
        scoring: { eventsWritten: 0, error: scoring.error },
        warning:
          "advancers saved, but scoring failed — re-save to retry scoring",
      },
      { status: 207 },
    );
  }

  return NextResponse.json({
    advancersSet: data,
    scoring: { eventsWritten: scoring.eventsWritten, error: null },
  });
}
