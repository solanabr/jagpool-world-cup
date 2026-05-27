import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import { isValidUuid } from "@/lib/security";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: 403 });
  }

  const { id } = await context.params;
  if (!isValidUuid(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  let body: { isActive?: boolean } | null;
  try {
    body = (await request.json()) as typeof body;
  } catch (err) {
    console.error("[admin/validators PATCH] invalid JSON", err);
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  if (typeof body?.isActive !== "boolean") {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("set_validator_active", {
    p_validator_id: id,
    p_is_active: body.isActive,
  });

  if (error) {
    return NextResponse.json(
      { error: "update_failed", details: error.message },
      { status: 400 },
    );
  }
  return NextResponse.json({ validator: data });
}
