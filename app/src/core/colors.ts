/** Blend two hex colors; t=0 → a, t=1 → b. */
export const mixHex = (a: string, b: string, t: number): string => {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (shift: number) => {
    const va = (pa >> shift) & 0xff;
    const vb = (pb >> shift) & 0xff;
    return Math.round(va + (vb - va) * t);
  };
  const to2 = (v: number) => v.toString(16).padStart(2, '0');
  return `#${to2(ch(16))}${to2(ch(8))}${to2(ch(0))}`;
};

export const UNKNOWN_FAMILY_COLOR = '#8a93a6';
export const BACKGROUND_COLOR = '#0a0e1a';

/** Node tint for a person: family color, desaturated toward gray when deceased. */
export const personColor = (familyColor: string | null, alive: boolean): string => {
  const base = familyColor ?? UNKNOWN_FAMILY_COLOR;
  return alive ? base : mixHex(base, '#69707f', 0.55);
};

/** Dim a color toward the canvas background (used for de-emphasized links). */
export const dimToward = (color: string, amount: number): string =>
  mixHex(color, BACKGROUND_COLOR, amount);
