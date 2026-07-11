import type { Dataset, KinStep } from './types';
import { personName } from './types';

interface Neighbor {
  to: string;
  dir: 'up' | 'down' | 'side';
  tag?: 'biological' | 'adoptive';
  status?: 'married' | 'divorced' | 'partners' | 'unknown';
}

const neighborsOf = (ds: Dataset, id: string): Neighbor[] => {
  const out: Neighbor[] = [];
  for (const p of ds.parentsOf.get(id) ?? []) out.push({ to: p.id, dir: 'up', tag: p.tag });
  for (const c of ds.childrenOf.get(id) ?? []) out.push({ to: c.id, dir: 'down', tag: c.tag });
  for (const s of ds.spousesOf.get(id) ?? []) out.push({ to: s.id, dir: 'side', status: s.status });
  return out;
};

/** BFS shortest kinship path from a to b (all edges weight 1, deterministic ties). */
export const shortestKinPath = (ds: Dataset, a: string, b: string): KinStep[] | null => {
  if (a === b) return [];
  if (!ds.people.has(a) || !ds.people.has(b)) return null;
  const prev = new Map<string, KinStep>();
  const queue: string[] = [a];
  const seen = new Set([a]);
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++];
    for (const n of neighborsOf(ds, cur)) {
      if (seen.has(n.to)) continue;
      seen.add(n.to);
      prev.set(n.to, { from: cur, to: n.to, dir: n.dir, tag: n.tag, status: n.status });
      if (n.to === b) {
        const steps: KinStep[] = [];
        let at = b;
        while (at !== a) {
          const step = prev.get(at)!;
          steps.unshift(step);
          at = step.from;
        }
        return steps;
      }
      queue.push(n.to);
    }
  }
  return null;
};

const genderWord = (
  ds: Dataset,
  id: string,
  male: string,
  female: string,
): string => (ds.people.get(id)?.gender === 'female' ? female : male);

const sideWord = (ds: Dataset, step: KinStep): string => {
  const base = genderWord(ds, step.to, 'husband', 'wife');
  if (step.status === 'divorced') return `ex-${base}`;
  if (step.status === 'partners') return 'partner';
  return base;
};

/** How two people arrived at the sibling relation: full, half, or adoptive. */
const siblingKind = (ds: Dataset, a: string, b: string, steps: KinStep[]): string => {
  if (steps.some(s => s.tag === 'adoptive')) return 'adoptive ';
  const ua = ds.childUnionOf.get(a)?.biological;
  const ub = ds.childUnionOf.get(b)?.biological;
  if (ua && ub && ua === ub) return '';
  return 'half-';
};

/**
 * Name the relationship of B relative to A ("B is A's ___") for common patterns,
 * with a readable hop chain as universal fallback.
 */
export const nameRelation = (
  ds: Dataset,
  a: string,
  steps: KinStep[],
): { name: string | null; chain: { personId: string; label: string }[] } => {
  const chain: { personId: string; label: string }[] = [
    { personId: a, label: personName(ds.people.get(a)!) },
  ];
  for (const s of steps) {
    const name = personName(ds.people.get(s.to)!);
    const word =
      s.dir === 'up'
        ? `${s.tag === 'adoptive' ? 'adoptive ' : ''}${genderWord(ds, s.to, 'father', 'mother')}`
        : s.dir === 'down'
          ? `${s.tag === 'adoptive' ? 'adopted ' : ''}${genderWord(ds, s.to, 'son', 'daughter')}`
          : sideWord(ds, s);
    chain.push({ personId: s.to, label: `${word} ${name}` });
  }

  const dirs = steps.map(s => s.dir.charAt(0)).join('');
  const b = steps.length ? steps[steps.length - 1].to : a;
  const anyAdoptive = steps.some(s => s.tag === 'adoptive');
  const adoptPrefixUp = anyAdoptive ? 'adoptive ' : '';
  const adoptPrefixDown = anyAdoptive ? 'adopted ' : '';
  const g = (male: string, female: string) => genderWord(ds, b, male, female);
  // Paternal/maternal is decided by the parent through whom the path climbs.
  const viaSide = () => genderWord(ds, steps[0].to, 'paternal', 'maternal');

  // Pure ancestral / descendant chains name themselves at any depth —
  // deep lineages are the norm here, not the exception.
  const greats = (n: number): string =>
    n === 3 ? 'great-' : n > 3 ? `${n - 2}× great-` : '';

  let name: string | null = null;
  if (/^u+$/.test(dirs) && dirs.length >= 2) {
    const side = dirs.length === 2 ? `${viaSide()} ` : '';
    name = `${adoptPrefixUp}${side}${greats(dirs.length)}${g('grandfather', 'grandmother')}`;
    return { name, chain };
  }
  if (/^d+$/.test(dirs) && dirs.length >= 2) {
    name = `${adoptPrefixDown}${greats(dirs.length)}grand${g('son', 'daughter')}`;
    return { name, chain };
  }
  switch (dirs) {
    case '':
      name = 'the same person';
      break;
    case 'u':
      name = `${adoptPrefixUp}${g('father', 'mother')}`;
      break;
    case 'd':
      name = `${adoptPrefixDown}${g('son', 'daughter')}`;
      break;
    case 'ud':
      name = `${siblingKind(ds, a, b, steps)}${g('brother', 'sister')}`;
      break;
    case 's':
      name = sideWord(ds, steps[0]);
      break;
    case 'uud':
      name = `${viaSide()} ${g('uncle', 'aunt')}`;
      break;
    case 'uudd':
      name = 'first cousin';
      break;
    case 'udd':
      name = `${g('nephew', 'niece')}`;
      break;
    case 'su':
      name = `${g('father', 'mother')}-in-law`;
      break;
    case 'ds':
      name = `${g('son', 'daughter')}-in-law`;
      break;
    case 'uds':
    case 'sud':
      name = `${g('brother', 'sister')}-in-law`;
      break;
    case 'us':
      name = `step${g('father', 'mother')}`;
      break;
    case 'sd':
      name = `step${g('son', 'daughter')}`;
      break;
    case 'uuds':
      name = `${g('uncle', 'aunt')} by marriage`;
      break;
  }

  return { name, chain };
};
