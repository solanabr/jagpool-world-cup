import { describe, expect, it } from "vitest";
import {
  isMatchReadyForPrediction,
  isPlaceholderTeam,
  resolveBracketAdvancement,
} from "@/lib/wc2026/knockout";
import type { MatchStage } from "@/types/db";

function child(
  id: string,
  stage: MatchStage,
  parents: { a?: string; b?: string; status?: string } = {},
) {
  return {
    id,
    stage,
    status: parents.status ?? "upcoming",
    parent_match_a: parents.a ?? null,
    parent_match_b: parents.b ?? null,
  };
}

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

describe("resolveBracketAdvancement", () => {
  const semi = {
    id: "s1",
    winner: "home" as const,
    home_team: "Brazil",
    away_team: "France",
  };

  it("advances the winner into a child's home slot (parent_match_a)", () => {
    const out = resolveBracketAdvancement(semi, [
      child("final", "final", { a: "s1" }),
    ]);
    expect(out).toEqual([
      { childId: "final", patch: { home_team: "Brazil" }, childWasCompleted: false },
    ]);
  });

  it("advances the winner into a child's away slot (parent_match_b)", () => {
    const out = resolveBracketAdvancement(semi, [
      child("final", "final", { b: "s1" }),
    ]);
    expect(out[0].patch).toEqual({ away_team: "Brazil" });
  });

  it("routes the LOSER to the third-place match and the WINNER to the final from one finalize", () => {
    const out = resolveBracketAdvancement(semi, [
      child("final", "final", { a: "s1" }),
      child("third", "third_place", { a: "s1" }),
    ]);
    const byChild = Object.fromEntries(out.map((a) => [a.childId, a.patch]));
    expect(byChild.final).toEqual({ home_team: "Brazil" }); // winner
    expect(byChild.third).toEqual({ home_team: "France" }); // loser
  });

  it("flags a child that was already completed (correction desync signal)", () => {
    const out = resolveBracketAdvancement(semi, [
      child("final", "final", { a: "s1", status: "completed" }),
    ]);
    expect(out[0].childWasCompleted).toBe(true);
  });

  it("ignores children not fed by this match", () => {
    const out = resolveBracketAdvancement(semi, [
      child("other", "final", { a: "different-id", b: "another-id" }),
    ]);
    expect(out).toEqual([]);
  });

  it("returns [] when the match has no decisive winner or missing teams", () => {
    expect(
      resolveBracketAdvancement({ ...semi, winner: null }, [
        child("final", "final", { a: "s1" }),
      ]),
    ).toEqual([]);
    expect(
      resolveBracketAdvancement({ ...semi, winner: "draw" }, [
        child("final", "final", { a: "s1" }),
      ]),
    ).toEqual([]);
    expect(
      resolveBracketAdvancement({ ...semi, home_team: null }, [
        child("final", "final", { a: "s1" }),
      ]),
    ).toEqual([]);
  });
});
