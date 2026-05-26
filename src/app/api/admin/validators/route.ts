import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    voteAccount?: string;
    name?: string;
    description?: string | null;
    logoUrl?: string | null;
    websiteUrl?: string | null;
    isActive?: boolean;
    displayOrder?: number;
  } | null;

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

  return NextResponse.json({ validator: data });
}
