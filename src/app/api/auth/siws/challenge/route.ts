import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { buildSiwsMessage } from "@/lib/siws/message";
import { generateNonce } from "@/lib/siws/verify";
import { isValidBase58 } from "@/lib/security";

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as
    | { publicKey?: string }
    | null;

  if (!body?.publicKey || !isValidBase58(body.publicKey)) {
    return NextResponse.json({ error: "invalid_public_key" }, { status: 400 });
  }

  const publicKey = body.publicKey;
  const nonce = generateNonce();
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + CHALLENGE_TTL_MS);

  const domain = process.env.SIWS_DOMAIN ?? "localhost:3000";
  const message = buildSiwsMessage({
    domain,
    publicKey,
    nonce,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  });

  const supabase = await createServiceRoleClient();
  const { error } = await supabase.from("siws_challenges").insert({
    nonce,
    public_key: publicKey,
    issued_at: issuedAt.toISOString(),
    expires_at: expiresAt.toISOString(),
    message,
  });

  if (error) {
    return NextResponse.json({ error: "could_not_issue_challenge" }, { status: 500 });
  }

  return NextResponse.json({
    nonce,
    message,
    expiresAt: expiresAt.toISOString(),
  });
}
