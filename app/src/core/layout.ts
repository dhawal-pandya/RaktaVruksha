import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceZ,
} from "d3-force-3d";
import type { Graph, Vec3 } from "./types";

export const LAYER_GAP = 110;
const UNION_Y_OFFSET = -LAYER_GAP * 0.4;

// --- Force tuning (X/Z only; Y is always locked to generation) --------------
// CHARGE is the "repulsion" dial: raise its magnitude for more space between orbs.
// Couples are simulated as one rigid body (see below) whose collide radius covers
// the whole pair, so no other orb can ever sit between partners or closer to a
// person than their spouse; the body is pulled toward a single family center
// (the union's family), so cross-family marriages no longer get torn between two
// centers. FAMILY_PULL/FAMILY_RING stay at their original, well-behaved values;
// charge is the knob to tune.
const CHARGE_STRENGTH = -200; // repulsion between orbs
const CHARGE_DISTANCE_MAX = 360; // how far that repulsion reaches
const FAMILY_PULL = 0.05; // pull toward family center
const FAMILY_RING = { scale: 26, base: 60 }; // spacing between family cluster centers
const PARTNER_DISTANCE = 20; // an outside spouse (remarriage) sits close…
const PARTNER_STRENGTH = 1; // …and is held firmly
const CHILD_DISTANCE = 48;
const CHILD_STRENGTH = 0.25;
const PERSON_COLLIDE = 16; // hard minimum spacing so orbs never overlap
const UNION_COLLIDE = 8;
const COUPLE_OFFSET = 15; // each partner sits this far from the couple's center
// Radius of a rigid couple body — two people wide. Must be ≥ 30 so that both a
// stranger (kept at COUPLE_COLLIDE+PERSON_COLLIDE from the center, partner 15
// out) and the facing partner of another couple (centers ≥ 2×COUPLE_COLLIDE
// apart) always end farther from a person than their own spouse (30).
const COUPLE_COLLIDE = PERSON_COLLIDE * 2;

interface SimNode {
  id: string;
  kind: "person" | "union" | "couple";
  familyKey: string;
  x: number;
  y: number;
  z: number;
  fy: number;
}

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
 * to a person than their own partner. Partners are emitted ±COUPLE_OFFSET
 * around the body at the end; remaining unions (remarriages) keep the old
 * symmetric snap. Same graph in → same positions out.
 */
export const computeLayout = (graph: Graph): Map<string, Vec3> => {
  const familyKeys = Array.from(
    new Set(graph.nodes.map((n) => n.familyId ?? "__none")),
  ).sort();
  const ringRadius =
    FAMILY_RING.scale * Math.sqrt(graph.nodes.length) + FAMILY_RING.base;
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
    const y = -n.gen * LAYER_GAP + (kind === "union" ? UNION_Y_OFFSET : 0);
    nodes.push({
      id: n.id,
      kind,
      familyKey,
      x: c.x + r * Math.cos(theta),
      y,
      z: c.z + r * Math.sin(theta),
      fy: y,
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
          l.kind === "partner" ? PARTNER_DISTANCE : CHILD_DISTANCE,
        )
        .strength((l: { kind: string }) =>
          l.kind === "partner" ? PARTNER_STRENGTH : CHILD_STRENGTH,
        ),
    )
    .force(
      "charge",
      forceManyBody()
        // A couple body stands in for two people.
        .strength((d: SimNode) =>
          d.kind === "couple" ? CHARGE_STRENGTH * 2 : CHARGE_STRENGTH,
        )
        .distanceMax(CHARGE_DISTANCE_MAX),
    )
    .force(
      "collide",
      forceCollide((d: SimNode) =>
        d.kind === "couple"
          ? COUPLE_COLLIDE
          : d.kind === "union"
            ? UNION_COLLIDE
            : PERSON_COLLIDE,
      ).iterations(2),
    )
    .force(
      "famX",
      forceX((d: SimNode) => centers.get(d.familyKey)!.x).strength(FAMILY_PULL),
    )
    .force(
      "famZ",
      forceZ((d: SimNode) => centers.get(d.familyKey)!.z).strength(FAMILY_PULL),
    )
    .stop();

  const ticks = graph.nodes.length > 2500 ? 130 : 220;
  for (let i = 0; i < ticks; i++) sim.tick();

  // --- emit: split couple bodies into their two orbs -------------------------
  const personGen = new Map<string, number>();
  for (const n of graph.nodes) if (n.kind === "person") personGen.set(n.id, n.gen);
  const unionGen = new Map<string, number>();
  for (const n of graph.nodes) if (n.kind === "union") unionGen.set(n.id, n.gen);
  const layerY = (gen: number): number => -gen * LAYER_GAP + 0; // +0 kills -0

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
      x: n.x - tx * COUPLE_OFFSET,
      y: layerY(personGen.get(a) ?? 0),
      z: n.z - tz * COUPLE_OFFSET,
    });
    out.set(b, {
      x: n.x + tx * COUPLE_OFFSET,
      y: layerY(personGen.get(b) ?? 0),
      z: n.z + tz * COUPLE_OFFSET,
    });
    out.set(n.id, {
      x: n.x,
      y: layerY(unionGen.get(n.id) ?? 0) + UNION_Y_OFFSET,
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
      const k = extraPlaced.get(wid) ?? 0;
      extraPlaced.set(wid, k + 1);
      const rot = (k * 72 * Math.PI) / 180;
      const ux = dx * Math.cos(rot) - dz * Math.sin(rot);
      const uz = dx * Math.sin(rot) + dz * Math.cos(rot);
      f.x = w.x + ux * COUPLE_OFFSET * 2;
      f.z = w.z + uz * COUPLE_OFFSET * 2;
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
