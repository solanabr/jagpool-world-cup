/**
 * The real WC2026 group-stage outcome, used by the admin "Fill known results"
 * shortcut so the bracket can be reconstructed in one click (demo runs, or
 * recovering after a results reset) instead of ticking 32 teams by hand.
 *
 * Two separate things are needed, because the DB can't derive one from the
 * other: the flat advancer set (what scoring checks predictions against) and
 * the R32 matchups (which slot each team occupies). `tournament_advancers`
 * stores only (group, team) — no 1st/2nd/3rd rank — and the 8 best-thirds map
 * to slots by FIFA's own table, so the pairings can't be computed.
 */

export const KNOWN_ADVANCERS: { groupName: string; teamName: string }[] = [
  { groupName: "A", teamName: "Mexico" },
  { groupName: "A", teamName: "South Africa" },
  { groupName: "B", teamName: "Switzerland" },
  { groupName: "B", teamName: "Canada" },
  { groupName: "B", teamName: "Bosnia and Herzegovina" },
  { groupName: "C", teamName: "Brazil" },
  { groupName: "C", teamName: "Morocco" },
  { groupName: "D", teamName: "USA" },
  { groupName: "D", teamName: "Australia" },
  { groupName: "D", teamName: "Paraguay" },
  { groupName: "E", teamName: "Germany" },
  { groupName: "E", teamName: "Ivory Coast" },
  { groupName: "E", teamName: "Ecuador" },
  { groupName: "F", teamName: "Netherlands" },
  { groupName: "F", teamName: "Japan" },
  { groupName: "F", teamName: "Sweden" },
  { groupName: "G", teamName: "Belgium" },
  { groupName: "G", teamName: "Egypt" },
  { groupName: "H", teamName: "Spain" },
  { groupName: "H", teamName: "Cape Verde" },
  { groupName: "I", teamName: "France" },
  { groupName: "I", teamName: "Norway" },
  { groupName: "I", teamName: "Senegal" },
  { groupName: "J", teamName: "Argentina" },
  { groupName: "J", teamName: "Austria" },
  { groupName: "J", teamName: "Algeria" },
  { groupName: "K", teamName: "Colombia" },
  { groupName: "K", teamName: "Portugal" },
  { groupName: "K", teamName: "DR Congo" },
  { groupName: "L", teamName: "England" },
  { groupName: "L", teamName: "Croatia" },
  { groupName: "L", teamName: "Ghana" },
];

/**
 * The real outcome of every knockout match, keyed by match number. `winner` is
 * the TEAM NAME (not home/away) so it stays correct regardless of which slot a
 * team lands in after propagation. Scores exist only for the late stages —
 * earlier rounds are winner-only and were never recorded with a scoreline.
 * Late-stage scores are the result at the end of extra time, before penalties.
 */
export const KNOWN_MATCH_RESULTS: Record<
  number,
  { winner: string; homeScore?: number; awayScore?: number }
> = {
  73: { winner: "Canada" },
  74: { winner: "Paraguay" },
  75: { winner: "Morocco" },
  76: { winner: "Brazil" },
  77: { winner: "France" },
  78: { winner: "Norway" },
  79: { winner: "Mexico" },
  80: { winner: "England" },
  81: { winner: "USA" },
  82: { winner: "Belgium" },
  83: { winner: "Portugal" },
  84: { winner: "Spain" },
  85: { winner: "Switzerland" },
  86: { winner: "Argentina" },
  87: { winner: "Colombia" },
  88: { winner: "Egypt" },
  89: { winner: "France" },
  90: { winner: "Morocco" },
  91: { winner: "Norway" },
  92: { winner: "England" },
  93: { winner: "Spain" },
  94: { winner: "Belgium" },
  95: { winner: "Argentina" },
  96: { winner: "Switzerland" },
  97: { winner: "France" },
  98: { winner: "Spain" },
  99: { winner: "England" },
  100: { winner: "Argentina" },
  101: { winner: "Spain", homeScore: 0, awayScore: 2 },
  102: { winner: "Argentina", homeScore: 1, awayScore: 2 },
  103: { winner: "England", homeScore: 4, awayScore: 6 },
  104: { winner: "Spain", homeScore: 1, awayScore: 0 },
};

/** Round-of-32 pairings by match number, in [home, away] order. */
export const KNOWN_R32_MATCHUPS: Record<number, [string, string]> = {
  73: ["South Africa", "Canada"],
  74: ["Germany", "Paraguay"],
  75: ["Netherlands", "Morocco"],
  76: ["Brazil", "Japan"],
  77: ["France", "Sweden"],
  78: ["Ivory Coast", "Norway"],
  79: ["Mexico", "Ecuador"],
  80: ["England", "DR Congo"],
  81: ["USA", "Bosnia and Herzegovina"],
  82: ["Belgium", "Senegal"],
  83: ["Portugal", "Croatia"],
  84: ["Spain", "Austria"],
  85: ["Switzerland", "Algeria"],
  86: ["Argentina", "Cape Verde"],
  87: ["Colombia", "Ghana"],
  88: ["Australia", "Egypt"],
};
