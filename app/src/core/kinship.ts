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

// --- Sanskrit (Gujarati) kinship terms -------------------------------------
// Transliterated to Latin script. `localRelation` returns "sanskrit (gujarati)"
// for the relations we have confidently verified (see research notes), and null
// otherwise so the caller falls back to the plain-English name. The Sanskrit/
// Gujarati systems encode distinctions English lacks — paternal vs maternal
// (dada vs nana, kaka vs mama), son's-side vs daughter's-side grandchildren
// (pautra vs dauhitra), brother's vs sister's nephews (bhatrijo vs bhanej) —
// and the engine already has the data to make them.
const sg = (sanskrit: string, gujarati: string): string => `${sanskrit} (${gujarati})`;
const isMale = (ds: Dataset, id: string): boolean =>
  ds.people.get(id)?.gender !== 'female';

const localRelation = (ds: Dataset, a: string, steps: KinStep[]): string | null => {
  if (steps.length === 0) return null;
  const dirs = steps.map(s => s.dir.charAt(0)).join('');
  const b = steps[steps.length - 1].to;
  const bMale = isMale(ds, b);
  const anyAdoptive = steps.some(s => s.tag === 'adoptive');
  const preS = (n: number) => 'pra-'.repeat(n); // Sanskrit "great-" prefix
  const preG = (n: number) => 'par-'.repeat(n); // Gujarati "great-" prefix
  // The first hop's parent decides the paternal/maternal side.
  const paternal = isMale(ds, steps[0].to);

  // Ancestors: father → grandparent → great-grandparent, keeping the side at every depth.
  if (/^u+$/.test(dirs) && dirs.length >= 2) {
    const g = dirs.length - 2;
    const san = (paternal ? (bMale ? 'pitamaha' : 'pitamahi') : bMale ? 'matamaha' : 'matamahi');
    const guj = (paternal ? (bMale ? 'dada' : 'dadi') : bMale ? 'nana' : 'nani');
    return (anyAdoptive ? 'adoptive ' : '') + sg(preS(g) + san, preG(g) + guj);
  }
  // Descendants: at grandchild depth, split son's line (pautra) vs daughter's line
  // (dauhitra); deeper generations use the generic pra-/par- pautra chain.
  if (/^d+$/.test(dirs) && dirs.length >= 2) {
    const g = dirs.length - 2;
    const pre = anyAdoptive ? 'adopted ' : '';
    if (g === 0) {
      const viaSon = isMale(ds, steps[0].to);
      const san = viaSon ? (bMale ? 'pautra' : 'pautri') : bMale ? 'dauhitra' : 'dauhitri';
      const guj = viaSon ? (bMale ? 'pautra' : 'pautri') : bMale ? 'dohitro' : 'dohitri';
      return pre + sg(san, guj);
    }
    const tail = bMale ? 'pautra' : 'pautri';
    return pre + sg(preS(g) + tail, preG(g) + tail);
  }

  switch (dirs) {
    case 'u':
      return (anyAdoptive ? 'adoptive ' : '') + sg(bMale ? 'pita' : 'mata', bMale ? 'bapa' : 'ma');
    case 'd':
      return (anyAdoptive ? 'adopted ' : '') + sg(bMale ? 'putra' : 'putri', bMale ? 'dikro' : 'dikri');
    case 'ud': {
      const kind = siblingKind(ds, a, b, steps); // '', 'half-', or 'adoptive '
      // Full siblings share a union whose children are stored eldest-first, so their
      // positions give elder (agraja) vs younger (anuja) — B relative to A.
      if (kind === '') {
        const u = ds.childUnionOf.get(a)?.biological;
        const kids = u ? ds.unions.get(u)?.children ?? [] : [];
        const ia = kids.indexOf(a);
        const ib = kids.indexOf(b);
        if (ia >= 0 && ib >= 0) {
          return ib < ia
            ? sg(bMale ? 'agraj' : 'agraja', bMale ? 'moto bhai' : 'moti ben')
            : sg(bMale ? 'anuj' : 'anuja', bMale ? 'nano bhai' : 'nani ben');
        }
      }
      return kind + sg(bMale ? 'bhrata' : 'bhagini', bMale ? 'bhai' : 'ben');
    }
    case 's': {
      const st = steps[0].status;
      if (st === 'partners') return sg('sathi', 'sathi');
      const base = sg(bMale ? 'pati' : 'patni', bMale ? 'dhani' : 'bairi');
      return st === 'divorced' ? `ex-${base}` : base;
    }
    case 'uud':
      return paternal
        ? bMale ? sg('pitrivya', 'kaka') : sg('pitrusvasa', 'foi')
        : bMale ? sg('matula', 'mama') : sg('matrusvasa', 'masi');
    case 'udd': {
      const viaBrother = isMale(ds, steps[1].to);
      return viaBrother
        ? bMale ? sg('bhratrija', 'bhatrijo') : sg('bhratriji', 'bhatriji')
        : bMale ? sg('bhagineya', 'bhanej') : sg('bhagineyi', 'bhaneji');
    }
    case 'uudd':
      return paternal
        ? bMale ? sg('pitrivya-putra', 'pitarai bhai') : sg('pitrivya-putri', 'pitarai ben')
        : bMale ? sg('matula-putra', 'mameri bhai') : sg('matula-putri', 'mameri ben');
    case 'su':
      return sg(bMale ? 'shvashura' : 'shvashru', bMale ? 'sasro' : 'sasu');
    case 'ds':
      return sg(bMale ? 'jamata' : 'snusha', bMale ? 'jamai' : 'vahu');
    case 'uds':
    case 'sud':
      return bMale ? sg('shyala', 'salo') : sg('shyali', 'sali');
    default:
      return null; // step-relations, uncle-by-marriage, unnamed paths → English fallback
  }
};

/**
 * Name the relationship of B relative to A ("B is A's ___") for common patterns,
 * with a readable hop chain as universal fallback. `local` carries the Sanskrit
 * (Gujarati) term when we have one, else null.
 */
export const nameRelation = (
  ds: Dataset,
  a: string,
  steps: KinStep[],
): { name: string | null; local: string | null; chain: { personId: string; label: string }[] } => {
  const local = localRelation(ds, a, steps);
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
    return { name, local, chain };
  }
  if (/^d+$/.test(dirs) && dirs.length >= 2) {
    name = `${adoptPrefixDown}${greats(dirs.length)}grand${g('son', 'daughter')}`;
    return { name, local, chain };
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

  return { name, local, chain };
};
