import type { Graph } from "./types";

export const GEN_GAP_2D = 130;
const SLOT = 48; // horizontal spacing unit between nodes in a generation
const TREE_GAP = 1.4; // slots of empty space between separate root trees
const UNION_DROP = GEN_GAP_2D * 0.42;

const mapPush = (m: Map<string, string[]>, k: string, v: string) => {
  const a = m.get(k);
  if (a) a.push(v);
  else m.set(k, [v]);
};

interface OwnedUnion {
  unionId: string | null; // union-node id, or null for a 1-partner union
  spouseId: string | null;
  children: string[]; // biological children, in birth order
}

/**
 * Deterministic tidy-tree layout for one family's subgraph (Reingold–Tilford style).
 * Each subtree is allotted an exclusive horizontal band, so sibling branches never
 * interleave: a parent's children always sit together beneath them. The tree grows
 * as wide as it needs to; Y is the generation. Same graph in → same positions out.
 *
 * `externalIds` are people shown only because they married a member (their own line
 * isn't in this view); a union is "owned" by its member partner, and the external
 * one hangs off as a spouse leaf.
 */
export const computeLayout2d = (
  graph: Graph,
  externalIds: Set<string> = new Set(),
): Map<string, { x: number; y: number }> => {
  const persons = graph.nodes.filter((n) => n.kind === "person");
  const out = new Map<string, { x: number; y: number }>();
  if (persons.length === 0) return out;

  const genOf = new Map(persons.map((p) => [p.id, p.gen]));
  const minGen = Math.min(...persons.map((p) => p.gen));
  const isPerson = (id: string) => genOf.has(id);

  // --- parse the subgraph into descent relations ---------------------------
  const unionPartners = new Map<string, string[]>(); // unionNodeId -> [a, b]
  const unionChildren = new Map<string, string[]>(); // unionNodeId -> children (birth order)
  const soloChildren = new Map<string, string[]>(); // personId -> children of a 1-partner union
  const unionGen = new Map<string, number>();
  const parentsInView = new Map<string, string[]>();

  for (const n of graph.nodes)
    if (n.kind === "union") unionGen.set(n.id, n.gen);
  for (const l of graph.links) {
    if (l.kind === "partner") mapPush(unionPartners, l.target, l.source);
  }
  for (const l of graph.links) {
    if (l.kind !== "child") continue;
    if (unionPartners.has(l.source)) {
      mapPush(unionChildren, l.source, l.target);
      for (const par of unionPartners.get(l.source)!)
        mapPush(parentsInView, l.target, par);
    } else {
      mapPush(soloChildren, l.source, l.target);
      mapPush(parentsInView, l.target, l.source);
    }
  }
  const hasParent = (id: string) => (parentsInView.get(id)?.length ?? 0) > 0;

  // Which partner "owns" a union (roots the subtree): the member with parents in
  // view wins; else the non-external one; deterministic tiebreak.
  const ownerOf = (uid: string): { owner: string; spouse: string | null } => {
    const ps = unionPartners.get(uid)!.filter(isPerson);
    if (ps.length === 1) return { owner: ps[0], spouse: null };
    const [a, b] = ps;
    const score = (p: string) =>
      (externalIds.has(p) ? 0 : 2) + (hasParent(p) ? 1 : 0);
    const owner =
      score(a) > score(b) ? a : score(b) > score(a) ? b : a < b ? a : b;
    return { owner, spouse: owner === a ? b : a };
  };

  const owned = new Map<string, OwnedUnion[]>();
  const spouseSet = new Set<string>();
  for (const uid of unionPartners.keys()) {
    const { owner, spouse } = ownerOf(uid);
    mapPush2(owned, owner, {
      unionId: uid,
      spouseId: spouse,
      children: (unionChildren.get(uid) ?? []).filter(isPerson),
    });
    if (spouse) spouseSet.add(spouse);
  }
  for (const [person, kids] of soloChildren) {
    if (isPerson(person)) {
      mapPush2(owned, person, {
        unionId: null,
        spouseId: null,
        children: kids.filter(isPerson),
      });
    }
  }
  // Stable order of a person's unions (remarriage etc.).
  for (const list of owned.values())
    list.sort((a, b) => (a.unionId ?? "").localeCompare(b.unionId ?? ""));

  const coupleSlots = (id: string) =>
    1 + (owned.get(id) ?? []).filter((o) => o.spouseId).length;
  const kidsOf = (id: string) =>
    (owned.get(id) ?? []).flatMap((o) => o.children);

  // --- first walk: measure each subtree's width in slots -------------------
  const width = new Map<string, number>();
  const measure = (id: string): number => {
    const cached = width.get(id);
    if (cached !== undefined) return cached;
    width.set(id, 1); // cycle guard
    const childSlots = kidsOf(id).reduce((s, c) => s + measure(c), 0);
    const w = Math.max(coupleSlots(id), childSlots, 1);
    width.set(id, w);
    return w;
  };

  // --- second walk: assign x (in slots), centring couples over children ----
  const xSlot = new Map<string, number>();
  const anchor = new Map<string, number>(); // where this node's parent should centre over it
  const unionSlot = new Map<string, number>();

  const assign = (id: string, left: number) => {
    if (xSlot.has(id)) return;
    const w = measure(id);
    const list = owned.get(id) ?? [];
    const kids = kidsOf(id);
    const childSlots = kids.reduce((s, c) => s + measure(c), 0);
    const cs = coupleSlots(id);

    if (childSlots === 0) {
      // Leaf couple: centre person (+ spouses) within the band.
      let x = left + (w - cs) / 2;
      xSlot.set(id, x);
      anchor.set(id, x);
      x += 1;
      for (const o of list) {
        if (o.spouseId && !xSlot.has(o.spouseId)) {
          xSlot.set(o.spouseId, x);
          x += 1;
        }
        if (o.unionId) {
          const sp = o.spouseId ? xSlot.get(o.spouseId)! : xSlot.get(id)!;
          unionSlot.set(o.unionId, (xSlot.get(id)! + sp) / 2);
        }
      }
      return;
    }

    // Place the children block, centred within this subtree's band.
    let x = left + (w - childSlots) / 2;
    const centres: number[] = [];
    for (const o of list) {
      for (const c of o.children) {
        assign(c, x);
        centres.push(anchor.get(c) ?? x);
        x += measure(c);
      }
    }
    const cCenter = (centres[0] + centres[centres.length - 1]) / 2;
    anchor.set(id, cCenter);

    // Couple straddles the children's centre; the bloodline person leads.
    let gx = cCenter - (cs - 1) / 2;
    xSlot.set(id, gx);
    gx += 1;
    for (const o of list) {
      if (o.spouseId && !xSlot.has(o.spouseId)) {
        xSlot.set(o.spouseId, gx);
        gx += 1;
      }
    }
    // Union node sits over its own children (or the couple, if childless here).
    for (const o of list) {
      if (!o.unionId) continue;
      if (o.children.length) {
        const cx = o.children.map((c) => anchor.get(c) ?? 0);
        unionSlot.set(o.unionId, (Math.min(...cx) + Math.max(...cx)) / 2);
      } else {
        const sp = o.spouseId
          ? (xSlot.get(o.spouseId) ?? xSlot.get(id)!)
          : xSlot.get(id)!;
        unionSlot.set(o.unionId, (xSlot.get(id)! + sp) / 2);
      }
    }
  };

  // Roots: members with no parents in view that aren't just someone's spouse.
  const roots = persons
    .map((p) => p.id)
    .filter((id) => !hasParent(id) && !spouseSet.has(id))
    .sort((a, b) => genOf.get(a)! - genOf.get(b)! || a.localeCompare(b));

  let cursor = 0;
  for (const r of roots) {
    if (xSlot.has(r)) continue;
    assign(r, cursor);
    cursor += measure(r) + TREE_GAP;
  }
  // Safety net: anything unplaced (odd cycles, stray spouses) gets its own slot.
  for (const p of persons) {
    if (!xSlot.has(p.id)) {
      xSlot.set(p.id, cursor);
      anchor.set(p.id, cursor);
      cursor += 1 + TREE_GAP;
    }
  }

  // --- centre horizontally and emit pixels ---------------------------------
  const xs = [...xSlot.values()];
  const shift = (Math.min(...xs) + Math.max(...xs)) / 2;
  for (const p of persons) {
    out.set(p.id, {
      x: (xSlot.get(p.id)! - shift) * SLOT,
      y: (p.gen - minGen) * GEN_GAP_2D,
    });
  }
  for (const [uid, slot] of unionSlot) {
    const gen = unionGen.get(uid) ?? minGen;
    out.set(uid, {
      x: (slot - shift) * SLOT,
      y: (gen - minGen) * GEN_GAP_2D + UNION_DROP,
    });
  }
  return out;
};

function mapPush2<T>(m: Map<string, T[]>, k: string, v: T) {
  const a = m.get(k);
  if (a) a.push(v);
  else m.set(k, [v]);
}
