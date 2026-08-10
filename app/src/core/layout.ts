import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceZ,
} from "d3-force-3d";
import type { Graph, Vec3 } from "./types";
import { LAYOUT_TUNING, type LayoutTuning } from "./layoutTuning";

export const LAYER_GAP = 110;
const UNION_Y_OFFSET_RATIO = -0.4;

// A tree only spreads sideways as far as its families need; it grows downward
// without limit. Past this many generations a fixed layer gap stops being a
// constellation and becomes a thread: the Hiranyagarbha lineage runs ninety-seven
// rows deep against about twenty of horizontal spread, so at LAYER_GAP it is
// nearly five times taller than wide and Fit shows a hairline.
const COMFORTABLE_ROWS = 42;

/**
 * Vertical distance between generations for THIS graph. Constant at LAYER_GAP
 * until a tree passes COMFORTABLE_ROWS, then shrinks so the whole thing keeps
 * roughly the height it would have had at that depth. Ordering, spacing within a
 * row and the "ancestors are up" invariant are untouched; only the scale changes,
 * and only for trees deep enough to need it. A real family tree, and both epics,
 * are well inside the threshold and render exactly as before.
 */
export const layerGapFor = (rows: number): number =>
  rows <= COMFORTABLE_ROWS ? LAYER_GAP : (LAYER_GAP * COMFORTABLE_ROWS) / rows;

// --- Force tuning (X/Z only; Y is always locked to generation) --------------
// Every dial lives in layoutTuning.ts, which is the file to edit (or drive from
// the dev-only Layout Lab). Couples are simulated as one rigid body whose collide
// radius covers the whole pair, so no other orb can ever sit between partners or
// closer to a person than their spouse; the body is pulled toward a single family
// center (the union's family), so cross-family marriages don't get torn between
// two centers.

interface SimNode {
  id: string;
  kind: "person" | "union" | "couple";
  familyKey: string;
  gen: number;
  x: number;
  y: number;
  z: number;
  fy: number;
  vx?: number;
  vz?: number;
}

// A force in d3-force-3d is a callable with an `initialize(nodes, random, nDim)`
// the simulation invokes once. Both custom forces below follow that shape.
type SimForce = ((alpha: number) => void) & {
  initialize?: (nodes: SimNode[], ...args: unknown[]) => void;
};

/**
 * Repulsion confined to a band of generations around each orb.
 *
 * The stock many-body force measures distance in 3D, so with a reach several times
 * the layer gap every orb elbows the rows above and below it — which is exactly how
 * a parent pushed its own children sideways and let a stranger's brood settle in
 * the gap. Here one many-body force is built per generation, over a window of
 * `chargeLayerBand` rows either side, with the strength divided by the window
 * count. Because the windows overlap, an orb's influence tapers off with
 * generational distance rather than stopping dead at the band edge, and same-row
 * repulsion still sums back to the full configured strength. Barnes–Hut is intact
 * within each window, so this is no slower in practice.
 *
 * Band wide enough to span the whole tree ⇒ one plain global force, as before.
 */
const layeredCharge = (nodes: SimNode[], t: LayoutTuning): SimForce => {
  const strengthOf = (d: SimNode) =>
    d.kind === "couple" ? t.chargeStrength * 2 : t.chargeStrength;
  const byGen = new Map<number, SimNode[]>();
  for (const n of nodes) {
    const g = byGen.get(n.gen);
    if (g) g.push(n);
    else byGen.set(n.gen, [n]);
  }
  const gens = [...byGen.keys()].sort((a, b) => a - b);
  const band = Math.max(0, Math.round(t.chargeLayerBand));

  const windows: { f: SimForce; members: SimNode[] }[] = [];
  if (2 * band + 1 >= gens.length) {
    windows.push({
      f: forceManyBody().strength(strengthOf).distanceMax(t.chargeDistanceMax),
      members: nodes,
    });
  } else {
    const share = 2 * band + 1;
    for (const g of gens) {
      const members: SimNode[] = [];
      for (let d = -band; d <= band; d++) {
        const row = byGen.get(g + d);
        if (row) members.push(...row);
      }
      if (members.length < 2) continue;
      windows.push({
        f: forceManyBody()
          .strength((d: SimNode) => strengthOf(d) / share)
          .distanceMax(t.chargeDistanceMax),
        members,
      });
    }
  }

  const force = ((alpha: number) => {
    for (const w of windows) w.f(alpha);
  }) as SimForce;
  // The simulation hands every force the full node list; each window ignores it and
  // initializes over its own slice. `node.index` is already assigned by then, which
  // is what the many-body force keys its strengths by.
  force.initialize = (_all, ...args) => {
    for (const w of windows) w.f.initialize?.(w.members, ...args);
  };
  return force;
};

