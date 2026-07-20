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

  // Devas don't join the tidy packing; they hover a generation above their child.
  const divineChildOf = new Map<string, string>();
  for (const l of graph.links) {
    if (l.kind === "divine" && genOf.has(l.source) && genOf.has(l.target)) {
      if (!divineChildOf.has(l.source)) divineChildOf.set(l.source, l.target);
    }
  }
  const isDivine = (id: string) => divineChildOf.has(id);

  // --- parse the subgraph into descent relations ---------------------------
  const unionPartners = new Map<string, string[]>(); // unionNodeId -> [a, b]
  const unionChildren = new Map<string, string[]>(); // unionNodeId -> children (birth order)
  const soloChildren = new Map<string, string[]>(); // personId -> children of a 1-partner union
  const unionGen = new Map<string, number>();
  const unionOrder = new Map<string, number>(); // union-node id -> authoring order
  const parentsInView = new Map<string, string[]>();

  for (const n of graph.nodes)
    if (n.kind === "union") {
      unionGen.set(n.id, n.gen);
      unionOrder.set(n.id, n.order ?? 0);
    }
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
  // Order a person's unions by authoring order (then id): the first is the
  // "primary" spouse, seated on the left; the rest fan out to the right.
  const orderOf = (o: OwnedUnion) =>
    o.unionId ? (unionOrder.get(o.unionId) ?? 0) : 0;
  for (const list of owned.values())
    list.sort(
      (a, b) =>
        orderOf(a) - orderOf(b) ||
        (a.unionId ?? "").localeCompare(b.unionId ?? ""),
    );

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
    // Seat the couple as [primary spouse] · owner · [other spouses]: the first
    // (primary) spouse sits to the owner's left, the rest fan out to the right,
    // so a two-spouse person is flanked on both sides. Spouses already placed
    // elsewhere (a shared partner, e.g. one wife married to several brothers) are
    // only linked, not re-seated. One spouse stays on the right, as before.
    const spouseIds = list
      .filter((o) => o.spouseId)
      .map((o) => o.spouseId as string);
    const newSpouses = spouseIds.filter((sid) => !xSlot.has(sid));
    const leftS = newSpouses.length >= 2 ? newSpouses.slice(0, 1) : [];
    const rightS = newSpouses.length >= 2 ? newSpouses.slice(1) : newSpouses;
    const usedCount = 1 + newSpouses.length;
    const seat = (rowStart: number): number => {
      let gx = rowStart;
      for (const s of leftS) xSlot.set(s, gx++);
      const ox = gx++;
      xSlot.set(id, ox);
      for (const s of rightS) xSlot.set(s, gx++);
      return ox;
    };
    const unionAt = (o: OwnedUnion, ox: number) => {
      if (!o.unionId) return;
      if (o.children.length) {
        const cx = o.children.map((c) => anchor.get(c) ?? ox);
        unionSlot.set(o.unionId, (Math.min(...cx) + Math.max(...cx)) / 2);
      } else {
        const sp = o.spouseId ? (xSlot.get(o.spouseId) ?? ox) : ox;
        unionSlot.set(o.unionId, (ox + sp) / 2);
      }
    };

    if (childSlots === 0) {
      // Leaf couple: centre the seated row within the band.
      const ox = seat(left + (w - usedCount) / 2);
      anchor.set(id, ox);
      for (const o of list) unionAt(o, ox);
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

    // Couple straddles the children's centre.
    const ox = seat(cCenter - (usedCount - 1) / 2);
    for (const o of list) unionAt(o, ox);
  };

  // Roots: members with no parents in view that aren't just someone's spouse.
  const roots = persons
    .map((p) => p.id)
    .filter((id) => !hasParent(id) && !spouseSet.has(id) && !isDivine(id))
    .sort((a, b) => genOf.get(a)! - genOf.get(b)! || a.localeCompare(b));

  let cursor = 0;
  for (const r of roots) {
    if (xSlot.has(r)) continue;
    assign(r, cursor);
    cursor += measure(r) + TREE_GAP;
  }
  // Safety net: anything unplaced (odd cycles, stray spouses) gets its own slot.
  // Devas are placed separately (below), so leave them out here.
  for (const p of persons) {
    if (!xSlot.has(p.id) && !isDivine(p.id)) {
      xSlot.set(p.id, cursor);
      anchor.set(p.id, cursor);
      cursor += 1 + TREE_GAP;
    }
  }

  // --- centre horizontally and emit pixels ---------------------------------
  const xs = [...xSlot.values()];
  const shift = (Math.min(...xs) + Math.max(...xs)) / 2;
  for (const p of persons) {
    if (!xSlot.has(p.id)) continue; // devas: placed by the post-pass below
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

  // Devas hover BETWEEN generations — half a level above their divine child, so
  // they sit on no mortal tier — nudged to the side to stand apart from parents.
  for (const [deva, child] of divineChildOf) {
    const cp = out.get(child);
    if (cp) out.set(deva, { x: cp.x + SLOT * 0.85, y: cp.y - GEN_GAP_2D * 0.5 });
  }
  return out;
};

function mapPush2<T>(m: Map<string, T[]>, k: string, v: T) {
  const a = m.get(k);
  if (a) a.push(v);
  else m.set(k, [v]);
}
