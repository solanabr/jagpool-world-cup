import { afterEach, describe, expect, it } from "vitest";
import { getJagsolMint, meetsMinimum } from "@/lib/solana/jagsol";
import { isValidBase58 } from "@/lib/security";

const DEFAULT_MINT = "jag58eRBC1c88LaAsRPspTMvoKJPbnzw9p9fREzHqyV";

describe("getJagsolMint", () => {
  const original = process.env.NEXT_PUBLIC_JAGSOL_MINT;
  afterEach(() => {
    process.env.NEXT_PUBLIC_JAGSOL_MINT = original;
  });

  it("falls back to the mainnet mint when env is unset", () => {
    delete process.env.NEXT_PUBLIC_JAGSOL_MINT;
    expect(getJagsolMint()).toBe(DEFAULT_MINT);
  });

  it("prefers the env override when set", () => {
    process.env.NEXT_PUBLIC_JAGSOL_MINT = "So11111111111111111111111111111111111111112";
    expect(getJagsolMint()).toBe("So11111111111111111111111111111111111111112");
  });

  it("default mint is a valid base58 pubkey", () => {
    expect(isValidBase58(DEFAULT_MINT)).toBe(true);
  });
});

describe("meetsMinimum", () => {
  it("fails closed on a null (unverifiable) balance", () => {
    expect(meetsMinimum(null, 2)).toBe(false);
  });

  it("accepts a balance at or above the minimum", () => {
    expect(meetsMinimum({ raw: 2n, uiAmount: 2, decimals: 0 }, 2)).toBe(true);
    expect(meetsMinimum({ raw: 5n, uiAmount: 5, decimals: 0 }, 2)).toBe(true);
  });

  it("rejects a balance below the minimum", () => {
    expect(meetsMinimum({ raw: 1n, uiAmount: 1, decimals: 0 }, 2)).toBe(false);
  });
});
