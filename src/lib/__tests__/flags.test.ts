import { describe, expect, it } from "vitest";
import { flagFor } from "@/lib/wc2026/flags";

describe("flagFor", () => {
  it("returns Brazil flag for 'Brazil'", () => {
    // 🇧🇷 = U+1F1E7 (B) + U+1F1F7 (R)
    expect(flagFor("Brazil")).toBe("\u{1F1E7}\u{1F1F7}");
  });

  it("returns Mexico flag for 'Mexico'", () => {
    expect(flagFor("Mexico")).toBe("\u{1F1F2}\u{1F1FD}");
  });

  it("returns South Korea flag for 'South Korea' (compound name)", () => {
    expect(flagFor("South Korea")).toBe("\u{1F1F0}\u{1F1F7}");
  });

  it("returns Bosnia flag for 'Bosnia and Herzegovina'", () => {
    expect(flagFor("Bosnia and Herzegovina")).toBe("\u{1F1E7}\u{1F1E6}");
  });

  it("returns Czech Republic flag", () => {
    expect(flagFor("Czech Republic")).toBe("\u{1F1E8}\u{1F1FF}");
  });

  it("returns special England flag (subdivision)", () => {
    expect(flagFor("England")).toBe("🏴󠁧󠁢󠁥󠁮󠁧󠁿");
  });

  it("returns special Scotland flag (subdivision)", () => {
    expect(flagFor("Scotland")).toBe("🏴󠁧󠁢󠁳󠁣󠁴󠁿");
  });

  it("returns empty string for unknown team", () => {
    expect(flagFor("Atlantis")).toBe("");
  });

  it("handles all 48 WC 2026 teams without throwing", () => {
    const teams = [
      "Algeria", "Argentina", "Australia", "Austria", "Belgium",
      "Bosnia and Herzegovina", "Brazil", "Canada", "Cape Verde", "Colombia",
      "Croatia", "Curaçao", "Czech Republic", "DR Congo", "Ecuador", "Egypt",
      "England", "France", "Germany", "Ghana", "Haiti", "Iran", "Iraq",
      "Ivory Coast", "Japan", "Jordan", "Mexico", "Morocco", "Netherlands",
      "New Zealand", "Norway", "Panama", "Paraguay", "Portugal", "Qatar",
      "Saudi Arabia", "Scotland", "Senegal", "South Africa", "South Korea",
      "Spain", "Sweden", "Switzerland", "Tunisia", "Turkey", "Uruguay",
      "USA", "Uzbekistan",
    ];
    for (const team of teams) {
      const flag = flagFor(team);
      expect(flag.length).toBeGreaterThan(0);
    }
  });
});
