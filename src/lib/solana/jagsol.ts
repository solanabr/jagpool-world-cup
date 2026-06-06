import { PublicKey } from "@solana/web3.js";
import { getConnection } from "./connection";

const DEFAULT_JAGSOL_MINT = "jag58eRBC1c88LaAsRPspTMvoKJPbnzw9p9fREzHqyV";

export function getJagsolMint(): string {
  return process.env.NEXT_PUBLIC_JAGSOL_MINT || DEFAULT_JAGSOL_MINT;
}

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
  const mintAddress = getJagsolMint();
  if (!mintAddress) return null;

  try {
    const owner = new PublicKey(walletAddress);
    const mint = new PublicKey(mintAddress);
    const connection = getConnection();

    let totalRaw = 0n;
    let decimals = 9;

    // getTokenAccountsByOwner accepts EITHER a `mint` OR a `programId` filter,
    // never both — web3.js silently drops `programId` when `mint` is present.
    // Looping over token programs with both keys would re-query the same
    // mint-filtered set twice and double-count. A mint filter already returns
    // accounts under whichever token program owns the mint.
    const accounts = await connection.getParsedTokenAccountsByOwner(owner, {
      mint,
    });
    for (const acc of accounts.value) {
      const info = acc.account.data.parsed.info;
      totalRaw += BigInt(info.tokenAmount.amount as string);
      decimals = info.tokenAmount.decimals as number;
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
