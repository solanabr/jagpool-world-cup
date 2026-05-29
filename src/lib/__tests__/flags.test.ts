import { describe, expect, it } from "vitest";
import { flagCodeFor } from "@/lib/wc2026/flags";

describe("flagCodeFor", () => {
  it("returns lowercase ISO-2 codes for known teams", () => {
    expect(flagCodeFor("Brazil")).toBe("br");
    expect(flagCodeFor("Mexico")).toBe("mx");
    expect(flagCodeFor("South Korea")).toBe("kr");
    expect(flagCodeFor("Bosnia and Herzegovina")).toBe("ba");
    expect(flagCodeFor("Czech Republic")).toBe("cz");
  });

  it("returns GB subdivision codes for England and Scotland", () => {
    expect(flagCodeFor("England")).toBe("gb-eng");
    expect(flagCodeFor("Scotland")).toBe("gb-sct");
  });

  it("returns null for an unknown team", () => {
    expect(flagCodeFor("Atlantis")).toBeNull();
  });

  it("resolves a code for all 48 WC 2026 teams", () => {
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
      expect(flagCodeFor(team)).not.toBeNull();
    }
  });
});
