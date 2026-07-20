import type { PersonRecord, UnionRecord } from './types';

export interface GenerationResult {
  gen: Map<string, number>;
  componentOf: Map<string, number>;
}

/**
 * Assign a generation number to every person: partners share a generation,
 * children (biological and adopted) are one below their union's partners.
 * BFS with edge deltas per connected component; each component is normalized
 * so its topmost generation is 0. Deterministic given input order.
 */
export const computeGenerations = (
  people: PersonRecord[],
  unions: UnionRecord[],
): GenerationResult => {
  const known = new Set(people.map(p => p.id));
  const adj = new Map<string, { to: string; delta: number }[]>();
  const addEdge = (a: string, b: string, delta: number) => {
    if (!known.has(a) || !known.has(b)) return;
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a)!.push({ to: b, delta });
    adj.get(b)!.push({ to: a, delta: -delta });
  };

  for (const u of unions) {
    if (u.partners.length === 2) addEdge(u.partners[0], u.partners[1], 0);
    const kids = [...u.children, ...(u.adoptedChildren ?? [])];
    for (const p of u.partners) {
      for (const k of kids) addEdge(p, k, 1);
    }
  }

  const gen = new Map<string, number>();
  const componentOf = new Map<string, number>();
  let comp = 0;

  for (const person of people) {
    if (gen.has(person.id)) continue;
    const members: string[] = [];
    const queue: string[] = [person.id];
    gen.set(person.id, 0);
    componentOf.set(person.id, comp);
    members.push(person.id);
    let head = 0;
    while (head < queue.length) {
      const cur = queue[head++];
      const g = gen.get(cur)!;
      for (const { to, delta } of adj.get(cur) ?? []) {
        if (!gen.has(to)) {
          gen.set(to, g + delta);
          componentOf.set(to, comp);
          members.push(to);
          queue.push(to);
        }
      }
    }
    const min = Math.min(...members.map(id => gen.get(id)!));
    if (min !== 0) for (const id of members) gen.set(id, gen.get(id)! - min);
    comp++;
  }

  // Bottom-align disconnected components: line up their YOUNGEST generation (each
  // separate tree's "present day") rather than their oldest, so contemporaries in
  // unrelated lineages — Rama, Ravana, Vali, Hanuman — sit on the same level. A
  // single connected component (Mahabharat, my family) is unaffected.
  const compMax = new Map<number, number>();
  for (const [id, comp] of componentOf) {
    compMax.set(comp, Math.max(compMax.get(comp) ?? -Infinity, gen.get(id)!));
  }
  const globalMax = Math.max(...compMax.values());
  for (const [id, comp] of componentOf) {
    const shift = globalMax - (compMax.get(comp) ?? globalMax);
    if (shift) gen.set(id, gen.get(id)! + shift);
  }

  // Devas are free agents: their divine parentage never entered the leveling
  // above (no edges were added for it), so it can never shift a mortal's
  // generation. Here we simply *display* each deva one level above its earliest
  // divine child, and fold it into that child's component so it isn't a stray
  // island. A deva with no divineParent role (e.g. an ancestor merely flagged
  // divine, like Chandra Deva) keeps its own leveled generation.
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
