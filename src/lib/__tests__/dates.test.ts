import { describe, expect, it } from "vitest";
import { formatKickoffBRT } from "@/lib/wc2026/dates";

describe("formatKickoffBRT", () => {
  it("converts UTC to Brasília time (UTC-3)", () => {
    // 19:00 UTC → 16:00 BRT (Brasília does not observe DST)
    expect(formatKickoffBRT("2026-06-11T19:00:00Z")).toBe(
      "Jun 11 · 16:00 BRT",
    );
  });

  it("handles times that cross to the previous day in BRT", () => {
    // 02:00 UTC on Jun 12 → 23:00 BRT on Jun 11
    expect(formatKickoffBRT("2026-06-12T02:00:00Z")).toBe(
      "Jun 11 · 23:00 BRT",
    );
  });

  it("formats month/day correctly for two-digit day", () => {
    expect(formatKickoffBRT("2026-07-19T22:00:00Z")).toBe(
      "Jul 19 · 19:00 BRT",
    );
  });

  it("formats single-digit hours with leading zero", () => {
    // 03:00 UTC → 00:00 BRT (midnight)
    expect(formatKickoffBRT("2026-06-20T03:00:00Z")).toBe(
      "Jun 20 · 00:00 BRT",
    );
  });

  it("produces deterministic output for the same input", () => {
    const a = formatKickoffBRT("2026-06-11T19:00:00Z");
    const b = formatKickoffBRT("2026-06-11T19:00:00Z");
    expect(a).toBe(b);
  });
});
