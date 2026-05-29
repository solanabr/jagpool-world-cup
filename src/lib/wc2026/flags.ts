// Map FIFA WC 2026 team names to flag-icons codes (ISO-2 lowercase, or GB
// subdivision codes). Rendered as bundled SVGs by <TeamFlag> — Unicode flag
// emoji don't render on Windows.

const ISO_CODES: Record<string, string> = {
  Algeria: "DZ",
  Argentina: "AR",
  Australia: "AU",
  Austria: "AT",
  Belgium: "BE",
  "Bosnia and Herzegovina": "BA",
  Brazil: "BR",
  Canada: "CA",
  "Cape Verde": "CV",
  Colombia: "CO",
  Croatia: "HR",
  Curaçao: "CW",
  "Czech Republic": "CZ",
  "DR Congo": "CD",
  Ecuador: "EC",
  Egypt: "EG",
  France: "FR",
  Germany: "DE",
  Ghana: "GH",
  Haiti: "HT",
  Iran: "IR",
  Iraq: "IQ",
  "Ivory Coast": "CI",
  Japan: "JP",
  Jordan: "JO",
  Mexico: "MX",
  Morocco: "MA",
  Netherlands: "NL",
  "New Zealand": "NZ",
  Norway: "NO",
  Panama: "PA",
  Paraguay: "PY",
  Portugal: "PT",
  Qatar: "QA",
  "Saudi Arabia": "SA",
  Senegal: "SN",
  "South Africa": "ZA",
  "South Korea": "KR",
  Spain: "ES",
  Sweden: "SE",
  Switzerland: "CH",
  Tunisia: "TN",
  Turkey: "TR",
  Uruguay: "UY",
  USA: "US",
  Uzbekistan: "UZ",
};

// flag-icons codes for GB subdivisions (England/Scotland aren't ISO-2 countries).
const SUBDIVISION_CODES: Record<string, string> = {
  England: "gb-eng",
  Scotland: "gb-sct",
};

// flag-icons code (lowercase ISO-2, or a GB subdivision) for a team, or null if
// unknown. Rendered as a bundled SVG by <TeamFlag>.
export function flagCodeFor(team: string): string | null {
  if (SUBDIVISION_CODES[team]) return SUBDIVISION_CODES[team];
  const code = ISO_CODES[team];
  return code ? code.toLowerCase() : null;
}
