import { Connection, type Commitment } from "@solana/web3.js";

let cached: Connection | null = null;

export function getConnection(commitment: Commitment = "confirmed"): Connection {
  if (cached) return cached;
  const endpoint =
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";
  cached = new Connection(endpoint, commitment);
  return cached;
}
