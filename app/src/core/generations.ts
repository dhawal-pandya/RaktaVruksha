import type { PersonRecord, UnionRecord } from './types';

export interface GenerationResult {
  gen: Map<string, number>;
  componentOf: Map<string, number>;
}

/**
 * Assign a generation number to every person: partners share a generation,
 * children (biological and adopted) sit `childGap` layers below their union's
 * partners (default 1).
 *
 * Partners are merged into groups (union-find); child links become directed
 * edges between groups. Each person's generation is the LONGEST path of gaps
 * down to them, computed by relaxation. Longest-path (rather than first-path)
 * leveling is order-independent and, crucially, keeps every descendant below
 * ALL of their ancestors even when cousin-marriages create multiple paths of
 * differing length between two lineages (e.g. the Kuru and Yadava lines meeting
 * again at Kunti-Pandu): the deeper path wins, so an era gap set on one branch
 * is never bypassed by a shorter route through the other. For data with no such
 * conflicting cycles this yields exactly the same layout as a simple BFS.
 * Deterministic given input order.
 */
export const computeGenerations = (
  people: PersonRecord[],
  unions: UnionRecord[],
): GenerationResult => {
  const known = new Set(people.map(p => p.id));

  // --- union-find: partners of a union share one generation (a "group") -------
  const parent = new Map<string, string>();
  for (const p of people) parent.set(p.id, p.id);
  const find = (x: string): string => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r)!;
    while (parent.get(x) !== r) { const n = parent.get(x)!; parent.set(x, r); x = n; }
    return r;
  };
  const union = (a: string, b: string) => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  for (const u of unions) {
    const ps = u.partners.filter(x => known.has(x));
    for (let i = 1; i < ps.length; i++) union(ps[0], ps[i]);
  }

  // --- relaxation edges between groups. Each parent->child link becomes TWO
  //     lower-bound edges: child >= parent + gap (child sits below its parents) and
  //     parent >= child - gap (a parent sits above its children). The second is what
  //     carries a deep marriage back up the tree: when a daughter is pinned to a late
  //     era by marrying in, `parent >= child - gap` drags her father down, and his
  //     other children (her siblings) follow via their own `child >= parent + gap` —
  //     so an in-marrying lineage's founder lands in the right era, not up at the root.
  // Directed child edges parent-group -> child-group (delta = childGap). This graph is
  // acyclic (no one is their own ancestor), so a plain longest-path leveling puts every
  // node below ALL of its ancestors and can never inflate. Its one rule: a person with
  // no parent in the data is a root at generation 0. In the grand tree that must be
  // Brahma alone, which is exactly why every other lineage has to descend from him.
  const down: { a: string; b: string; d: number }[] = [];
  const edgeSeen = new Set<string>();
  for (const u of unions) {
    const gap = u.childGap && u.childGap >= 1 ? u.childGap : 1;
    const kids = [...u.children, ...(u.adoptedChildren ?? [])].filter(k => known.has(k));
    for (const p of u.partners) {
      if (!known.has(p)) continue;
      const gp = find(p);
      for (const k of kids) {
        const gk = find(k);
        if (gp === gk) continue; // an ancestor-marriage would loop; skip the self-edge
        const key = `${gp}>${gk}:${gap}`;
        if (edgeSeen.has(key)) continue;
        edgeSeen.add(key);
        down.push({ a: gp, b: gk, d: gap });
      }
    }
  }

  // --- weakly-connected components over the group graph -----------------------
  const cparent = new Map<string, string>();
  for (const p of people) { const g = find(p.id); if (!cparent.has(g)) cparent.set(g, g); }
  const cfind = (x: string): string => {
    let r = x;
    while (cparent.get(r) !== r) r = cparent.get(r)!;
    while (cparent.get(x) !== r) { const n = cparent.get(x)!; cparent.set(x, r); x = n; }
    return r;
  };
  for (const e of down) {
    const ra = cfind(e.a), rb = cfind(e.b);
    if (ra !== rb) cparent.set(ra, rb);
  }

  // --- longest-path leveling with per-person floors. A person's `genAnchor` is an
  //     absolute generation FLOOR: their group starts there instead of at 0. That is
  //     how a parentless founder with no ancestry in the tree (a bride-giving king who
  //     only touches the tree through a daughter's marriage, an isolated clan) is set
  //     level with its story-contemporaries. Everyone else starts at 0 and is pushed
  //     below their parents. The graph is acyclic, so it settles fast and never inflates
  //     -- and Brahma, alone in having neither a parent nor an anchor, is the only node
  //     left at 0, with all lineages beneath him.
  const anchorOf = new Map<string, number>(); // group -> highest anchor among its members
  for (const p of people) {
    if (typeof p.genAnchor !== 'number') continue;
    const g = find(p.id);
    anchorOf.set(g, Math.max(anchorOf.get(g) ?? -Infinity, p.genAnchor));
  }
  const genG = new Map<string, number>();
  for (const g of cparent.keys()) genG.set(g, anchorOf.get(g) ?? 0);
  const maxPass = genG.size + 1; // Bellman-Ford bound; an acyclic pass settles far sooner
  for (let pass = 0; pass < maxPass; pass++) {
    let changed = false;
    for (const e of down) {
      const cand = genG.get(e.a)! + e.d;
      if (cand > genG.get(e.b)!) { genG.set(e.b, cand); changed = true; }
    }
    if (!changed) break;
  }

  // --- project groups back onto people, number components in person order -----
  const gen = new Map<string, number>();
  const componentOf = new Map<string, number>();
  const compId = new Map<string, number>();
  let nc = 0;
  for (const p of people) {
    const g = find(p.id);
    gen.set(p.id, genG.get(g) ?? 0);
    const cr = cfind(g);
    if (!compId.has(cr)) compId.set(cr, nc++);
    componentOf.set(p.id, compId.get(cr)!);
  }

  // Bottom-align only the components that carry NO anchor: line their youngest
  // generation up with the deepest point in the data so contemporaries in unrelated
  // lineages share a level. Anchored components sit where their floors put them; a
  // component whose sources are all at 0 (e.g. a real family tree) is unaffected.
  const anchoredComp = new Set<number>();
  for (const p of people) {
    if (typeof p.genAnchor === 'number') anchoredComp.add(componentOf.get(p.id)!);
  }
  const compMax = new Map<number, number>();
  for (const [id, comp] of componentOf) {
    compMax.set(comp, Math.max(compMax.get(comp) ?? -Infinity, gen.get(id)!));
  }
  const globalMax = Math.max(...compMax.values());
  for (const [id, comp] of componentOf) {
    if (anchoredComp.has(comp)) continue;
    const shift = globalMax - (compMax.get(comp) ?? globalMax);
    if (shift) gen.set(id, gen.get(id)! + shift);
  }

  // Devas are free agents: their divine parentage never entered the leveling
  // above (no edges were added for it), so it can never shift a mortal's
  // generation. Here we simply *display* each deva one level above its earliest
  // divine child, and fold it into that child's component so it isn't a stray
  // island. A deva with no divineParent role (e.g. an ancestor merely flagged
  // divine, like Chandra Deva) keeps its own leveled generation.
  const rooted = new Set<string>();
  for (const u of unions) {
    for (const p of u.partners) rooted.add(p);
    for (const k of [...u.children, ...(u.adoptedChildren ?? [])]) rooted.add(k);
  }
  const divineChildrenOf = new Map<string, string[]>();
  for (const p of people) {
    for (const dp of p.divineParents ?? []) {
      if (!known.has(dp)) continue;
      const list = divineChildrenOf.get(dp);
      if (list) list.push(p.id);
      else divineChildrenOf.set(dp, [p.id]);
    }
  }
  // A deva belongs to NO generation. We display it half a level above its earliest
  // divine child — floating *between* the child's generation and the parent
  // generation — so it never sits on any mortal tier. Several passes so a deva
  // whose child is itself a deva still settles regardless of iteration order.
  for (let pass = 0; pass < 8; pass++) {
    let changed = false;
    for (const [deva, kids] of divineChildrenOf) {
      // A deva that is ALSO a rooted ancestor (has real union links, e.g. Surya as
      // the solar progenitor who ALSO fathers Karna an age later) keeps its rooted
      // spot; its ray to the late-born child simply runs long, across the eras.
      if (rooted.has(deva)) continue;
      const childGens = kids
        .map(k => gen.get(k))
        .filter((g): g is number => g !== undefined);
      if (!childGens.length) continue;
      const ng = Math.min(...childGens) - 0.5;
      if (gen.get(deva) !== ng) {
        gen.set(deva, ng);
        changed = true;
      }
      const kidComp = componentOf.get(kids[0]);
      if (kidComp !== undefined) componentOf.set(deva, kidComp);
    }
    if (!changed) break;
  }

  return { gen, componentOf };
};
