import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: 403 });
  }

  let body: {
    voteAccount?: string;
    name?: string;
    description?: string | null;
    logoUrl?: string | null;
    websiteUrl?: string | null;
    isActive?: boolean;
    displayOrder?: number;
  } | null;
  try {
    body = (await request.json()) as typeof body;
  } catch (err) {
    console.error("[admin/validators POST] invalid JSON", err);
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  if (!body?.voteAccount || !body?.name) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const supabase = await createServiceRoleClient();
  const { data, error } = await supabase
    .from("validators")
    .insert({
      vote_account: body.voteAccount,
      name: body.name,
      description: body.description ?? null,
      logo_url: body.logoUrl ?? null,
      website_url: body.websiteUrl ?? null,
      is_active: body.isActive ?? true,
      display_order: body.displayOrder ?? 0,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: "insert_failed", details: error.message },
      { status: 500 },
    );
  }

  const { error: auditError } = await supabase.from("admin_audit_log").insert({
    admin_user_id: auth.state.userId,
    action: "create_validator",
    target_table: "validators",
    target_id: data.id,
    changes: body as Record<string, unknown>,
  });
  if (auditError) {
    console.error("[admin/validators POST] audit log insert failed", auditError);
  }

  return NextResponse.json({ validator: data });
}
