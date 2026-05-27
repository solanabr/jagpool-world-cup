import { describe, expect, it } from "vitest";
import { shortAddress } from "@/lib/format";

describe("shortAddress", () => {
  it("returns empty string for null/undefined", () => {
    expect(shortAddress(null)).toBe("");
    expect(shortAddress(undefined)).toBe("");
  });

  it("returns the input unchanged when shorter than head+tail+1", () => {
    expect(shortAddress("abc")).toBe("abc");
    expect(shortAddress("12345678")).toBe("12345678");
  });

  it("shortens a typical 44-char Solana pubkey", () => {
    const addr = "F5gwjNcRRRsTFuQ6UygvqvoMJBbPeWMvvUA2rALniLwq";
    expect(shortAddress(addr)).toBe("F5gw…iLwq");
  });

  it("respects custom head/tail lengths", () => {
    const addr = "F5gwjNcRRRsTFuQ6UygvqvoMJBbPeWMvvUA2rALniLwq";
    expect(shortAddress(addr, 6, 6)).toBe("F5gwjN…LniLwq");
  });

  it("does not throw on empty string", () => {
    expect(shortAddress("")).toBe("");
  });
});
