/**
 * One-time migration: v1 family-data.json (redundant parents/spouses/children,
 * unknown_* shorthands, familyUnknown sentinels) → clean v2 (union-based).
 *
 * The v1 file is known-dirty. Policy:
 *  - any parent/spouse reference that doesn't resolve to a real person record
 *    (unknown_*, typos, whatever) is treated as "unknown" and dropped;
 *  - `familyUnknown` / missing family ids become null (unknown lineage);
 *  - when `parents` and `children` disagree, `parents` wins;
 *  - every normalization is printed so the result can be audited.
 *
 * Run: npm run migrate
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FamilyDataV2, PersonRecord, UnionRecord, UnionStatus } from '../src/core/types';
import { validateData } from '../src/core/validate';

interface V1Person {
  id: string;
  first_name: string;
  last_name: string;
  alive: boolean;
  gender: 'male' | 'female';
  parents?: string[];
  spouses?: string[];
  children?: string[];
  birth_family_id: string;
  current_family_id: string;
}

interface V1Data {
  families?: Record<string, { color: string }>;
  people: V1Person[];
}

const here = dirname(fileURLToPath(import.meta.url));
const V1_PATH = resolve(here, '../../raktavruksha-frontend/public/family-data.json');
const OUT_PATH = resolve(here, '../public/family-data.json');

const UNKNOWN_FAMILY = 'familyUnknown';
const notes: string[] = [];

const v1: V1Data = JSON.parse(readFileSync(V1_PATH, 'utf8'));
const realPeople = v1.people.filter(p => !p.id.startsWith('unknown_'));
const knownIds = new Set(realPeople.map(p => p.id));

const cleanFamily = (id: string | undefined | null): string | null =>
  !id || id === UNKNOWN_FAMILY ? null : id;

/** Resolve a v1 reference list to real people; report what was dropped. */
const resolveRefs = (owner: string, kind: string, refs: string[] | undefined): string[] => {
  const out: string[] = [];
  for (const ref of refs ?? []) {
    if (knownIds.has(ref)) out.push(ref);
    else notes.push(`${owner}: dropped unresolvable ${kind} ref "${ref}"`);
  }
  return out;
};

// --- People -----------------------------------------------------------------
const stamp = new Date().toISOString();
const people: PersonRecord[] = realPeople.map(p => ({
  id: p.id,
  firstName: p.first_name,
  lastName: p.last_name,
  gender: p.gender,
  alive: p.alive,
  birthFamilyId: cleanFamily(p.birth_family_id),
  updatedAt: stamp,
}));
const personById = new Map(people.map(p => [p.id, p]));
const v1ById = new Map(realPeople.map(p => [p.id, p]));

// --- Unions from parent links (trusting `parents`, not `children`) -----------
interface Draft {
  partners: string[];
  children: string[];
  status: UnionStatus;
}
const drafts = new Map<string, Draft>();
const draftKey = (partners: string[]) => [...partners].sort().join('|');

for (const p of realPeople) {
  const parents = resolveRefs(p.id, 'parent', p.parents);
  if (parents.length === 0) continue; // orphan / unknown lineage — no union
  const key = draftKey(parents);
  if (!drafts.has(key)) drafts.set(key, { partners: [...parents].sort(), children: [], status: 'married' });
  drafts.get(key)!.children.push(p.id);
}

// --- Childless spouse pairs -------------------------------------------------
for (const p of realPeople) {
  for (const sp of resolveRefs(p.id, 'spouse', p.spouses)) {
    if (p.id >= sp) continue; // each pair once
    const key = draftKey([p.id, sp]);
    if (!drafts.has(key)) drafts.set(key, { partners: [p.id, sp].sort(), children: [], status: 'married' });
  }
}

// --- familyId per union -----------------------------------------------------
const unions: UnionRecord[] = [];
for (const [key, d] of [...drafts.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
  let familyId: string | null = null;
  const childFams = [...new Set(d.children.map(c => personById.get(c)!.birthFamilyId))];
  if (childFams.length > 0) {
    familyId = childFams[0];
    if (childFams.length > 1) {
      notes.push(`union (${key}): children born into mixed families [${childFams.join(', ')}]; using "${familyId}"`);
    }
  } else {
    // Childless: the partner who "moved" tells us the union's family.
    for (const pid of d.partners) {
      const v1p = v1ById.get(pid)!;
      const cur = cleanFamily(v1p.current_family_id);
      if (cur && cur !== cleanFamily(v1p.birth_family_id)) {
        familyId = cur;
        break;
      }
    }
    if (!familyId) familyId = cleanFamily(v1ById.get(d.partners[0])!.birth_family_id);
  }
  unions.push({
    id: `u_${d.partners.join('_')}`.toLowerCase(),
    partners: d.partners,
    children: d.children,
    adoptedChildren: [],
    familyId,
    status: d.partners.length === 2 ? d.status : 'unknown',
    updatedAt: stamp,
  });
}

// Reconcile: biological children must carry their union's familyId.
for (const u of unions) {
  for (const cid of u.children) {
    const child = personById.get(cid)!;
    if (child.birthFamilyId !== u.familyId) {
      notes.push(`${cid}: birthFamilyId "${child.birthFamilyId}" → "${u.familyId}" (from parent union)`);
      child.birthFamilyId = u.familyId;
    }
  }
}

// --- Families ----------------------------------------------------------------
const families: FamilyDataV2['families'] = {};
const referenced = new Set<string>();
people.forEach(p => p.birthFamilyId && referenced.add(p.birthFamilyId));
unions.forEach(u => u.familyId && referenced.add(u.familyId));
const PALETTE = ['#e74c3c', '#3498db', '#2ecc71', '#9b59b6', '#f39c12', '#1abc9c', '#e67e22', '#34495e', '#d35400', '#16a085', '#8e44ad', '#c0392b', '#27ae60'];
let colorIdx = 0;
for (const fid of [...referenced].sort()) {
  const v1color = v1.families?.[fid]?.color;
  families[fid] = {
    name: fid.replace(/^family/, ''),
    color: v1color ?? PALETTE[colorIdx++ % PALETTE.length],
  };
  if (!v1color) notes.push(`family "${fid}": no v1 color, assigned ${families[fid].color}`);
}

// --- Emit + validate ----------------------------------------------------------
const out: FamilyDataV2 = {
  meta: { schemaVersion: 2, exportedAt: stamp },
  families,
  people,
  unions,
};

const { errors, warnings } = validateData(out);
console.log('=== migration summary ===');
console.log(`people:   ${v1.people.length} in → ${people.length} out (dropped ${v1.people.length - people.length} placeholders)`);
console.log(`unions:   ${unions.length} created (${unions.filter(u => u.partners.length === 1).length} single-parent)`);
console.log(`families: ${Object.keys(families).length}`);
if (notes.length) {
  console.log(`\n--- normalizations (${notes.length}) ---`);
  notes.forEach(n => console.log('  •', n));
}
if (warnings.length) {
  console.log(`\n--- validator warnings (${warnings.length}) ---`);
  warnings.forEach(w => console.log('  !', w));
}
if (errors.length) {
  console.error(`\n--- validator ERRORS (${errors.length}) ---`);
  errors.forEach(e => console.error('  ✗', e));
  process.exit(1);
}
writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));
console.log(`\n✓ wrote ${OUT_PATH}`);
