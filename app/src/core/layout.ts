import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceZ,
} from 'd3-force-3d';
import type { Graph, Vec3 } from './types';

export const LAYER_GAP = 110;
const UNION_Y_OFFSET = -LAYER_GAP * 0.4;

interface SimNode {
  id: string;
  kind: 'person' | 'union';
  familyKey: string;
  x: number;
  y: number;
  z: number;
  fy: number;
}

/**
 * Headless, deterministic 3D layout. Y is locked to generation (ancestors up);
 * X/Z settle via forces, seeded per family so families form spatial clusters.
 * Same graph in → same positions out; the world never reshuffles.
 */
export const computeLayout = (graph: Graph): Map<string, Vec3> => {
  const familyKeys = Array.from(
    new Set(graph.nodes.map(n => n.familyId ?? '__none')),
  ).sort();
  const ringRadius = 26 * Math.sqrt(graph.nodes.length) + 60;
  const centers = new Map<string, { x: number; z: number }>();
  familyKeys.forEach((key, i) => {
    const angle = (2 * Math.PI * i) / familyKeys.length;
    centers.set(key, { x: ringRadius * Math.cos(angle), z: ringRadius * Math.sin(angle) });
  });

  // Deterministic phyllotaxis seed within each family cluster.
  const perFamilyCount = new Map<string, number>();
  const nodes: SimNode[] = graph.nodes.map(n => {
    const familyKey = n.familyId ?? '__none';
    const k = perFamilyCount.get(familyKey) ?? 0;
    perFamilyCount.set(familyKey, k + 1);
    const c = centers.get(familyKey)!;
    const r = 13 * Math.sqrt(k);
    const theta = k * 2.39996;
    const y = -n.gen * LAYER_GAP + (n.kind === 'union' ? UNION_Y_OFFSET : 0);
    return {
      id: n.id,
      kind: n.kind,
      familyKey,
      x: c.x + r * Math.cos(theta),
      y,
      z: c.z + r * Math.sin(theta),
      fy: y,
    };
  });

  const links = graph.links.map(l => ({ source: l.source, target: l.target, kind: l.kind }));

  const sim = forceSimulation(nodes, 3)
    .force(
      'link',
      forceLink(links)
        .id((d: SimNode) => d.id)
        .distance((l: { kind: string }) => (l.kind === 'partner' ? 20 : 48))
        // Couples must not be pulled apart by the rest of the web.
        .strength((l: { kind: string }) => (l.kind === 'partner' ? 1 : 0.25)),
    )
    .force('charge', forceManyBody().strength(-70).distanceMax(320))
    .force('collide', forceCollide((d: SimNode) => (d.kind === 'union' ? 8 : 16)))
    .force('famX', forceX((d: SimNode) => centers.get(d.familyKey)!.x).strength(0.05))
    .force('famZ', forceZ((d: SimNode) => centers.get(d.familyKey)!.z).strength(0.05))
    .stop();

  const ticks = graph.nodes.length > 2500 ? 130 : 220;
  for (let i = 0; i < ticks; i++) sim.tick();

  // Couple snap: place each 2-partner union's partners symmetrically around the
  // union node, so a marriage always reads as one tight visual unit no matter
  // what the forces did. People with several unions keep their first snap;
  // the union node re-centers between the final partner positions.
  const byId = new Map(nodes.map(n => [n.id, n]));
  const partnersByUnion = new Map<string, string[]>();
  for (const l of graph.links) {
    if (l.kind !== 'partner') continue;
    if (!partnersByUnion.has(l.target)) partnersByUnion.set(l.target, []);
    partnersByUnion.get(l.target)!.push(l.source);
  }
  const COUPLE_OFFSET = 15;
  const snapped = new Set<string>();
  for (const n of nodes) {
    if (n.kind !== 'union') continue;
    const partnerIds = partnersByUnion.get(n.id);
    if (!partnerIds || partnerIds.length !== 2) continue;
    const a = byId.get(partnerIds[0])!;
    const b = byId.get(partnerIds[1])!;
    const midX = (a.x + b.x) / 2;
    const midZ = (a.z + b.z) / 2;
    let dx = b.x - a.x;
    let dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    if (len < 1e-6) {
      dx = 1;
      dz = 0;
    } else {
      dx /= len;
      dz /= len;
    }
    if (!snapped.has(a.id)) {
      a.x = midX - dx * COUPLE_OFFSET;
      a.z = midZ - dz * COUPLE_OFFSET;
      snapped.add(a.id);
    }
    if (!snapped.has(b.id)) {
      b.x = midX + dx * COUPLE_OFFSET;
      b.z = midZ + dz * COUPLE_OFFSET;
      snapped.add(b.id);
    }
    n.x = (a.x + b.x) / 2;
    n.z = (a.z + b.z) / 2;
  }

  return new Map(nodes.map(n => [n.id, { x: n.x, y: n.fy, z: n.z }]));
};
