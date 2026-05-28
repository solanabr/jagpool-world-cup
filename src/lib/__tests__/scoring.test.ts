import { describe, expect, it } from "vitest";
import {
  scoreAdvancerPrediction,
  scoreChampionPrediction,
  scoreMatchPrediction,
} from "@/lib/scoring/compute";
import { POINTS, REASONS } from "@/lib/scoring/rules";
import type { Match, MatchPrediction } from "@/types/db";

function makeMatch(over: Partial<Match> = {}): Match {
  return {
    id: "m1",
    tournament_id: "t1",
    stage: "round_of_16",
    group_name: null,
    match_number: 89,
    home_team: "Brazil",
    away_team: "Argentina",
    kickoff_at: "2026-07-05T22:00:00Z",
    status: "completed",
    home_score: 2,
    away_score: 1,
    winner: "home",
    locked_at: "2026-07-05T21:59:00Z",
    parent_match_a: null,
    parent_match_b: null,
    venue: null,
    created_at: "",
    updated_at: "",
    ...over,
  };
}

function makeMatchPred(over: Partial<MatchPrediction> = {}): MatchPrediction {
  return {
    id: "p1",
    user_id: "u1",
    match_id: "m1",
    winner: "home",
    home_score: 2,
    away_score: 1,
    locked: true,
    submitted_at: "",
    updated_at: "",
    ...over,
  };
}

describe("POINTS — regression pin", () => {
  // This test exists so a silent change to a POINTS value (e.g. someone
  // swaps KNOCKOUT_WINNER_HIT from 10 to 7) breaks a test instead of
  // passing because every other assertion uses POINTS.X symbolically.
  it("matches the documented scoring rules", () => {
    expect(POINTS).toEqual({
      ADVANCER_HIT: 5,
      KNOCKOUT_WINNER_HIT: 10,
      LATE_STAGE_WINNER_SCORE_HIT: 5,
      LATE_STAGE_LOSER_SCORE_HIT: 5,
      CHAMPION_HIT: 30,
    });
  });
});

describe("scoreMatchPrediction — knockout rules", () => {
  it("returns empty when match not completed", () => {
    expect(
      scoreMatchPrediction(makeMatchPred(), makeMatch({ status: "upcoming" })),
    ).toEqual([]);
  });

  it("returns empty when match has no winner", () => {
    expect(
      scoreMatchPrediction(makeMatchPred(), makeMatch({ winner: null })),
    ).toEqual([]);
  });

  it("returns empty for group-stage matches (group stage scores via advancers)", () => {
    expect(
      scoreMatchPrediction(makeMatchPred(), makeMatch({ stage: "group" })),
    ).toEqual([]);
  });

  it("returns empty for wrong winner", () => {
    expect(
      scoreMatchPrediction(makeMatchPred({ winner: "away" }), makeMatch()),
    ).toEqual([]);
  });

  it("awards 10 pts for correct winner in round_of_32", () => {
    const events = scoreMatchPrediction(
      makeMatchPred(),
      makeMatch({ stage: "round_of_32" }),
    );
    expect(events).toHaveLength(1);
    expect(events[0].points).toBe(POINTS.KNOCKOUT_WINNER_HIT);
    expect(events[0].reason).toBe(REASONS.KNOCKOUT_WINNER);
  });

  it("awards 10 pts for correct winner in round_of_16", () => {
    const events = scoreMatchPrediction(makeMatchPred(), makeMatch());
    expect(events).toHaveLength(1);
    expect(events[0].points).toBe(POINTS.KNOCKOUT_WINNER_HIT);
  });

  it("awards 10 pts for correct winner in quarter (no score bonus)", () => {
    const events = scoreMatchPrediction(
      makeMatchPred(),
      makeMatch({ stage: "quarter" }),
    );
    expect(events).toHaveLength(1);
    expect(events[0].points).toBe(POINTS.KNOCKOUT_WINNER_HIT);
  });
});

