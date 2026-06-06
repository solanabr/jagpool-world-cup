import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { verifySignature } from "@/lib/siws/verify";
import { deleteWalletUser, getOrCreateWalletSession } from "@/lib/siws/session";
import { isValidBase58 } from "@/lib/security";
import {
  getJagsolBalance,
  getJagsolMint,
  meetsMinimum,
} from "@/lib/solana/jagsol";

export async function POST(request: NextRequest) {
  if (!process.env.WALLET_PASSWORD_PEPPER) {
    return NextResponse.json(
      {
        error: "session_failed",
        details:
          "missing WALLET_PASSWORD_PEPPER env var — generate one with `openssl rand -base64 48` and set it in .env.local (treat as permanent — rotating it locks out all wallet users)",
      },
      { status: 500 },
    );
  }

  const body = (await request.json().catch(() => null)) as
    | { publicKey?: string; signature?: string; nonce?: string }
    | null;

  if (
    !body?.publicKey ||
    !body?.signature ||
    !body?.nonce ||
    !isValidBase58(body.publicKey) ||
    !isValidBase58(body.signature, 64, 128) ||
    !isValidBase58(body.nonce, 16, 32)
  ) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const supabase = await createServiceRoleClient();

  // Atomic claim: delete-and-return the challenge in one statement so concurrent
  // verify requests with the same (nonce, publicKey) can't both succeed.
  const { data: challenge, error: claimError } = await supabase
    .from("siws_challenges")
    .delete()
    .eq("nonce", body.nonce)
    .eq("public_key", body.publicKey)
    .select()
    .maybeSingle();

  if (claimError) {
    console.error("[siws/verify] challenge claim failed", claimError);
    return NextResponse.json(
      { error: "challenge_claim_failed", details: claimError.message },
      { status: 500 },
    );
  }

  if (!challenge) {
    return NextResponse.json({ error: "unknown_challenge" }, { status: 401 });
  }

  if (new Date(challenge.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "challenge_expired" }, { status: 401 });
  }

  // Use the exact message we sent to the client at challenge time.
  // Reconstructing from issued_at/expires_at would drift because Postgres
  // serializes timestamps differently from JS `.toISOString()`.
  const message = challenge.message;
  if (!message) {
    return NextResponse.json(
      { error: "challenge_missing_message" },
      { status: 500 },
    );
  }

  const ok = verifySignature({
    message,
    signature: body.signature,
    publicKey: body.publicKey,
  });
  if (!ok) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  let session;
  try {
    session = await getOrCreateWalletSession(body.publicKey);
  } catch (err) {
    return NextResponse.json(
      { error: "session_failed", details: (err as Error).message },
      { status: 500 },
    );
  }

  if (session.wasCreated) {
    const mintConfigured = !!getJagsolMint();
    const { data: tournament, error: tournamentError } = await supabase
      .from("tournaments")
      .select("min_jagsol_amount")
      .eq("is_active", true)
      .maybeSingle();

    // Fail closed if we can't read the tournament — better to reject signup
    // than silently bypass JagSOL gating during a DB outage.
    if (tournamentError) {
      console.error("[siws/verify] tournament fetch failed", tournamentError);
      await deleteWalletUser(session.userId);
      return NextResponse.json(
        { error: "tournament_unavailable", details: tournamentError.message },
        { status: 500 },
      );
    }

    const minimum = Number(tournament?.min_jagsol_amount ?? 0);

    let balance = null;
    if (mintConfigured) {
      balance = await getJagsolBalance(body.publicKey);
      if (minimum > 0 && !meetsMinimum(balance, minimum)) {
        await deleteWalletUser(session.userId);
        return NextResponse.json(
          {
            error: "insufficient_jagsol",
            currentBalance: balance?.uiAmount.toString() ?? "0",
            minimumRequired: minimum.toString(),
          },
          { status: 403 },
        );
      }
    }

    const stubUsername = `user_${body.publicKey.slice(0, 8)}`;
    const { error: insertErr } = await supabase.from("users").insert({
      id: session.userId,
      wallet_address: body.publicKey,
      username: stubUsername,
      jagsol_verified_at: balance ? new Date().toISOString() : null,
      jagsol_balance: balance?.uiAmount.toString() ?? null,
    });
    if (insertErr) {
      await deleteWalletUser(session.userId);
      return NextResponse.json(
        { error: "profile_creation_failed", details: insertErr.message },
        { status: 500 },
      );
    }
  }

  const { data: profile } = await supabase
    .from("users")
    .select("username")
    .eq("id", session.userId)
    .maybeSingle();

  return NextResponse.json({
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    user: {
      id: session.userId,
      walletAddress: body.publicKey,
      username: profile?.username ?? null,
    },
  });
}
