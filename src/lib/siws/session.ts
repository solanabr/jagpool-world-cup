import { createHash } from "node:crypto";
import { createServiceRoleClient } from "@/lib/supabase/server";

const WALLET_EMAIL_DOMAIN = "wallet.jagpool.local";
const WALLET_PASSWORD_PEPPER_ENV = "WALLET_PASSWORD_PEPPER";

function walletEmail(publicKey: string): string {
  return `${publicKey.toLowerCase()}@${WALLET_EMAIL_DOMAIN}`;
}

/**
 * Derive a deterministic password from pepper + publicKey, then hash to
 * fixed-length hex (64 chars = 64 bytes). The hash step is required because
 * Supabase's auth uses bcrypt which rejects inputs over 72 bytes.
 */
function deterministicPassword(publicKey: string): string {
  const pepper = process.env[WALLET_PASSWORD_PEPPER_ENV];
  if (!pepper) throw new Error("missing WALLET_PASSWORD_PEPPER");
  return createHash("sha256").update(`${pepper}::${publicKey}`).digest("hex");
}

export type WalletSession = {
  userId: string;
  email: string;
  accessToken: string;
  refreshToken: string;
  wasCreated: boolean;
};

export async function getOrCreateWalletSession(
  publicKey: string,
): Promise<WalletSession> {
  const supabase = await createServiceRoleClient();
  const email = walletEmail(publicKey);
  const password = deterministicPassword(publicKey);

  const { error: createErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { wallet_address: publicKey },
  });

  // Detect "user already exists" via Supabase's documented error codes first;
  // fall back to status/message heuristics if the code field is missing on older SDKs.
  const errCode = (createErr as { code?: string } | null)?.code;
  const alreadyExists =
    !!createErr &&
    (errCode === "email_exists" ||
      errCode === "user_already_exists" ||
      createErr.status === 422 ||
      /already.*registered|user.*exists/i.test(createErr.message));

  if (createErr && !alreadyExists) {
    throw new Error(`auth.createUser failed: ${createErr.message}`);
  }

  const { data: sess, error: signErr } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (signErr || !sess?.session || !sess?.user) {
    throw new Error(
      `signInWithPassword failed: ${signErr?.message ?? "no session"}`,
    );
  }

  return {
    userId: sess.user.id,
    email,
    accessToken: sess.session.access_token,
    refreshToken: sess.session.refresh_token,
    wasCreated: !alreadyExists,
  };
}

export async function deleteWalletUser(userId: string): Promise<void> {
  const supabase = await createServiceRoleClient();
  await supabase.auth.admin.deleteUser(userId);
}