interface DescentPair {
  child: SimNode;
  parent: SimNode;
  ox: number;
  oz: number;
}

/** Pulls each child toward its own parent's XZ (plus its seat on the sibling ring).
 *  One-directional on purpose: children follow parents, never the reverse, so the
 *  elder rows stay where the family forces put them. */
const descentForce = (pairs: DescentPair[], strength: number): SimForce => {
  const force = ((alpha: number) => {
    const k = strength * alpha;
    for (const p of pairs) {
      p.child.vx = (p.child.vx ?? 0) + (p.parent.x + p.ox - p.child.x) * k;
      p.child.vz = (p.child.vz ?? 0) + (p.parent.z + p.oz - p.child.z) * k;
    }
  }) as SimForce;
  force.initialize = () => {};
  return force;
};

// Deterministic per-union rotation for the sibling disc, so sibling pairs across
// the tree don't all line up along the same axis.
const ringPhase = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) / 4294967296) * 2 * Math.PI;
};

// When someone has several unions, the one whose couple stays welded together:
// the current marriage beats an old one.
const STATUS_RANK: Record<string, number> = {
  married: 0,
  partners: 1,
  unknown: 2,
  divorced: 3,
};

/**
 * Headless, deterministic 3D layout. Y is locked to generation (ancestors up);
 * X/Z settle via forces, seeded per family so families form spatial clusters.
 *
 * Each 2-partner union whose partners belong to no earlier-ranked union is a
 * single rigid "couple" body in the simulation, with a collide radius covering
 * both partners. That makes adjacency a geometric guarantee, not a force
 * outcome: nothing can drift between a couple, and no stranger ends up closer
 * to a person than their own partner. Partners are emitted ±coupleOffset
 * around the body at the end; remaining unions (remarriages) keep the old
 * symmetric snap. Same graph in → same positions out.
 */
