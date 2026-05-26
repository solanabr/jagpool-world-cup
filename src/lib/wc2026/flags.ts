// Map FIFA WC 2026 team names to ISO-2 country codes, then to Unicode flag emoji.
// Foundation-only: frontend dev can swap to SVG flag images later if desired.

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

// England and Scotland use Unicode tag sequences (subdivision flags), not ISO regional indicators
const SUBDIVISION_FLAGS: Record<string, string> = {
  England: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  Scotland: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
};

function codeToFlag(iso2: string): string {
  return iso2
    .toUpperCase()
    .split("")
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join("");
}

export function flagFor(team: string): string {
  if (SUBDIVISION_FLAGS[team]) return SUBDIVISION_FLAGS[team];
  const code = ISO_CODES[team];
  return code ? codeToFlag(code) : "";
}
