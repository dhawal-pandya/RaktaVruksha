/**
 * Rewrite the nanoid-style ids (p_xxxx, u_xxxx, f_xxxx) that the app minted for
 * on-graph additions into readable ones, so family-data.json stays legible:
 *   - people  → first name, then First_1, First_2 … on collision
 *   - unions  → u_<partner ids>, disambiguated on collision
 *   - families→ family<Name>, then family<Name>_1 … on collision
 * Every reference (partners, children, adoptedChildren, birthFamilyId, familyId)
 * is updated to match. Idempotent — already-readable ids are left alone.
 *
 * Run: npm run rename-ids
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FamilyDataV2 } from '../src/core/types';
import { validateData } from '../src/core/validate';

const here = dirname(fileURLToPath(import.meta.url));
const PATH = resolve(here, '../public/family-data.json');
const data: FamilyDataV2 = JSON.parse(readFileSync(PATH, 'utf8'));

const uglyPerson = (id: string) => /^p_[a-z0-9]{6,}$/.test(id);
const uglyFamily = (id: string) => /^f_[a-z0-9]{6,}$/.test(id);
const clean = (s: string) => s.replace(/[^a-zA-Z0-9]/g, '');

const taken = new Set<string>();
const uniq = (base: string): string => {
  if (!taken.has(base)) {
    taken.add(base);
    return base;
  }
  let n = 1;
  while (taken.has(`${base}_${n}`)) n++;
  const id = `${base}_${n}`;
  taken.add(id);
  return id;
};

// Reserve ids that stay (readable people + readable families). Unions are all
// regenerated from partners, so we don't reserve the old union ids.
for (const p of data.people) if (!uglyPerson(p.id)) taken.add(p.id);
for (const fid of Object.keys(data.families)) if (!uglyFamily(fid)) taken.add(fid);

const personMap = new Map<string, string>();
for (const p of data.people) {
  personMap.set(p.id, uglyPerson(p.id) ? uniq(clean(p.firstName) || 'person') : p.id);
}

const familyMap = new Map<string, string>();
for (const [fid, fam] of Object.entries(data.families)) {
  familyMap.set(fid, uglyFamily(fid) ? uniq(`family${clean(fam.name)}`) : fid);
}

const unionMap = new Map<string, string>();
for (const u of data.unions) {
  const slug = u.partners
    .map(p => (personMap.get(p) ?? p).toLowerCase())
    .filter(Boolean)
    .join('_');
  unionMap.set(u.id, uniq(slug ? `u_${slug}` : 'u_union'));
}

const mapFam = (fid: string | null) => (fid == null ? null : familyMap.get(fid) ?? fid);
const mapPerson = (pid: string) => personMap.get(pid) ?? pid;

const next: FamilyDataV2 = {
  meta: data.meta,
  families: Object.fromEntries(
    Object.entries(data.families).map(([fid, fam]) => [familyMap.get(fid) ?? fid, fam]),
  ),
  people: data.people.map(p => ({ ...p, id: mapPerson(p.id), birthFamilyId: mapFam(p.birthFamilyId) })),
  unions: data.unions.map(u => ({
    ...u,
    id: unionMap.get(u.id) ?? u.id,
    partners: u.partners.map(mapPerson),
    children: u.children.map(mapPerson),
    adoptedChildren: (u.adoptedChildren ?? []).map(mapPerson),
    familyId: mapFam(u.familyId),
  })),
};

const renamedP = [...personMap].filter(([a, b]) => a !== b);
const renamedF = [...familyMap].filter(([a, b]) => a !== b);
console.log('=== rename-ids ===');
console.log(`people renamed: ${renamedP.length}`);
renamedP.forEach(([a, b]) => console.log(`  ${a} → ${b}`));
console.log(`families renamed: ${renamedF.length}`);
renamedF.forEach(([a, b]) => console.log(`  ${a} → ${b}`));
console.log(`unions renamed: ${[...unionMap].filter(([a, b]) => a !== b).length}`);

const { errors, warnings } = validateData(next);
if (warnings.length) console.log(`warnings: ${warnings.length} (first: ${warnings[0]})`);
if (errors.length) {
  console.error(`ERRORS — not writing:`);
  errors.slice(0, 10).forEach(e => console.error('  ✗', e));
  process.exit(1);
}
writeFileSync(PATH, JSON.stringify(next, null, 2));
console.log(`✓ wrote ${PATH}`);