export const computeLayout = (graph: Graph): Map<string, Vec3> => {
  const t = LAYOUT_TUNING;
  const coupleCollide = t.personCollide * t.coupleCollideFactor;
  const gens = graph.nodes.map((n) => n.gen);
  const layerGap = layerGapFor(
    gens.length ? Math.max(...gens) - Math.min(...gens) + 1 : 1,
  );
  const unionYOffset = layerGap * UNION_Y_OFFSET_RATIO;
  const familyKeys = Array.from(
    new Set(graph.nodes.map((n) => n.familyId ?? "__none")),
  ).sort();
  const ringRadius =
    t.familyRingScale * Math.sqrt(graph.nodes.length) + t.familyRingBase;
  const centers = new Map<string, { x: number; z: number }>();
  familyKeys.forEach((key, i) => {
    const angle = (2 * Math.PI * i) / familyKeys.length;
    centers.set(key, {
      x: ringRadius * Math.cos(angle),
      z: ringRadius * Math.sin(angle),
    });
  });

  // --- pick each person's primary union: those couples become rigid bodies --
  const partnersByUnion = new Map<string, string[]>();
  for (const l of graph.links) {
    if (l.kind !== "partner") continue;
    if (!partnersByUnion.has(l.target)) partnersByUnion.set(l.target, []);
    partnersByUnion.get(l.target)!.push(l.source);
  }
  const repOf = new Map<string, string>(); // person id → couple body (union node) id
  const rigidSpouseOf = new Map<string, string>(); // person id → their welded partner
  const rigidUnions = new Set<string>();
  const unionNodes = graph.nodes
    .filter((n) => n.kind === "union")
    .sort(
      (a, b) =>
        (STATUS_RANK[a.status] ?? 2) - (STATUS_RANK[b.status] ?? 2) ||
        a.id.localeCompare(b.id),
    );
  for (const un of unionNodes) {
    const ps = partnersByUnion.get(un.id);
    if (!ps || ps.length !== 2) continue;
    if (repOf.has(ps[0]) || repOf.has(ps[1])) continue;
    rigidUnions.add(un.id);
    repOf.set(ps[0], un.id);
    repOf.set(ps[1], un.id);
    rigidSpouseOf.set(ps[0], ps[1]);
    rigidSpouseOf.set(ps[1], ps[0]);
  }
  const rep = (id: string): string => repOf.get(id) ?? id;

  // --- sim nodes, seeded deterministically (phyllotaxis per family) ---------
  const perFamilyCount = new Map<string, number>();
  const nodes: SimNode[] = [];
  for (const n of graph.nodes) {
    if (n.kind === "person" && repOf.has(n.id)) continue; // lives inside a couple body
    const kind: SimNode["kind"] =
      n.kind === "union" ? (rigidUnions.has(n.id) ? "couple" : "union") : "person";
    const familyKey = n.familyId ?? "__none";
    const k = perFamilyCount.get(familyKey) ?? 0;
    perFamilyCount.set(familyKey, k + 1);
    const c = centers.get(familyKey)!;
    const r = 13 * Math.sqrt(k);
    const theta = k * 2.39996;
    // Couple bodies live on the partners' layer; loose union dots sit below it.
    const y = -n.gen * layerGap + (kind === "union" ? unionYOffset : 0);
    nodes.push({
      id: n.id,
      kind,
      familyKey,
      gen: n.gen,
      x: c.x + r * Math.cos(theta),
      y,
      z: c.z + r * Math.sin(theta),
      fy: y,
    });
  }
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  // --- descent: seat each sibling set on a ring under its parent -------------
  const childrenOfSource = new Map<string, string[]>();
  for (const l of graph.links) {
    if (l.kind !== "child") continue;
    const kids = childrenOfSource.get(l.source);
    if (kids) kids.push(l.target);
    else childrenOfSource.set(l.source, [l.target]);
  }
  const descentPairs: DescentPair[] = [];
  for (const [sourceId, kids] of childrenOfSource) {
    const parent = nodeById.get(rep(sourceId));
    if (!parent) continue;
    const phase = ringPhase(sourceId);
    const n = kids.length;
    // Siblings fill a disc, not a ring: on a ring the radius needed to keep
    // neighbours siblingSpacing apart grows with the count, which flung the
    // hundred Kauravas six hundred units clear of Dhritarashtra and dragged half
    // the epic out with them. Packed on a disc it grows as √n instead — the area
    // a brood of that size genuinely needs. Sunflower spacing (golden angle, radius
    // by √index) keeps neighbours evenly apart at any count; an only child sits
    // dead centre, directly beneath its parent.
    const outer = t.siblingSpacing * Math.sqrt(n / Math.PI);
    kids.forEach((kid, i) => {
      const child = nodeById.get(rep(kid));
      if (!child || child === parent) return;
      const radius = n <= 1 ? 0 : outer * Math.sqrt((i + 0.5) / n);
      const angle = phase + i * 2.39996;
      descentPairs.push({
        child,
        parent,
        ox: radius * Math.cos(angle),
        oz: radius * Math.sin(angle),
      });
    });
  }

  // Links between representatives; a rigid couple's own partner links collapse
  // to self-links and are dropped.
  const links: { source: string; target: string; kind: string }[] = [];
  for (const l of graph.links) {
    const source = rep(l.source);
    const target = rep(l.target);
    if (source === target) continue;
    links.push({ source, target, kind: l.kind });
  }

  const sim = forceSimulation(nodes, 3)
    .force(
      "link",
      forceLink(links)
        .id((d: SimNode) => d.id)
        .distance((l: { kind: string }) =>
          l.kind === "partner" ? t.partnerDistance : t.childDistance,
        )
        .strength((l: { kind: string }) =>
          l.kind === "partner" ? t.partnerStrength : t.childStrength,
        ),
    )
    .force("charge", layeredCharge(nodes, t))
    .force("descent", descentForce(descentPairs, t.descentPull))
    .force(
      "collide",
      forceCollide((d: SimNode) =>
        d.kind === "couple"
          ? coupleCollide
          : d.kind === "union"
            ? t.unionCollide
            : t.personCollide,
      ).iterations(2),
    )
    .force(
      "famX",
      forceX((d: SimNode) => centers.get(d.familyKey)!.x).strength(t.familyPull),
    )
    .force(
      "famZ",
      forceZ((d: SimNode) => centers.get(d.familyKey)!.z).strength(t.familyPull),
    )
    .stop();

  const ticks =
    graph.nodes.length > t.largeGraphNodes ? t.ticksLarge : t.ticks;
  for (let i = 0; i < ticks; i++) sim.tick();

  // --- emit: split couple bodies into their two orbs -------------------------
  const personGen = new Map<string, number>();
  for (const n of graph.nodes) if (n.kind === "person") personGen.set(n.id, n.gen);
  const unionGen = new Map<string, number>();
  for (const n of graph.nodes) if (n.kind === "union") unionGen.set(n.id, n.gen);
  const layerY = (gen: number): number => -gen * layerGap + 0; // +0 kills -0

  const out = new Map<string, Vec3>();
  const snapped = new Set<string>(); // people already welded into a couple
  for (const n of nodes) {
    if (n.kind === "person") {
      out.set(n.id, { x: n.x, y: n.fy, z: n.z });
      continue;
    }
    if (n.kind === "union") {
      out.set(n.id, { x: n.x, y: n.fy, z: n.z });
      continue;
    }
    // Couple: partners sit ±offset along the tangent of the family ring, so the
    // pair faces along its cluster rather than pointing at the center.
    const [a, b] = partnersByUnion.get(n.id)!;
    const c = centers.get(n.familyKey)!;
    let tx = -(n.z - c.z);
    let tz = n.x - c.x;
    const len = Math.hypot(tx, tz);
    if (len < 1e-6) {
      tx = 1;
      tz = 0;
    } else {
      tx /= len;
      tz /= len;
    }
    out.set(a, {
      x: n.x - tx * t.coupleOffset,
      y: layerY(personGen.get(a) ?? 0),
      z: n.z - tz * t.coupleOffset,
    });
    out.set(b, {
      x: n.x + tx * t.coupleOffset,
      y: layerY(personGen.get(b) ?? 0),
      z: n.z + tz * t.coupleOffset,
    });
    out.set(n.id, {
      x: n.x,
      y: layerY(unionGen.get(n.id) ?? 0) + unionYOffset,
      z: n.z,
    });
    snapped.add(a);
    snapped.add(b);
  }

  // Remaining 2-partner unions (remarriages). Non-rigid means at least one
  // partner is welded into a couple, so seat the free partner in a row on the
  // welded partner's other side, opposite their rigid spouse — Jasodaben—Arun—
  // Taraben — with further extra spouses fanned around them. Nobody already
  // welded moves; the union dot re-centers between the final positions.
  // How many free spouses fan around each welded partner, so a partner wed to
  // many (Daksha's daughters, a polygamous sage) gets a ring sized to fit them
  // all rather than piling them onto a fixed little circle.
  const rigidSnapped = new Set(snapped);
  const extraCountOf = new Map<string, number>();
  for (const [unId, partnerIds] of partnersByUnion) {
    if (rigidUnions.has(unId) || partnerIds.length !== 2) continue;
    const a0 = rigidSnapped.has(partnerIds[0]);
    const b0 = rigidSnapped.has(partnerIds[1]);
    if (a0 !== b0) {
      const wid = a0 ? partnerIds[0] : partnerIds[1];
      extraCountOf.set(wid, (extraCountOf.get(wid) ?? 0) + 1);
    }
  }

  const extraPlaced = new Map<string, number>();
  for (const [unId, partnerIds] of partnersByUnion) {
    if (rigidUnions.has(unId) || partnerIds.length !== 2) continue;
    const aFixed = snapped.has(partnerIds[0]);
    const bFixed = snapped.has(partnerIds[1]);
    if (aFixed !== bFixed) {
      const [wid, fid] = aFixed
        ? [partnerIds[0], partnerIds[1]]
        : [partnerIds[1], partnerIds[0]];
      const w = out.get(wid)!;
      const f = out.get(fid)!;
      const sp = rigidSpouseOf.has(wid) ? out.get(rigidSpouseOf.get(wid)!) : undefined;
      let dx = sp ? w.x - sp.x : f.x - w.x;
      let dz = sp ? w.z - sp.z : f.z - w.z;
      const len = Math.hypot(dx, dz);
      if (len < 1e-6) {
        dx = 1;
        dz = 0;
      } else {
        dx /= len;
        dz /= len;
      }
      const total = extraCountOf.get(wid) ?? 1;
      const k = extraPlaced.get(wid) ?? 0;
      extraPlaced.set(wid, k + 1);
      // A few remarriages: a small offset opposite the rigid spouse, as before.
      // Many spouses on one partner: spread them evenly on a ring whose radius
      // grows with the count, so N orbs never overlap however large N gets.
      const step = total <= 2 ? (72 * Math.PI) / 180 : (2 * Math.PI) / total;
      const rot = total <= 2 ? k * step : (k - (total - 1) / 2) * step;
      const radius =
        total <= 2
          ? t.coupleOffset * 2
          : Math.max(t.coupleOffset * 2, (total * t.personCollide * 2.3) / (2 * Math.PI));
      const ux = dx * Math.cos(rot) - dz * Math.sin(rot);
      const uz = dx * Math.sin(rot) + dz * Math.cos(rot);
      f.x = w.x + ux * radius;
      f.z = w.z + uz * radius;
      snapped.add(fid);
    }
    // Both welded (chain of marriages between couples): nothing moves.
    const a = out.get(partnerIds[0])!;
    const b = out.get(partnerIds[1])!;
    const un = out.get(unId)!;
    un.x = (a.x + b.x) / 2;
    un.z = (a.z + b.z) / 2;
  }

  return out;
};
