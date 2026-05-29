const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]+$/;

export function isValidBase58(input: unknown, minLen = 32, maxLen = 44): boolean {
  if (typeof input !== "string") return false;
  if (input.length < minLen || input.length > maxLen) return false;
  return BASE58_RE.test(input);
}

export function isValidUuid(input: unknown): boolean {
  if (typeof input !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    input,
  );
}

export function clampInt(
  input: unknown,
  min: number,
  max: number,
): number | null {
  if (typeof input !== "number" || !Number.isInteger(input)) return null;
  if (input < min || input > max) return null;
  return input;
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
