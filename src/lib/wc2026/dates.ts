/**
 * Format a UTC ISO timestamp as Brasília time (UTC-3).
 * Example: "2026-06-11T19:00:00Z" → "Jun 11 · 16:00 BRT"
 */
export function formatKickoffBRT(iso: string): string {
  const d = new Date(iso);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("month")} ${get("day")} · ${get("hour")}:${get("minute")} BRT`;
}
