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

  return { gen, componentOf };
};
