import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import { clampInt } from "@/lib/security";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: 403 });
  }

  const url = new URL(request.url);
  const limit = clampInt(Number(url.searchParams.get("limit") ?? "50"), 1, 200) ?? 50;
  const offset = clampInt(Number(url.searchParams.get("offset") ?? "0"), 0, 100000) ?? 0;
  const search = url.searchParams.get("search") ?? null;

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("list_users_admin", {
    p_limit: limit,
    p_offset: offset,
    p_search: search,
  });

  if (error) {
    return NextResponse.json(
      { error: "list_failed", details: error.message },
      { status: 500 },
    );
  }
  return NextResponse.json({ users: data ?? [] });
}
