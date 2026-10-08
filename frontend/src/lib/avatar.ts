/** Signal's avatar palette: a light tint background with a saturated foreground for initials. */
export const AVATAR_COLORS: Record<string, { bg: string; fg: string }> = {
  A100: { bg: "#E3E3FE", fg: "#3838F5" },
  A110: { bg: "#DDE7FC", fg: "#1251D3" },
  A120: { bg: "#D8E8F0", fg: "#086DA0" },
  A130: { bg: "#CDE4CD", fg: "#067906" },
  A140: { bg: "#EAE0FD", fg: "#661AFF" },
  A150: { bg: "#F5E3FE", fg: "#9F00F0" },
  A160: { bg: "#F6D8EC", fg: "#B8057C" },
  A170: { bg: "#F5D7D7", fg: "#BE0404" },
  A180: { bg: "#FEF5D0", fg: "#836B01" },
  A190: { bg: "#EAE6D5", fg: "#7D6F40" },
  A200: { bg: "#D2D2DC", fg: "#4F4F6D" },
  A210: { bg: "#D7D7D9", fg: "#5C5C5C" },
};

export const AVATAR_COLOR_KEYS = Object.keys(AVATAR_COLORS);

export function avatarColors(key: string) {
  return AVATAR_COLORS[key] ?? AVATAR_COLORS.A100;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  const letters = parts.length === 1 ? parts[0].slice(0, 1) : parts[0][0] + parts[parts.length - 1][0];
  return letters.toUpperCase();
}

/** Colour used for a sender's name in group chats (the foreground of their avatar colour). */
export function senderNameColor(key: string): string {
  return avatarColors(key).fg;
}
