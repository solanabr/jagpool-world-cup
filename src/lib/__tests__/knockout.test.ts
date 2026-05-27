import { describe, expect, it } from "vitest";
import {
  isMatchReadyForPrediction,
  isPlaceholderTeam,
} from "@/lib/wc2026/knockout";

describe("isPlaceholderTeam", () => {
  it("treats null/undefined/empty as placeholders", () => {
    expect(isPlaceholderTeam(null)).toBe(true);
    expect(isPlaceholderTeam(undefined)).toBe(true);
    expect(isPlaceholderTeam("")).toBe(true);
  });

  it("flags 'Winner of Match X' style", () => {
    expect(isPlaceholderTeam("Winner of Match 73")).toBe(true);
    expect(isPlaceholderTeam("winner of match 89")).toBe(true);
  });

  it("flags 'Loser of Match X' style", () => {
    expect(isPlaceholderTeam("Loser of Match 101")).toBe(true);
  });

  it("flags 'Group X — Nth' style", () => {
    expect(isPlaceholderTeam("Group A — 2nd")).toBe(true);
    expect(isPlaceholderTeam("group b — 1st")).toBe(true);
  });

  it("flags '3rd from X/Y/Z' style", () => {
    expect(isPlaceholderTeam("3rd from A/B/C/D/F")).toBe(true);
  });

  it("does NOT flag real team names", () => {
    expect(isPlaceholderTeam("Brazil")).toBe(false);
    expect(isPlaceholderTeam("South Korea")).toBe(false);
    expect(isPlaceholderTeam("Bosnia and Herzegovina")).toBe(false);
    expect(isPlaceholderTeam("Czech Republic")).toBe(false);
    expect(isPlaceholderTeam("DR Congo")).toBe(false);
  });
});

describe("isMatchReadyForPrediction", () => {
  it("returns true only when both teams are real", () => {
    expect(isMatchReadyForPrediction("Brazil", "Argentina")).toBe(true);
  });

  it("returns false if either side is a placeholder", () => {
    expect(isMatchReadyForPrediction("Brazil", "Winner of Match 73")).toBe(false);
    expect(isMatchReadyForPrediction("Group A — 2nd", "Argentina")).toBe(false);
    expect(isMatchReadyForPrediction("Winner of Match 73", "Winner of Match 75")).toBe(false);
  });

  it("returns false if either side is null", () => {
    expect(isMatchReadyForPrediction(null, "Brazil")).toBe(false);
    expect(isMatchReadyForPrediction("Brazil", null)).toBe(false);
  });
});