describe("scoreMatchPrediction — late-stage score bonuses (semi, third, final)", () => {
  it("awards winner + winner_score + loser_score for exact semifinal pick", () => {
    const events = scoreMatchPrediction(
      makeMatchPred({ home_score: 2, away_score: 1 }),
      makeMatch({ stage: "semi", home_score: 2, away_score: 1 }),
    );
    const reasons = events.map((e) => e.reason).sort();
    expect(reasons).toEqual(
      [
        REASONS.KNOCKOUT_WINNER,
        REASONS.LATE_STAGE_LOSER_SCORE,
        REASONS.LATE_STAGE_WINNER_SCORE,
      ].sort(),
    );
    const total = events.reduce((s, e) => s + e.points, 0);
    expect(total).toBe(
      POINTS.KNOCKOUT_WINNER_HIT +
        POINTS.LATE_STAGE_WINNER_SCORE_HIT +
        POINTS.LATE_STAGE_LOSER_SCORE_HIT,
    );
  });

  it("awards winner + winner_score only (no loser_score) when only winner score matches", () => {
    // Match: home wins 3-0. Prediction: home wins 3-1.
    const events = scoreMatchPrediction(
      makeMatchPred({ home_score: 3, away_score: 1 }),
      makeMatch({ stage: "final", home_score: 3, away_score: 0 }),
    );
    const reasons = events.map((e) => e.reason);
    expect(reasons).toContain(REASONS.KNOCKOUT_WINNER);
    expect(reasons).toContain(REASONS.LATE_STAGE_WINNER_SCORE);
    expect(reasons).not.toContain(REASONS.LATE_STAGE_LOSER_SCORE);
  });

  it("awards winner + loser_score only (no winner_score) when only loser score matches", () => {
    // Match: home wins 4-2. Prediction: home wins 5-2.
    const events = scoreMatchPrediction(
      makeMatchPred({ home_score: 5, away_score: 2 }),
      makeMatch({ stage: "third_place", home_score: 4, away_score: 2 }),
    );
    const reasons = events.map((e) => e.reason);
    expect(reasons).toContain(REASONS.KNOCKOUT_WINNER);
    expect(reasons).toContain(REASONS.LATE_STAGE_LOSER_SCORE);
    expect(reasons).not.toContain(REASONS.LATE_STAGE_WINNER_SCORE);
  });

  it("awards only winner (no bonuses) when scores fully wrong", () => {
    // Match: home wins 1-0. Prediction: home wins 4-2. Both scores wrong.
    const events = scoreMatchPrediction(
      makeMatchPred({ home_score: 4, away_score: 2 }),
      makeMatch({ stage: "final", home_score: 1, away_score: 0 }),
    );
    const reasons = events.map((e) => e.reason);
    expect(reasons).toEqual([REASONS.KNOCKOUT_WINNER]);
  });

  it("does not award score bonuses when prediction has null scores", () => {
    const events = scoreMatchPrediction(
      makeMatchPred({ home_score: null, away_score: null }),
      makeMatch({ stage: "semi" }),
    );
    expect(events).toHaveLength(1);
    expect(events[0].reason).toBe(REASONS.KNOCKOUT_WINNER);
  });

  it("does not award score bonuses when match winner is 'draw' (defensive — knockout shouldn't draw)", () => {
    // Defensive check: if admin somehow set winner=draw on a knockout match,
    // we should still award winner-match points (prediction.winner === match.winner)
    // but skip the score-bonus branch since sidesForWinner returns [null, null].
    const events = scoreMatchPrediction(
      makeMatchPred({ winner: "draw", home_score: 1, away_score: 1 }),
      makeMatch({ stage: "final", winner: "draw", home_score: 1, away_score: 1 }),
    );
    expect(events).toHaveLength(1);
    expect(events[0].reason).toBe(REASONS.KNOCKOUT_WINNER);
  });

  it("skips score bonuses when match scores are null but winner is set", () => {
    // Realistic if an admin marks the winner before entering scores.
    const events = scoreMatchPrediction(
      makeMatchPred({ winner: "home", home_score: 2, away_score: 1 }),
      makeMatch({ stage: "final", home_score: null, away_score: null }),
    );
    expect(events).toHaveLength(1);
    expect(events[0].reason).toBe(REASONS.KNOCKOUT_WINNER);
  });

  it("away winner: late-stage bonuses use away score as winner_score", () => {
    const events = scoreMatchPrediction(
      makeMatchPred({ winner: "away", home_score: 1, away_score: 3 }),
      makeMatch({
        stage: "final",
        winner: "away",
        home_score: 1,
        away_score: 3,
      }),
    );
    const reasons = events.map((e) => e.reason).sort();
    expect(reasons).toEqual(
      [
        REASONS.KNOCKOUT_WINNER,
        REASONS.LATE_STAGE_LOSER_SCORE,
        REASONS.LATE_STAGE_WINNER_SCORE,
      ].sort(),
    );
  });
});

