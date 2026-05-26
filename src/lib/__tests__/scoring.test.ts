import { describe, expect, it } from "vitest";
import {
  scoreGroupPrediction,
  scoreMatchPrediction,
} from "@/lib/scoring/compute";
import { POINTS, STAGE_MULTIPLIER } from "@/lib/scoring/rules";
import type { GroupPrediction, Match, MatchPrediction } from "@/types/db";

function makeMatch(over: Partial<Match> = {}): Match {
  return {
    id: "m1",
    tournament_id: "t1",
    stage: "group",
    group_name: "A",
    match_number: 1,
    home_team: "Brasil",
    away_team: "Argentina",
    kickoff_at: "2026-06-11T15:00:00Z",
    status: "completed",
    home_score: 2,
    away_score: 1,
    winner: "home",
    locked_at: "2026-06-11T14:59:00Z",
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

describe("scoreMatchPrediction", () => {
  it("returns empty when match not completed", () => {
    expect(
      scoreMatchPrediction(makeMatchPred(), makeMatch({ status: "upcoming" })),
    ).toEqual([]);
  });

  it("returns empty when match has no winner set", () => {
    expect(
      scoreMatchPrediction(
        makeMatchPred(),
        makeMatch({ status: "completed", winner: null }),
      ),
    ).toEqual([]);
  });

  it("awards winner-only points when winner is correct but score differs", () => {
    const events = scoreMatchPrediction(
      makeMatchPred({ home_score: 3, away_score: 0 }),
      makeMatch(),
    );
    expect(events).toHaveLength(1);
    expect(events[0].points).toBe(POINTS.MATCH_CORRECT_WINNER);
  });

  it("awards winner + exact-score bonus when both match", () => {
    const events = scoreMatchPrediction(makeMatchPred(), makeMatch());
    expect(events).toHaveLength(2);
    const total = events.reduce((s, e) => s + e.points, 0);
    expect(total).toBe(
      POINTS.MATCH_CORRECT_WINNER + POINTS.MATCH_EXACT_SCORE_BONUS,
    );
  });

  it("awards exact-score bonus for 0-0 draws", () => {
    const events = scoreMatchPrediction(
      makeMatchPred({ winner: "draw", home_score: 0, away_score: 0 }),
      makeMatch({ winner: "draw", home_score: 0, away_score: 0 }),
    );
    const total = events.reduce((s, e) => s + e.points, 0);
    expect(total).toBe(
      POINTS.MATCH_CORRECT_WINNER + POINTS.MATCH_EXACT_SCORE_BONUS,
    );
  });

  it("awards correct points on a predicted draw that hits", () => {
    const events = scoreMatchPrediction(
      makeMatchPred({ winner: "draw", home_score: 1, away_score: 1 }),
      makeMatch({ winner: "draw", home_score: 1, away_score: 1 }),
    );
    expect(events).toHaveLength(2);
  });

  it("does not award exact-score bonus when prediction scores are null", () => {
    const events = scoreMatchPrediction(
      makeMatchPred({ home_score: null, away_score: null }),
      makeMatch(),
    );
    expect(events).toHaveLength(1);
    expect(events[0].points).toBe(POINTS.MATCH_CORRECT_WINNER);
  });

  it("does not award exact-score bonus when match scores are missing", () => {
    const events = scoreMatchPrediction(
      makeMatchPred(),
      makeMatch({ home_score: null, away_score: null }),
    );
    // winner correct but no scores to compare → only winner points
    expect(events).toHaveLength(1);
  });

  it("applies stage multiplier for knockout matches (final)", () => {
    const events = scoreMatchPrediction(
      makeMatchPred(),
      makeMatch({ stage: "final" }),
    );
    const total = events.reduce((s, e) => s + e.points, 0);
    const expected =
      Math.round(POINTS.MATCH_CORRECT_WINNER * STAGE_MULTIPLIER.final) +
      Math.round(POINTS.MATCH_EXACT_SCORE_BONUS * STAGE_MULTIPLIER.final);
    expect(total).toBe(expected);
  });

  it("applies fractional multiplier correctly for round_of_32 (1.25x)", () => {
    const events = scoreMatchPrediction(
      makeMatchPred(),
      makeMatch({ stage: "round_of_32" }),
    );
    const total = events.reduce((s, e) => s + e.points, 0);
    const expected =
      Math.round(POINTS.MATCH_CORRECT_WINNER * 1.25) +
      Math.round(POINTS.MATCH_EXACT_SCORE_BONUS * 1.25);
    expect(total).toBe(expected);
  });

  it("awards nothing for wrong winner", () => {
    expect(
      scoreMatchPrediction(makeMatchPred({ winner: "away" }), makeMatch()),
    ).toEqual([]);
  });
});

describe("scoreGroupPrediction", () => {
  const basePred: GroupPrediction = {
    id: "g1",
    user_id: "u1",
    tournament_id: "t1",
    group_name: "A",
    advancing_team_1: "Brasil",
    advancing_team_2: "Argentina",
    locked: true,
    submitted_at: "",
    updated_at: "",
  };

  it("awards both-correct bonus when both teams hit", () => {
    const events = scoreGroupPrediction(basePred, {
      team1: "Brasil",
      team2: "Argentina",
    });
    const total = events.reduce((s, e) => s + e.points, 0);
    expect(total).toBe(
      2 * POINTS.GROUP_TEAM_ADVANCING + POINTS.GROUP_BOTH_TEAMS_CORRECT_BONUS,
    );
  });

  it("awards single-hit when one team correct", () => {
    const events = scoreGroupPrediction(basePred, {
      team1: "Brasil",
      team2: "México",
    });
    const total = events.reduce((s, e) => s + e.points, 0);
    expect(total).toBe(POINTS.GROUP_TEAM_ADVANCING);
  });

  it("awards nothing on a miss", () => {
    const events = scoreGroupPrediction(basePred, {
      team1: "Canadá",
      team2: "México",
    });
    expect(events).toEqual([]);
  });

  it("caps hits at unique teams when prediction has duplicate entries", () => {
    // Defensive: shouldn't happen due to DB CHECK constraint, but verify safety
    const dupePred = {
      ...basePred,
      advancing_team_1: "Brasil",
      advancing_team_2: "Brasil",
    };
    const events = scoreGroupPrediction(dupePred, {
      team1: "Brasil",
      team2: "Argentina",
    });
    // Set semantics: only 1 unique team predicted, so max hits = 1
    const total = events.reduce((s, e) => s + e.points, 0);
    expect(total).toBe(POINTS.GROUP_TEAM_ADVANCING);
  });
});
