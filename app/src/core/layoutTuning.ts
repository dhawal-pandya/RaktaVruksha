/**
 * Every dial that shapes the 3D tree's spread, in one place.
 *
 * `computeLayout` reads these at call time and the object is mutated in place by
 * the dev-only Layout Lab, so a change here — by editing this file (Vite hot-swaps
 * it and the tree re-seats without a reload, camera intact) or by dragging a
 * slider — takes effect on the next layout without a rebuild.
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
   * Gap between adjacent siblings on the ring they fan out on beneath their parent.
   * One child sits dead centre; N children spread on a ring sized so neighbours land
   * this far apart. Collide still enforces its own minimum, so values below
   * 2 × personCollide have no visible effect.
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
}

export const LAYOUT_TUNING: LayoutTuning = {
  chargeStrength: -400,
  chargeDistanceMax: 360,
  chargeLayerBand: 0,
  descentPull: 0.35,
  siblingSpacing: 42,
  familyPull: 0.05,
  familyRingScale: 26,
  familyRingBase: 60,
  partnerDistance: 20,
  partnerStrength: 1,
  childDistance: 48,
  childStrength: 0.25,
  personCollide: 16,
  unionCollide: 8,
  coupleOffset: 15,
  coupleCollideFactor: 2,
  ticks: 220,
  ticksLarge: 130,
  largeGraphNodes: 2500,
};

/** Event the store listens for to recompute the layout in place. Dev only. */
export const RELAYOUT_EVENT = "raktavruksha:relayout";

export const requestRelayout = (): void => {
  if (typeof window !== "undefined")
    window.dispatchEvent(new CustomEvent(RELAYOUT_EVENT));
};

// Hot-swap: keep the object identity every importer already holds and copy the
// edited values onto it, then ask the store to re-run the layout.
if (import.meta.hot) {
  import.meta.hot.accept((mod) => {
    if (!mod) return;
    const next = (mod as unknown as { LAYOUT_TUNING?: LayoutTuning }).LAYOUT_TUNING;
    if (next) Object.assign(LAYOUT_TUNING, next);
    requestRelayout();
  });
}
