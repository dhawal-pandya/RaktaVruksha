/**
 * Data hygiene pass: collapse "unknown lineage" placeholder families to null.
 *
 * In v1, when a person (usually a spouse who married in) had an unknown birth
 * family, a throwaway family was invented with a numeric suffix — familyShah2,
 * familyPatel2, familyPandyaU1. Those aren't real families; they're unknowns.
 * Every genuine family id is a pure surname, so "id ends in a digit" cleanly
 * identifies the placeholders and nothing else.
 *
 * For each placeholder family: null the birthFamilyId of anyone born into it,
 * repoint any union.familyId that used it to null, then delete the family.
 * The person's married-into history is untouched (it lives on their unions).
 *
 * Run: npm run clean
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FamilyDataV2 } from '../src/core/types';
import { validateData } from '../src/core/validate';

const here = dirname(fileURLToPath(import.meta.url));
const PATH = resolve(here, '../public/family-data.json');

const data: FamilyDataV2 = JSON.parse(readFileSync(PATH, 'utf8'));

const isPlaceholder = (familyId: string): boolean => /\d$/.test(familyId);
const placeholders = Object.keys(data.families).filter(isPlaceholder);

if (placeholders.length === 0) {
  console.log('No placeholder families found — data already clean.');
  process.exit(0);
}

const now = new Date().toISOString();
const changes: string[] = [];

for (const fid of placeholders) {
  const name = data.families[fid].name;
  for (const p of data.people) {
    if (p.birthFamilyId === fid) {
      p.birthFamilyId = null;
      p.updatedAt = now;
      changes.push(`${p.firstName} ${p.lastName}: birth family ${name} → unknown lineage`);
    }
  }
  for (const u of data.unions) {
    if (u.familyId === fid) {
      u.familyId = null;
      u.updatedAt = now;
      changes.push(`union ${u.id}: familyId ${name} → null`);
    }
  }
  delete data.families[fid];
}

data.meta.exportedAt = now;

const { errors, warnings } = validateData(data);
console.log(`=== data cleanup ===`);
console.log(`placeholder families removed (${placeholders.length}): ${placeholders.join(', ')}`);
changes.forEach(c => console.log('  •', c));
if (warnings.length) {
  console.log(`\nwarnings (${warnings.length}):`);
  warnings.forEach(w => console.log('  !', w));
}
if (errors.length) {
  console.error(`\nERRORS (${errors.length}) — not writing:`);
  errors.forEach(e => console.error('  ✗', e));
  process.exit(1);
}
writeFileSync(PATH, JSON.stringify(data, null, 2));
console.log(`\n✓ wrote ${PATH}`);
