import { NextResponse, type NextRequest } from "next/server";
import {
  createServerSupabaseClient,
  createServiceRoleClient,
} from "@/lib/supabase/server";
import { extractXIdentity } from "@/lib/x-identity";

export const dynamic = "force-dynamic";

// OAuth return point for X identity linking. The wallet session already exists;
// linkIdentity sends the user here. We exchange the PKCE code (when present),
// then copy the linked X handle/avatar onto public.users — linkIdentity only
// updates auth.users.identities, so our own table needs an explicit sync.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const next = sanitizeNext(searchParams.get("next"));
  const code = searchParams.get("code");
  const errorCode = searchParams.get("error_code");

  const supabase = await createServerSupabaseClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("[auth/callback] code exchange failed", error);
      return NextResponse.redirect(
        `${origin}/onboarding?x_error=exchange_failed`,
      );
    }
    return syncAndRedirect(supabase, origin, next, "sync_failed");
  }

  // "identity_already_exists" means the X identity is already linked. If it's
  // this user's (a re-click, or an earlier link whose sync didn't land), heal it
  // from the current session; syncAndRedirect reports already_linked only when
  // the identity isn't on this account (i.e. it's someone else's).
  if (errorCode === "identity_already_exists") {
    return syncAndRedirect(supabase, origin, next, "already_linked");
  }

  if (searchParams.get("error")) {
    return NextResponse.redirect(`${origin}/onboarding?x_error=denied`);
  }
  return NextResponse.redirect(`${origin}/onboarding?x_error=missing_code`);
}

// Mirrors the signed-in user's linked X identity onto public.users. Reads
// identities via getUser() (a fresh fetch) rather than the exchange response,
// which doesn't reliably include a just-linked identity.
async function syncAndRedirect(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  origin: string,
  next: string,
  notFoundError: string,
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    console.error("[auth/callback] no session after OAuth return");
    return NextResponse.redirect(`${origin}/`);
  }

  const xIdentity = (user.identities ?? []).find(
    (i) => i.provider === "x" || i.provider === "twitter",
  );
  const x = xIdentity ? extractXIdentity(xIdentity.identity_data) : null;
  if (!x) {
    // Code path: an unexpected post-link read miss (retry-able). Error path:
    // the X identity belongs to another account. Caller picks the message.
    console.error("[auth/callback] no X identity on user", user.id);
    return NextResponse.redirect(`${origin}/onboarding?x_error=${notFoundError}`);
  }

  const service = await createServiceRoleClient();
  const { error } = await service
    .from("users")
    .update({ x_user_id: x.id, x_avatar_url: x.avatarUrl, username: x.handle })
    .eq("id", user.id);
  if (error) {
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.redirect(
        `${origin}/onboarding?x_error=already_linked`,
      );
    }
    console.error("[auth/callback] x identity sync failed", error);
    return NextResponse.redirect(`${origin}/onboarding?x_error=sync_failed`);
  }
  return NextResponse.redirect(`${origin}${next}`);
}

// Same-origin relative paths only — block open-redirect via a crafted `next`.
function sanitizeNext(next: string | null): string {
  // Same-origin relative paths, safe charset only — blocks open-redirect
  // (`//evil`) and CRLF/control-char header injection via a crafted `next`.
  if (
    !next ||
    !next.startsWith("/") ||
    next.startsWith("//") ||
    /[^\w/?=&%.-]/.test(next)
  ) {
    return "/onboarding";
  }
  return next;
}
