import { customAlphabet } from 'nanoid';
import type { FamilyDataV2 } from './types';

const nano = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);

const takenIds = (raw: FamilyDataV2): Set<string> => {
  const s = new Set<string>();
  raw.people.forEach(p => s.add(p.id));
  raw.unions.forEach(u => s.add(u.id));
  Object.keys(raw.families).forEach(f => s.add(f));
  return s;
};

const fresh = (prefix: string, taken: Set<string>): string => {
  let id = `${prefix}_${nano()}`;
  while (taken.has(id)) id = `${prefix}_${nano()}`;
  return id;
};

/**
 * Readable person id from the first name so the JSON stays legible: "Ramesh",
 * then "Ramesh_1", "Ramesh_2", … on collision. Falls back to a nanoid only if
 * the name has no usable characters.
 */
export const newPersonId = (raw: FamilyDataV2, firstName: string): string => {
  const taken = takenIds(raw);
  const base = firstName.replace(/[^a-zA-Z0-9]/g, '');
  if (!base) return fresh('p', taken);
  if (!taken.has(base)) return base;
  let n = 1;
  while (taken.has(`${base}_${n}`)) n++;
  return `${base}_${n}`;
};

/** Readable union id from its partners: "u_ramesh_sita", disambiguated on clash. */
export const newUnionId = (raw: FamilyDataV2, partnerIds: string[] = []): string => {
  const taken = takenIds(raw);
  const slug = partnerIds
    .map(p => p.replace(/[^a-zA-Z0-9]/g, '').toLowerCase())
    .filter(Boolean)
    .join('_');
  if (!slug) return fresh('u', taken);
  const base = `u_${slug}`;
  if (!taken.has(base)) return base;
  let n = 1;
  while (taken.has(`${base}_${n}`)) n++;
  return `${base}_${n}`;
};
export const newFamilyId = (raw: FamilyDataV2, name: string): string => {
  const taken = takenIds(raw);
  const cleaned = name.replace(/[^a-zA-Z0-9]/g, '');
  if (!cleaned) return fresh('f', taken);
  // Readable, and stable across same-named lineages: familyPandya, familyPandya_1, …
  const base = `family${cleaned}`;
  if (!taken.has(base)) return base;
  let n = 1;
  while (taken.has(`${base}_${n}`)) n++;
  return `${base}_${n}`;
};
