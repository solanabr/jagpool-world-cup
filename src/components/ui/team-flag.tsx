import { flagCodeFor } from "@/lib/wc2026/flags";

// A team's flag as a bundled SVG (flag-icons), sized by the inherited font-size.
// Replaces Unicode flag emoji, which don't render on Windows. Returns null for
// unknown / placeholder team names.
export function TeamFlag({
  team,
  className = "",
}: {
  team: string;
  className?: string;
}) {
  const code = flagCodeFor(team);
  if (!code) return null;
  return (
    <span
      role="img"
      aria-label={`${team} flag`}
      className={`fi fi-${code} ${className}`}
    />
  );
}