describe("scoreAdvancerPrediction (WC 2026 32-advancer model)", () => {
  const official = new Set(["Brazil", "Morocco", "Argentina", "France", "Spain"]);

  it("awards 5 pts per predicted team that's in the official set", () => {
    const events = scoreAdvancerPrediction(
      "u1",
      ["Brazil", "Argentina", "Mexico"], // 2 of 3 correct
      official,
    );
    expect(events).toHaveLength(1);
    expect(events[0].reason).toBe(REASONS.ADVANCER);
    expect(events[0].points).toBe(2 * POINTS.ADVANCER_HIT);
  });

  it("aggregates all hits into a single event", () => {
    const events = scoreAdvancerPrediction(
      "u1",
      ["Brazil", "Morocco", "Argentina", "France"], // all 4 correct
      official,
    );
    expect(events).toHaveLength(1);
    expect(events[0].points).toBe(4 * POINTS.ADVANCER_HIT);
  });

  it("returns empty when no predicted team advanced", () => {
    expect(
      scoreAdvancerPrediction("u1", ["Haiti", "Scotland"], official),
    ).toEqual([]);
  });

  it("returns empty for an empty prediction (partial save with 0 picks)", () => {
    expect(scoreAdvancerPrediction("u1", [], official)).toEqual([]);
  });

  it("dedupes repeated teams so a duplicate can't double-count", () => {
    const events = scoreAdvancerPrediction(
      "u1",
      ["Brazil", "Brazil", "France"],
      official,
    );
    expect(events[0].points).toBe(2 * POINTS.ADVANCER_HIT);
  });

  it("scales to a realistic partial pick (e.g. 20 of 32 right)", () => {
    const officialBig = new Set(
      Array.from({ length: 32 }, (_, i) => `T${i}`),
    );
    const predicted = Array.from({ length: 25 }, (_, i) => `T${i}`); // 25 picks, T0..T24 — 25 hits (all in official)
    const events = scoreAdvancerPrediction("u1", predicted, officialBig);
    expect(events[0].points).toBe(25 * POINTS.ADVANCER_HIT);
  });
});

describe("scoreChampionPrediction", () => {
  it("awards 30 pts for correct champion", () => {
    const events = scoreChampionPrediction(
      { user_id: "u1", tournament_id: "t1", team: "Brazil" },
      "Brazil",
    );
    expect(events).toHaveLength(1);
    expect(events[0].points).toBe(POINTS.CHAMPION_HIT);
    expect(events[0].reason).toBe(REASONS.CHAMPION);
  });

  it("returns empty for wrong champion", () => {
    expect(
      scoreChampionPrediction(
        { user_id: "u1", tournament_id: "t1", team: "Brazil" },
        "Argentina",
      ),
    ).toEqual([]);
  });
});
