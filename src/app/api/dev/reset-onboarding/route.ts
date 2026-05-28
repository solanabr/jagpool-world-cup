import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/user-state";

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const state = await requireUser();
  const supabase = await createServiceRoleClient();

  await supabase
    .from("users")
    .update({ validator_id: null, validator_locked_at: null })
    .eq("id", state.userId);

  redirect("/onboarding");
}
