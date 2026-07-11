import type { Graph } from './types';

export const GEN_GAP_2D = 130;
const SLOT = 48; // minimum horizontal spacing between nodes in a generation
const UNION_DROP = GEN_GAP_2D * 0.42;

interface Relations {
  parents: Map<string, string[]>;
  children: Map<string, string[]>;
  partners: Map<string, string[]>;
  unionPartners: Map<string, string[]>; // unionNodeId -> [personId, personId]
  unionGen: Map<string, number>;
}

const mapPush = (m: Map<string, string[]>, k: string, v: string) => {
  const a = m.get(k);
  if (a) a.push(v);
  else m.set(k, [v]);
};

const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

const buildRelations = (graph: Graph): Relations => {
  const parents = new Map<string, string[]>();
  const children = new Map<string, string[]>();
  const partners = new Map<string, string[]>();
  const unionPartners = new Map<string, string[]>();
  const unionGen = new Map<string, number>();

  for (const n of graph.nodes) if (n.kind === 'union') unionGen.set(n.id, n.gen);

  for (const l of graph.links) {
    if (l.kind === 'partner') mapPush(unionPartners, l.target, l.source);
  }
  for (const ps of unionPartners.values()) {
    if (ps.length === 2) {
      mapPush(partners, ps[0], ps[1]);
      mapPush(partners, ps[1], ps[0]);
    }
  }
  for (const l of graph.links) {
    if (l.kind !== 'child') continue;
    const parentPersons = unionPartners.get(l.source) ?? [l.source]; // 1-partner union collapses to the person
    for (const par of parentPersons) {
      mapPush(children, par, l.target);
      mapPush(parents, l.target, par);
    }
  }
  return { parents, children, partners, unionPartners, unionGen };
};

/**
 * Deterministic layered (Sugiyama-style) layout for one family's small subgraph.
 * Y is the generation. Within each generation, order is refined by barycenter
 * sweeps to reduce edge crossings, couples are pulled adjacent, and X is assigned
 * by an iterative priority pass so children sit under their parents without overlap.
 */
export const computeLayout2d = (graph: Graph): Map<string, { x: number; y: number }> => {
  const persons = graph.nodes.filter(n => n.kind === 'person');
  const out = new Map<string, { x: number; y: number }>();
  if (persons.length === 0) return out;

  const rel = buildRelations(graph);
  const minGen = Math.min(...persons.map(p => p.gen));

  const layerGens = [...new Set(persons.map(p => p.gen))].sort((a, b) => a - b);
  const order = new Map<number, string[]>();
  for (const g of layerGens) {
    order.set(
      g,
      persons.filter(p => p.gen === g).map(p => p.id).sort(),
    );
  }

  const indexIn = (arr: string[]) => new Map(arr.map((id, i) => [id, i]));

  // Barycenter ordering sweeps.
  for (let pass = 0; pass < 8; pass++) {
    const down = pass % 2 === 0;
    const seq = down ? layerGens : [...layerGens].reverse();
    for (let i = 1; i < seq.length; i++) {
      const g = seq[i];
      const prevIdx = indexIn(order.get(seq[i - 1])!);
      const arr = order.get(g)!;
      const bary = new Map<string, number>();
      arr.forEach((id, selfIdx) => {
        const ns = down ? rel.parents.get(id) ?? [] : rel.children.get(id) ?? [];
        const vals = ns.map(n => prevIdx.get(n)).filter((v): v is number => v !== undefined);
        bary.set(id, vals.length ? mean(vals) : selfIdx);
      });
      arr.sort((a, b) => bary.get(a)! - bary.get(b)! || 0);
    }
  }

  // Pull couples adjacent within each layer, preserving overall order.
  for (const g of layerGens) {
    const arr = order.get(g)!;
    const placed = new Set<string>();
    const next: string[] = [];
    for (const id of arr) {
      if (placed.has(id)) continue;
      next.push(id);
      placed.add(id);
      for (const partner of rel.partners.get(id) ?? []) {
        if (!placed.has(partner) && arr.includes(partner)) {
          next.push(partner);
          placed.add(partner);
        }
      }
    }
    order.set(g, next);
  }

  // X assignment: seed by slot index, then iterate pulling each node toward the
  // average of its cross-layer neighbours + partners while keeping min spacing.
  const pos = new Map<string, number>();
  for (const g of layerGens) order.get(g)!.forEach((id, i) => pos.set(id, i * SLOT));

  const placeLayer = (layer: string[], desired: (id: string) => number | undefined) => {
    let last = -Infinity;
    for (const id of layer) {
      const d = desired(id);
      let x: number;
      if (d === undefined) x = last === -Infinity ? pos.get(id)! : last + SLOT;
      else x = last === -Infinity ? d : Math.max(d, last + SLOT);
      pos.set(id, x);
      last = x;
    }
  };

  for (let iter = 0; iter < 16; iter++) {
    const down = iter % 2 === 0;
    const seq = down ? layerGens : [...layerGens].reverse();
    for (const g of seq) {
      placeLayer(order.get(g)!, id => {
        const cross = down ? rel.parents.get(id) ?? [] : rel.children.get(id) ?? [];
        const ns = [...cross, ...(rel.partners.get(id) ?? [])];
        const vals = ns.map(n => pos.get(n)).filter((v): v is number => v !== undefined);
        return vals.length ? mean(vals) : undefined;
      });
    }
  }

  // Center horizontally.
  const allX = [...pos.values()];
  const shift = allX.length ? mean([Math.min(...allX), Math.max(...allX)]) : 0;

  for (const p of persons) {
    out.set(p.id, { x: (pos.get(p.id) ?? 0) - shift, y: (p.gen - minGen) * GEN_GAP_2D });
  }
  // Union nodes (keyed by their node id, e.g. "un:u_x"): midpoint of their
  // partners, dropped just below the couple.
  for (const [unionNodeKey, ps] of rel.unionPartners) {
    if (ps.length !== 2) continue;
    const xs = ps.map(pp => pos.get(pp)).filter((v): v is number => v !== undefined);
    if (xs.length === 0) continue;
    const gen = rel.unionGen.get(unionNodeKey) ?? minGen;
    out.set(unionNodeKey, { x: mean(xs) - shift, y: (gen - minGen) * GEN_GAP_2D + UNION_DROP });
  }
  return out;
};
