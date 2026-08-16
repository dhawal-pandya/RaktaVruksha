import { STATUS_KEYS, UNION_STATUS } from "./status";
/** Blend two hex colors; t=0 → a, t=1 → b. */
export const mixHex = (a: string, b: string, t: number): string => {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (shift: number) => {
    const va = (pa >> shift) & 0xff;
    const vb = (pb >> shift) & 0xff;
    return Math.round(va + (vb - va) * t);
  };
  const to2 = (v: number) => v.toString(16).padStart(2, "0");
  return `#${to2(ch(16))}${to2(ch(8))}${to2(ch(0))}`;
};

export const UNKNOWN_FAMILY_COLOR = "#8a93a6";
export const BACKGROUND_COLOR = "#0a0e1a";

/** The little dot standing in for a marriage or partnership. */
export const UNION_COLOR = "#4a5468";

/**
 * Tie colors, shared by both scenes and by the guide's legend, so what the guide
 * claims a line means is the color that line is actually drawn in.
 *
 * Keyed by union status for a partner tie, and by tag for a parent-child one —
 * though a child tie is normally overridden by GENDER_LINK below, since it reads
 * more usefully as "who this child is" than as "how they were related".
 */
export const LINK_COLORS: Record<string, string> = {
  // Partner-line colours are declared once in core/status.ts, so a new status
  // gets its colour, its dash, its legend row and its welding rule together.
  ...Object.fromEntries(
    STATUS_KEYS.map((k) => [k, UNION_STATUS[k].color]),
  ),
  biological: "#55617a",
  adoptive: "#7f95b5",
};

/** A union→child line is colored by the child: cool blue for a son, rose for a
 *  daughter. */
export const GENDER_LINK: Record<"male" | "female", string> = {
  male: "#5b9bd5",
  female: "#d86fa4",
};

/** Node tint for a person: family color, desaturated toward gray when deceased. */
export const personColor = (
  familyColor: string | null,
  alive: boolean,
): string => {
  const base = familyColor ?? UNKNOWN_FAMILY_COLOR;
  return alive ? base : mixHex(base, "#69707f", 0.55);
};

/** Dim a color toward the canvas background (used for de-emphasized links). */
export const dimToward = (color: string, amount: number): string =>
  mixHex(color, BACKGROUND_COLOR, amount);

const hexToHue = (hex: string): number | null => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) / 255;
  const g = ((n >> 8) & 0xff) / 255;
  const b = (n & 0xff) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return null; // gray: no hue
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
};

const hslToHex = (h: number, s: number, l: number): string => {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = (
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x]
  ).map((v) => Math.round((v + m) * 255));
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
};

/**
 * A vivid family color whose hue sits as far as possible from the ones already in
 * use, so a new (or same-named) family is visually distinct without hand-picking.
 * Deterministic tie-breaks aren't needed: a little randomness is fine here.
 */
export const randomFamilyColor = (existing: string[]): string => {
  const used = existing.map(hexToHue).filter((h): h is number => h !== null);
  let best = Math.random() * 360;
  let bestGap = -1;
  for (let i = 0; i < 24; i++) {
    const h = Math.random() * 360;
    const gap = used.length
      ? Math.min(
          ...used.map((u) => Math.min(Math.abs(h - u), 360 - Math.abs(h - u))),
        )
      : 360;
    if (gap > bestGap) {
      bestGap = gap;
      best = h;
    }
  }
  // Bright, saturated, readable on the dark canvas.
  return hslToHex(best, 0.62, 0.6);
};
