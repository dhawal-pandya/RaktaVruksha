/**
 * A warm radial vignette behind the tree — no geometry, no iconography.
 *
 * It has to be painted *over* the canvas rather than behind it, since the WebGL
 * renderer clears opaque, so it is pinned above the scene in z-order, below every
 * piece of HUD, and is never a pointer target. Its strength comes from
 * `--backdrop-opacity`, set from layout.json (see core/layoutTuning.ts), so it can
 * be dialled or switched off without touching code.
 *
 * This replaced a full yantra — lotus rings, shatkonas, spokes. At any opacity
 * where that geometry was legible it competed with the orbs for attention, and at
 * an opacity where it didn't, it read as a smudge rather than a choice. A gradient
 * gives the void a centre without ever being a picture in its own right.
 */
export default function Backdrop() {
  return <div className="backdrop" aria-hidden="true" />;
}
