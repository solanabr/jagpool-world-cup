import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import { isValidUuid } from "@/lib/security";

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: 403 });
  }

  let body: {
    id?: string;
    name?: string;
    startsAt?: string;
    endsAt?: string;
    minJagsolAmount?: number;
    groupLockAt?: string | null;
    isActive?: boolean;
  } | null;
  try {
    body = (await request.json()) as typeof body;
  } catch (err) {
    console.error("[admin/tournament PATCH] invalid JSON", err);
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  if (!body?.id || !isValidUuid(body.id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (body.name != null) update.name = body.name;
  if (body.startsAt != null) update.starts_at = body.startsAt;
  if (body.endsAt != null) update.ends_at = body.endsAt;
  if (body.minJagsolAmount != null) update.min_jagsol_amount = body.minJagsolAmount;
  if ("groupLockAt" in body) update.group_lock_at = body.groupLockAt;
  if (body.isActive != null) update.is_active = body.isActive;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "no_fields" }, { status: 400 });
  }

  const supabase = await createServiceRoleClient();
  const { data, error } = await supabase
    .from("tournaments")
    .update(update)
    .eq("id", body.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: "update_failed", details: error.message },
      { status: 500 },
    );
  }

  const { error: auditError } = await supabase.from("admin_audit_log").insert({
    admin_user_id: auth.state.userId,
    action: "update_tournament",
    target_table: "tournaments",
    target_id: body.id,
    changes: update,
  });
  if (auditError) {
    console.error("[admin/tournament PATCH] audit log insert failed", auditError);
  }

  return NextResponse.json({ tournament: data });
}
