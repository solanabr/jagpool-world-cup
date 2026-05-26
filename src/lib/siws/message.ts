export type SiwsMessageParams = {
  domain: string;
  publicKey: string;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
};

/**
 * Sign-In with Solana message (CAIP-122 format).
 * Keep the Statement short — wallets show this in a popup and users won't read long copy.
 */
export function buildSiwsMessage(params: SiwsMessageParams): string {
  const statement =
    "Sign in to JagPool World Cup 2026. " +
    "By signing, you confirm wallet ownership and accept the Terms of Service and Privacy Policy. " +
    "This signature does not authorize any transaction.";

  return [
    `${params.domain} wants you to sign in with your Solana account:`,
    params.publicKey,
    "",
    statement,
    "",
    `URI: https://${params.domain}`,
    `Version: 1`,
    `Chain ID: mainnet`,
    `Nonce: ${params.nonce}`,
    `Issued At: ${params.issuedAt}`,
    `Expiration Time: ${params.expiresAt}`,
  ].join("\n");
}
