import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { timingSafeEqual } from "@/lib/security";

export async function GET(request: NextRequest) {
  const authz = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || !timingSafeEqual(authz, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = await createServiceRoleClient();
  const { data, error } = await supabase.rpc("lock_overdue_matches");

  if (error) {
    console.error("[cron/lock-matches] rpc failed", error);
    return NextResponse.json(
      { error: "lock_failed", details: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ locked: data ?? 0 });
}
