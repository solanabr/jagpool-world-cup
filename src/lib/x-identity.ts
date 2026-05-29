export type XIdentity = {
  id: string;
  handle: string;
  avatarUrl: string | null;
};

function firstString(...vals: unknown[]): string | null {
  for (const v of vals) {
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
  }
  return null;
}

/**
 * X profile images arrive as the 48px `_normal` variant
 * (e.g. ..._normal.jpg). Strip the suffix to get the full-resolution original
 * so avatars aren't blurry on larger displays.
 */
export function fullResAvatar(url: string): string {
  return url.replace(/_normal(\.[a-zA-Z0-9]+)(\?.*)?$/, "$1$2");
}

/**
 * Pull the durable id, @handle, and avatar out of a Supabase Twitter identity's
 * identity_data. Returns null when id or handle is missing — an incomplete link
 * we shouldn't persist. Keys vary across provider versions, so several aliases
 * are checked. `id` is the immutable X user id; the handle is renameable.
 */
export function extractXIdentity(identityData: unknown): XIdentity | null {
  if (!identityData || typeof identityData !== "object") return null;
  const d = identityData as Record<string, unknown>;

  const id = firstString(d.sub, d.provider_id);
  const handle = firstString(
    d.user_name,
    d.preferred_username,
    d.nickname,
    d.screen_name,
  );
  if (!id || !handle) return null;

  const rawAvatar = firstString(d.avatar_url, d.picture);
  return {
    id,
    handle: handle.replace(/^@/, ""),
    avatarUrl: rawAvatar ? fullResAvatar(rawAvatar) : null,
  };
}
