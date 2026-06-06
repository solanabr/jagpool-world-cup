import { Connection, PublicKey, VersionedTransaction } from "@solana/web3.js";

type QuoteResponse = {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: "ExactIn" | "ExactOut";
  slippageBps: number;
  priceImpactPct: string;
  routePlan: {
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      feeAmount?: string;
    };
  }[];
  contextSlot: number;
  timeTaken: number;
};

export async function swapJagsolFromJupiter(
  connection: Connection,
  quoteResponse: QuoteResponse,
  publicKey: PublicKey,
  signAndSendTransaction: (tx: VersionedTransaction) => Promise<string>
): Promise<string> {
  const response = await fetch("/api/jagsol/swap", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quoteResponse,
      userPublicKey: publicKey.toBase58(),
    }),
  });

  if (!response.ok) {
    const err = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(err?.error ?? `Swap request failed (${response.status})`);
  }

  const data = await response.json();

  if (!data?.swapTransaction) {
    throw new Error("No transaction returned from Jupiter");
  }

  const transaction = VersionedTransaction.deserialize(
    Buffer.from(data.swapTransaction, "base64")
  );

  const signature = await signAndSendTransaction(transaction);
  await connection.confirmTransaction(signature, "confirmed");

  return signature;
}
