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

export const newPersonId = (raw: FamilyDataV2): string => fresh('p', takenIds(raw));
export const newUnionId = (raw: FamilyDataV2): string => fresh('u', takenIds(raw));
export const newFamilyId = (raw: FamilyDataV2, name: string): string => {
  const slug = 'family' + name.replace(/[^a-zA-Z0-9]/g, '');
  const taken = takenIds(raw);
  if (!taken.has(slug) && !(slug in raw.families)) return slug;
  return fresh('f', taken);
};
