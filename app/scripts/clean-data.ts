/**
 * Data hygiene pass: collapse "unknown lineage" placeholder families to null.
 *
 * In v1, when a person (usually a spouse who married in) had an unknown birth
 * family, a throwaway family was invented with a numeric suffix: familyShah2,
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
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { FamilyDataV2 } from "../src/core/types";
import { validateData } from "../src/core/validate";

const here = dirname(fileURLToPath(import.meta.url));
const PATH = resolve(here, "../public/family-data.json");

const data: FamilyDataV2 = JSON.parse(readFileSync(PATH, "utf8"));

// v1 placeholders end in a bare digit (familyShah2, familyPandyaU1). The readable-id
// scheme's "_N" disambiguators (familyPandya_1) are legitimate lineages, not placeholders.
const isPlaceholder = (familyId: string): boolean =>
  /\d$/.test(familyId) && !/_\d+$/.test(familyId);
const placeholders = Object.keys(data.families).filter(isPlaceholder);

const now = new Date().toISOString();
const changes: string[] = [];

for (const fid of placeholders) {
  const name = data.families[fid].name;
  for (const p of data.people) {
    if (p.birthFamilyId === fid) {
      p.birthFamilyId = null;
      p.updatedAt = now;
      changes.push(
        `${p.firstName} ${p.lastName}: birth family ${name} → unknown lineage`,
      );
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

// Reconcile union.familyId with its children: if every biological child agrees on a
// birth family that differs from the union's, trust the children (the user set each
// child's family explicitly) and fix the union. This repairs son-in-law marriages
// where the union kept the wrong family.
const familyName = (fid: string | null) =>
  fid ? (data.families[fid]?.name ?? fid) : "unknown";
for (const u of data.unions) {
  if (u.children.length === 0) continue;
  const childFamilies = new Set(
    u.children.map(
      (cid) => data.people.find((p) => p.id === cid)?.birthFamilyId ?? null,
    ),
  );
  if (childFamilies.size !== 1) continue; // children disagree: leave it for a human
  const target = [...childFamilies][0];
  if (target !== u.familyId) {
    changes.push(
      `union ${u.id}: familyId ${familyName(u.familyId)} → ${familyName(target)} (from children)`,
    );
    u.familyId = target;
    u.updatedAt = now;
  }
}

data.meta.exportedAt = now;

const { errors, warnings } = validateData(data);
console.log(`=== data cleanup ===`);
console.log(
  `placeholder families removed (${placeholders.length}): ${placeholders.join(", ")}`,
);
changes.forEach((c) => console.log("  •", c));
if (warnings.length) {
  console.log(`\nwarnings (${warnings.length}):`);
  warnings.forEach((w) => console.log("  !", w));
}
if (errors.length) {
  console.error(`\nERRORS (${errors.length}): not writing:`);
  errors.forEach((e) => console.error("  ✗", e));
  process.exit(1);
}
writeFileSync(PATH, JSON.stringify(data, null, 2));
console.log(`\n✓ wrote ${PATH}`);
