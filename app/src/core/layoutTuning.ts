/**
 * Every dial that shapes the 3D tree's spread, in one place.
 *
 * The values live in public/layout.json, loaded at boot exactly the way the family
 * datasets are, so tuning is data rather than code: the deployed site reads whatever
 * that file says, and no rebuild is involved in changing it. Locally, with editing
 * unlocked, the Layout Lab drags the dials and writes the file straight back — the
 * same round trip family-data.json makes.
 *
 * `computeLayout` reads LAYOUT_TUNING at call time and the object is only ever
 * mutated in place, which is what lets a slider take effect on the next layout.
 *
 * What is NOT here, because it is structural rather than a taste knob: Y is always
 * locked to generation, and a couple is always one rigid body. See layout.ts.
 */
export interface LayoutTuning {
  /** Repulsion between orbs. More negative = more space. The primary spread dial. */
  chargeStrength: number;
  /** How far that repulsion reaches, in world units (LAYER_GAP is 110). */
  chargeDistanceMax: number;
  /**
   * How many generations away an orb still pushes on, and the reason children used
   * to get shoved out from under their own parents: repulsion is computed in 3D, so
   * at the old reach of 360 against a 110 layer gap every orb was elbowing three
   * rows above and below it, and the gap it opened underneath got filled by whatever
   * unrelated cluster drifted in.
   *
   * 0 = orbs only push against their own generation, so a row can sit squarely under
   * the row above it. 1 = neighbouring rows push too, at reduced weight (the windows
   * overlap, so influence tapers off with distance instead of stopping dead). Raise
   * it past the tree's depth to get the old whole-graph behaviour back.
   */
  chargeLayerBand: number;
  /**
   * How hard children are pulled to sit beneath their own parents, on the XZ plane.
   * 0 = off (spread is left entirely to the link force, as it used to be). This is
   * the dial that means "children directly below their parents".
   */
  descentPull: number;
  /**
   * Gap between neighbouring siblings on the disc they fan out over beneath their
   * parent. An only child sits dead centre; N children pack a disc whose radius
   * grows as √N, so a brood of a hundred spreads without being flung into orbit.
   * Collide still enforces its own minimum, so values below 2 × personCollide have
   * no visible effect.
   */
  siblingSpacing: number;
  /** Pull toward the family's own cluster centre. */
  familyPull: number;
  /** Spacing between family cluster centres: scale × √nodes + base. */
  familyRingScale: number;
  familyRingBase: number;
  /** An outside spouse (a remarriage) sits this close… */
  partnerDistance: number;
  /** …and is held this firmly. */
  partnerStrength: number;
  /** Preferred parent→child link length, and how firmly it is asked for. */
  childDistance: number;
  childStrength: number;
  /** Hard minimum spacing, so orbs can never overlap. */
  personCollide: number;
  unionCollide: number;
  /** Half the distance between two welded partners. */
  coupleOffset: number;
  /**
   * A rigid couple's collide radius, as a multiple of personCollide. Must stay ≥ 2:
   * that is what guarantees no stranger ever ends up closer to a person than their
   * own spouse (see the proof in layout.ts).
   */
  coupleCollideFactor: number;
  /** Simulation ticks. Large graphs get fewer, to keep boot snappy. */
  ticks: number;
  ticksLarge: number;
  largeGraphNodes: number;
  /**
   * Strength of the warm vignette behind the tree. 0 turns it off entirely.
   * The one dial here that shapes the look rather than the geometry — it lives in
   * this file because it is the same edit-locally-and-commit round trip as the
   * rest, and a second JSON file for a single number would cost more than it
   * explains. Changing it must never re-run the simulation; see applyBackdrop.
   */
  backdropOpacity: number;
}

/** The file the tuning is read from and written back to, beside the datasets. */
export const LAYOUT_FILE = "layout.json";

/**
 * Fallback values, used only when layout.json is missing or unreadable — the tree
 * still draws rather than failing to boot. public/layout.json is the source of
 * truth and should be kept in step with these.
 */
export const DEFAULT_LAYOUT_TUNING: LayoutTuning = {
  chargeStrength: -400,
  chargeDistanceMax: 640,
  chargeLayerBand: 2,
  descentPull: 0.72,
  siblingSpacing: 42,
  familyPull: 0.025,
  familyRingScale: 26,
  familyRingBase: 60,
  partnerDistance: 20,
  partnerStrength: 1,
  childDistance: 26,
  childStrength: 0.25,
  personCollide: 16,
  unionCollide: 8,
  coupleOffset: 15,
  coupleCollideFactor: 2,
  ticks: 220,
  ticksLarge: 130,
  largeGraphNodes: 2500,
  backdropOpacity: 0.4,
};

export const LAYOUT_TUNING_KEYS = Object.keys(
  DEFAULT_LAYOUT_TUNING,
) as (keyof LayoutTuning)[];

/**
 * The live tuning. Mutated in place — never reassigned — because layout.ts and the
 * Layout Lab both hold this exact object, and reading it at call time is what lets
 * a slider or a reloaded file take effect on the next layout.
 */
export const LAYOUT_TUNING: LayoutTuning = { ...DEFAULT_LAYOUT_TUNING };

/** Exactly the shape written to layout.json: the known keys, in a stable order. */
export const serializeLayoutTuning = (t: LayoutTuning): string =>
  JSON.stringify(
    Object.fromEntries(LAYOUT_TUNING_KEYS.map((k) => [k, t[k]])),
    null,
    2,
  ) + "\n";

/**
 * Push the backdrop strength out as a CSS custom property. Deliberately not React
 * state: the vignette is one always-mounted element, so a variable on the root is
 * both cheaper than a re-render and — more to the point — keeps a purely visual
 * dial off the path that recomputes the layout, which on the deep lineages costs
 * a couple of seconds of force simulation for no change to a single position.
 */
export const applyBackdrop = (): void => {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty(
    "--backdrop-opacity",
    String(LAYOUT_TUNING.backdropOpacity),
  );
};

/**
 * Read layout.json into LAYOUT_TUNING. Only known keys holding finite numbers are
 * taken, so a hand-edited file with a typo, a stray key or a string degrades to the
 * default for that one dial instead of poisoning the simulation with NaN — a single
 * NaN would propagate through the forces and scatter every node to nowhere.
 *
 * Never throws: a missing or broken file leaves the defaults in place.
 */
export const loadLayoutTuning = async (baseUrl = ""): Promise<void> => {
  try {
    // Same cache discipline as the datasets: the CDN must not be able to hand
    // back a stale copy on a refresh.
    const res = await fetch(`${baseUrl}${LAYOUT_FILE}?t=${Date.now()}`, {
      cache: "no-store",
    });
    if (!res.ok) return;
    const raw: unknown = await res.json();
    if (!raw || typeof raw !== "object") return;
    const incoming = raw as Record<string, unknown>;
    for (const key of LAYOUT_TUNING_KEYS) {
      const v = incoming[key];
      if (typeof v === "number" && Number.isFinite(v)) LAYOUT_TUNING[key] = v;
    }
  } catch {
    /* keep the defaults; the tree matters more than the tuning */
  } finally {
    applyBackdrop();
  }
};
