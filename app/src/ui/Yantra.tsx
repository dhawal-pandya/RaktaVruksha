/**
 * A yantra etched faintly over the canvas: nested squares, two lotus rings, a pair
 * of interlocking shatkonas and the spokes between them.
 *
 * It is deliberately edge-weighted. The stylesheet masks the middle of the screen
 * out entirely, so the geometry only surfaces around the rim where the tree rarely
 * reaches, and never competes with the orbs for attention. Pure inline SVG —
 * no image file, no font, nothing to fetch.
 */

const pt = (r: number, deg: number): [number, number] => {
  const a = (deg * Math.PI) / 180;
  return [r * Math.cos(a), r * Math.sin(a)];
};

const f = ([x, y]: [number, number]) => `${x.toFixed(1)} ${y.toFixed(1)}`;

/** One ring of lotus petals: each is two quadratics bulging out to a tip. */
const petals = (n: number, inner: number, outer: number): string[] => {
  const half = 180 / n;
  return Array.from({ length: n }, (_, i) => {
    const c = (i * 360) / n;
    return [
      `M${f(pt(inner, c - half))}`,
      `Q${f(pt(outer * 0.94, c - half * 0.5))} ${f(pt(outer, c))}`,
      `Q${f(pt(outer * 0.94, c + half * 0.5))} ${f(pt(inner, c + half))}`,
    ].join(' ');
  });
};

/** An equilateral triangle inscribed in a circle, pointing up or down. */
const triangle = (r: number, up: boolean, rot = 0): string =>
  [0, 120, 240]
    .map(a => f(pt(r, a + rot + (up ? -90 : 90))))
    .map((p, i) => `${i ? 'L' : 'M'}${p}`)
    .join(' ') + ' Z';

const SPOKES = 24;

export default function Yantra() {
  return (
    <svg
      className="yantra"
      viewBox="-500 -500 1000 1000"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {/* The fade lives here rather than in CSS so it is measured against the
            artwork, not the viewport: a CSS mask is sized off the window, so the
            band that clears the middle drifted with every window shape. Black
            hides, white shows — the seat and its triangles stay out of the way of
            the tree, and only the outer rings surface. */}
        {/* cx/cy are spelled out: under userSpaceOnUse their default of 50% is
            measured against the viewport, which in this centred viewBox lands on
            the bottom-right corner rather than the middle. */}
        <radialGradient id="yantra-fade" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="500">
          <stop offset="0.40" stopColor="#000" />
          <stop offset="0.72" stopColor="#fff" />
          <stop offset="0.97" stopColor="#fff" />
          <stop offset="1" stopColor="#000" />
        </radialGradient>
        <mask id="yantra-mask" maskUnits="userSpaceOnUse" x="-500" y="-500" width="1000" height="1000">
          <rect x="-500" y="-500" width="1000" height="1000" fill="url(#yantra-fade)" />
        </mask>
      </defs>

      <g fill="none" stroke="var(--yantra)" strokeWidth="1.2" mask="url(#yantra-mask)">
        {/* the spokes between the precinct and the inner seat */}
        <g strokeWidth="0.6" opacity="0.75">
          {Array.from({ length: SPOKES }, (_, i) => {
            const a = (i * 360) / SPOKES;
            return <line key={i} x1={pt(70, a)[0]} y1={pt(70, a)[1]} x2={pt(404, a)[0]} y2={pt(404, a)[1]} />;
          })}
        </g>

        <circle r="404" />
        <circle r="336" strokeWidth="0.7" />
        <circle r="252" />
        <circle r="152" strokeWidth="0.7" />
        <circle r="70" />

        {/* sixteen petals, then eight */}
        <g strokeWidth="0.7">
          {petals(16, 336, 404).map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
        {petals(8, 252, 336).map((d, i) => (
          <path key={i} d={d} />
        ))}

        {/* interlocking triangles */}
        <path d={triangle(240, true)} />
        <path d={triangle(240, false)} />
        <g strokeWidth="0.7">
          <path d={triangle(148, true, 15)} />
          <path d={triangle(148, false, 15)} />
        </g>

        {/* bindu */}
        <circle r="9" fill="var(--yantra)" stroke="none" />
      </g>
    </svg>
  );
}
