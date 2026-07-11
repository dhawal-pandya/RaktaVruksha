/**
 * Deterministic synthetic dataset for performance testing: ~2,000 people across
 * ~40 families and 6 generations, with realistic mess — cross-family marriages,
 * divorces + remarriages, out-of-wedlock unions, single-parent gaps, adoptions.
 *
 * Run: npm run stress   → app/public/family-data.stress.json
 * View: http://localhost:5173/?data=stress
 */
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FamilyDataV2, PersonRecord, UnionRecord, UnionStatus } from '../src/core/types';
import { validateData } from '../src/core/validate';

const here = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(here, '../public/family-data.stress.json');

// mulberry32 — tiny seeded PRNG so the dataset is identical on every run
const rng = (() => {
  let a = 0x9e3779b9;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
})();
const pick = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];
const chance = (p: number): boolean => rng() < p;

const FAMILY_NAMES = [
  'Pandya', 'Thakar', 'Vyas', 'Shah', 'Patel', 'Joshi', 'Bhatt', 'Trivedi', 'Nayak', 'Jani',
  'Mehta', 'Desai', 'Dave', 'Raval', 'Vora', 'Gandhi', 'Parekh', 'Munshi', 'Kapadia', 'Dalal',
  'Choksi', 'Sanghvi', 'Doshi', 'Modi', 'Sheth', 'Zaveri', 'Kothari', 'Badami', 'Divan', 'Amin',
  'Naik', 'Rana', 'Solanki', 'Chauhan', 'Jadeja', 'Gohil', 'Parmar', 'Makwana', 'Rathod', 'Barot',
];
const MALE = ['Arjun', 'Dev', 'Kiran', 'Manav', 'Nirav', 'Parth', 'Rohan', 'Samir', 'Tejas', 'Uday', 'Varun', 'Yash', 'Amit', 'Bhavin', 'Chirag', 'Dhaval', 'Gaurav', 'Harsh', 'Jay', 'Kunal'];
const FEMALE = ['Aditi', 'Bhavna', 'Chhaya', 'Divya', 'Esha', 'Falguni', 'Gita', 'Hema', 'Isha', 'Jaya', 'Kavita', 'Lata', 'Meera', 'Nisha', 'Pooja', 'Rekha', 'Seema', 'Tara', 'Usha', 'Vidhi'];

const goldenAngleHue = (i: number) => Math.round((i * 137.508) % 360);
const familyColor = (i: number) => {
  const h = goldenAngleHue(i);
  return `hsl(${h}, 62%, 58%)`;
};

const stamp = new Date(0).toISOString();
const families: FamilyDataV2['families'] = {};
const familyIds = FAMILY_NAMES.map((name, i) => {
  const id = `family${name}`;
  families[id] = { name, color: familyColor(i) };
  return id;
});

const people: PersonRecord[] = [];
const unions: UnionRecord[] = [];
let seq = 0;

const makePerson = (gender: 'male' | 'female', familyId: string | null): PersonRecord => {
  const p: PersonRecord = {
    id: `p_${(seq++).toString(36).padStart(5, '0')}`,
    firstName: gender === 'male' ? pick(MALE) : pick(FEMALE),
    lastName: familyId ? families[familyId].name : pick(FAMILY_NAMES),
    gender,
    alive: true,
    birthFamilyId: familyId,
    updatedAt: stamp,
  };
  people.push(p);
  return p;
};

const makeUnion = (
  partners: string[],
  familyId: string | null,
  status: UnionStatus,
): UnionRecord => {
  const u: UnionRecord = {
    id: `u_${(seq++).toString(36).padStart(5, '0')}`,
    partners,
    children: [],
    adoptedChildren: [],
    familyId,
    status,
    updatedAt: stamp,
  };
  unions.push(u);
  return u;
};

// Generation 0: founder couple per family.
let currentUnions: UnionRecord[] = familyIds.map(fid => {
  const husband = makePerson('male', fid);
  const wife = makePerson('female', pick(familyIds.filter(f => f !== fid)));
  return makeUnion([husband.id, wife.id], fid, 'married');
});

const TARGET = 2000;
const MAX_GEN = 6;

for (let gen = 1; gen <= MAX_GEN && people.length < TARGET; gen++) {
  const nextUnions: UnionRecord[] = [];
  for (const parentUnion of currentUnions) {
    if (people.length >= TARGET) break;
    const nKids = 1 + Math.floor(rng() * 3); // 1-3 children
    for (let k = 0; k < nKids && people.length < TARGET; k++) {
      const child = makePerson(chance(0.5) ? 'male' : 'female', parentUnion.familyId);
      parentUnion.children.push(child.id);

      if (chance(0.06) && parentUnion.familyId) {
        // Adoption: this child is also raised by another family's childless union.
        const adopters = makeUnion(
          [
            makePerson('male', pick(familyIds)).id,
            makePerson('female', pick(familyIds)).id,
          ],
          pick(familyIds),
          'married',
        );
        adopters.adoptedChildren!.push(child.id);
      }

      if (gen < MAX_GEN && chance(0.62)) {
        // Marry: spouse born into a different family.
        const spouseFamily = pick(familyIds.filter(f => f !== parentUnion.familyId));
        const spouse = makePerson(child.gender === 'male' ? 'female' : 'male', spouseFamily);
        const intoFamily = child.gender === 'male' ? child.birthFamilyId : spouseFamily === child.birthFamilyId ? spouseFamily : spouse.birthFamilyId && chance(0.15) ? spouse.birthFamilyId : child.birthFamilyId;
        const status: UnionStatus = chance(0.05) ? 'divorced' : chance(0.04) ? 'partners' : 'married';
        const u = makeUnion([child.id, spouse.id], intoFamily, status);
        u.order = 1;
        nextUnions.push(u);

        if (status === 'divorced' && chance(0.7)) {
          // Remarriage into yet another family.
          const f2 = pick(familyIds.filter(f => f !== intoFamily));
          const spouse2 = makePerson(child.gender === 'male' ? 'female' : 'male', f2);
          const u2 = makeUnion([child.id, spouse2.id], child.gender === 'male' ? child.birthFamilyId : f2, 'married');
          u2.order = 2;
          nextUnions.push(u2);
        }
      } else if (gen < MAX_GEN && chance(0.06)) {
        // Single parent: other partner unknown.
        const u = makeUnion([child.id], child.birthFamilyId, 'unknown');
        nextUnions.push(u);
      }
    }
  }
  currentUnions = nextUnions;
}

const out: FamilyDataV2 = { meta: { schemaVersion: 2, exportedAt: stamp }, families, people, unions };
const { errors, warnings } = validateData(out);
console.log(`stress data: ${people.length} people, ${unions.length} unions, ${familyIds.length} families`);
console.log(`  divorced: ${unions.filter(u => u.status === 'divorced').length}, partners: ${unions.filter(u => u.status === 'partners').length}, single-parent: ${unions.filter(u => u.partners.length === 1).length}, adoptions: ${unions.reduce((n, u) => n + (u.adoptedChildren?.length ?? 0), 0)}`);
if (warnings.length) console.log(`  warnings: ${warnings.length} (first: ${warnings[0]})`);
if (errors.length) {
  errors.slice(0, 10).forEach(e => console.error('  ✗', e));
  process.exit(1);
}
writeFileSync(OUT_PATH, JSON.stringify(out));
console.log(`✓ wrote ${OUT_PATH}`);
