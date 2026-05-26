import { describe, expect, it } from "vitest";
import { buildSiwsMessage } from "@/lib/siws/message";

describe("buildSiwsMessage", () => {
  const params = {
    domain: "jagpool.app",
    publicKey: "FakePubKey1111111111111111111111",
    nonce: "abc123",
    issuedAt: "2026-05-26T00:00:00.000Z",
    expiresAt: "2026-05-26T00:05:00.000Z",
  };

  it("includes the CAIP-122 framing fields", () => {
    const msg = buildSiwsMessage(params);
    expect(msg).toContain("jagpool.app wants you to sign in");
    expect(msg).toContain("FakePubKey1111111111111111111111");
    expect(msg).toContain("Nonce: abc123");
    expect(msg).toContain("Issued At: 2026-05-26T00:00:00.000Z");
    expect(msg).toContain("Expiration Time: 2026-05-26T00:05:00.000Z");
    expect(msg).toContain("Version: 1");
    expect(msg).toContain("Chain ID: mainnet");
  });

  it("includes consent for ToS, Privacy, and non-transaction disclaimer", () => {
    const msg = buildSiwsMessage(params);
    expect(msg).toContain("JagPool World Cup 2026");
    expect(msg).toContain("Terms of Service");
    expect(msg).toContain("Privacy Policy");
    expect(msg).toContain("does not authorize any transaction");
  });

  it("produces deterministic output for the same params", () => {
    const a = buildSiwsMessage(params);
    const b = buildSiwsMessage(params);
    expect(a).toBe(b);
  });
});
