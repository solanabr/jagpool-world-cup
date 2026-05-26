import { describe, expect, it } from "vitest";
import {
  clampInt,
  isValidBase58,
  isValidUuid,
  sanitizeUsername,
  timingSafeEqual,
} from "@/lib/security";

describe("sanitizeUsername", () => {
  it("accepts valid usernames", () => {
    expect(sanitizeUsername("thom")).toBe("thom");
    expect(sanitizeUsername("kuka_solana_99")).toBe("kuka_solana_99");
  });
  it("rejects too short/long", () => {
    expect(sanitizeUsername("ab")).toBeNull();
    expect(sanitizeUsername("a".repeat(21))).toBeNull();
  });
  it("rejects invalid characters", () => {
    expect(sanitizeUsername("hi-there")).toBeNull();
    expect(sanitizeUsername("hello world")).toBeNull();
  });
  it("trims whitespace", () => {
    expect(sanitizeUsername("  thom ")).toBe("thom");
  });
});

describe("isValidBase58", () => {
  it("accepts plausible base58 strings", () => {
    expect(isValidBase58("11111111111111111111111111111111")).toBe(true);
  });
  it("rejects non-base58 chars", () => {
    expect(isValidBase58("not-a-base58-0OIl")).toBe(false);
  });
  it("rejects wrong length", () => {
    expect(isValidBase58("short")).toBe(false);
  });
});

describe("isValidUuid", () => {
  it("accepts a v4 uuid", () => {
    expect(isValidUuid("0c0a6aa2-ff75-474b-a8ac-257eeb9d0d9c")).toBe(true);
  });
  it("rejects malformed", () => {
    expect(isValidUuid("not-a-uuid")).toBe(false);
  });
});

describe("clampInt", () => {
  it("returns value when in range", () => {
    expect(clampInt(2, 0, 10)).toBe(2);
  });
  it("rejects out of range", () => {
    expect(clampInt(-1, 0, 10)).toBeNull();
    expect(clampInt(11, 0, 10)).toBeNull();
  });
  it("rejects non-integer", () => {
    expect(clampInt(1.5, 0, 10)).toBeNull();
    expect(clampInt("3", 0, 10)).toBeNull();
  });
});

describe("timingSafeEqual", () => {
  it("returns true for equal strings", () => {
    expect(timingSafeEqual("abc", "abc")).toBe(true);
  });
  it("returns false for different strings", () => {
    expect(timingSafeEqual("abc", "abd")).toBe(false);
    expect(timingSafeEqual("abc", "ab")).toBe(false);
  });
});
