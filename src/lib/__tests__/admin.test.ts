import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isAdminWallet } from "@/lib/admin";

describe("isAdminWallet", () => {
  const originalEnv = process.env.ADMIN_WALLET_ALLOWLIST;

  beforeEach(() => {
    delete process.env.ADMIN_WALLET_ALLOWLIST;
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.ADMIN_WALLET_ALLOWLIST;
    } else {
      process.env.ADMIN_WALLET_ALLOWLIST = originalEnv;
    }
  });

  it("returns false when wallet is null", () => {
    process.env.ADMIN_WALLET_ALLOWLIST = "F5gwjNcRRRsTFuQ6UygvqvoMJBbPeWMvvUA2rALniLwq";
    expect(isAdminWallet(null)).toBe(false);
  });

  it("returns false when env var is unset", () => {
    expect(isAdminWallet("F5gwjNcRRRsTFuQ6UygvqvoMJBbPeWMvvUA2rALniLwq")).toBe(
      false,
    );
  });

  it("returns true for exact match in single-entry allowlist", () => {
    process.env.ADMIN_WALLET_ALLOWLIST = "F5gwjNcRRRsTFuQ6UygvqvoMJBbPeWMvvUA2rALniLwq";
    expect(isAdminWallet("F5gwjNcRRRsTFuQ6UygvqvoMJBbPeWMvvUA2rALniLwq")).toBe(
      true,
    );
  });

  it("returns true for exact match in comma-separated allowlist", () => {
    process.env.ADMIN_WALLET_ALLOWLIST = "AAA111,F5gwjNcRRRsTFuQ6UygvqvoMJBbPeWMvvUA2rALniLwq,BBB222";
    expect(isAdminWallet("F5gwjNcRRRsTFuQ6UygvqvoMJBbPeWMvvUA2rALniLwq")).toBe(
      true,
    );
  });

  it("handles surrounding whitespace in env entries", () => {
    process.env.ADMIN_WALLET_ALLOWLIST = " AAA111 , F5gwjNcRRRsTFuQ6UygvqvoMJBbPeWMvvUA2rALniLwq , BBB222 ";
    expect(isAdminWallet("F5gwjNcRRRsTFuQ6UygvqvoMJBbPeWMvvUA2rALniLwq")).toBe(
      true,
    );
  });

  it("is case-sensitive on wallet pubkeys", () => {
    process.env.ADMIN_WALLET_ALLOWLIST = "F5gwjNcRRRsTFuQ6UygvqvoMJBbPeWMvvUA2rALniLwq";
    // base58 is case-sensitive; lowercase variant must NOT match
    expect(isAdminWallet("f5gwjncrrrstfuq6uygvqvomjbbpewmvvua2ralniLwq")).toBe(
      false,
    );
  });

  it("returns false for wallet not in allowlist", () => {
    process.env.ADMIN_WALLET_ALLOWLIST = "AAA,BBB";
    expect(isAdminWallet("CCC")).toBe(false);
  });

  it("returns false for empty string wallet", () => {
    process.env.ADMIN_WALLET_ALLOWLIST = "AAA";
    expect(isAdminWallet("")).toBe(false);
  });
});
