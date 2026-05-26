import { PublicKey } from "@solana/web3.js";
import { getConnection } from "./connection";

const TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
);
const TOKEN_2022_PROGRAM_ID = new PublicKey(
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
);

export type JagsolBalance = {
  raw: bigint;
  uiAmount: number;
  decimals: number;
};

/**
 * Sum balances across all token accounts owned by `walletAddress` for the JagSOL mint.
 * Returns null if mint env var is not configured OR if the RPC call fails (caller
 * should treat null as "could not verify" — fail closed on any minimum > 0).
 */
export async function getJagsolBalance(
  walletAddress: string,
): Promise<JagsolBalance | null> {
  const mintAddress = process.env.NEXT_PUBLIC_JAGSOL_MINT;
  if (!mintAddress) return null;

  try {
    const owner = new PublicKey(walletAddress);
    const mint = new PublicKey(mintAddress);
    const connection = getConnection();

    let totalRaw = 0n;
    let decimals = 9;

    for (const programId of [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID]) {
      const accounts = await connection.getParsedTokenAccountsByOwner(owner, {
        mint,
        programId,
      });
      for (const acc of accounts.value) {
        const info = acc.account.data.parsed.info;
        const amount = BigInt(info.tokenAmount.amount as string);
        totalRaw += amount;
        decimals = info.tokenAmount.decimals as number;
      }
    }

    const uiAmount = Number(totalRaw) / 10 ** decimals;
    return { raw: totalRaw, uiAmount, decimals };
  } catch (err) {
    console.error("[jagsol] balance fetch failed", err);
    return null;
  }
}

export function meetsMinimum(
  balance: JagsolBalance | null,
  minimumUi: number,
): boolean {
  if (!balance) return false;
  return balance.uiAmount >= minimumUi;
}
