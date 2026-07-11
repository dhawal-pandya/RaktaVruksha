import type {
  Dataset,
  FamilyAffiliation,
  FamilyDataV2,
  RelRef,
  SpouseRef,
} from './types';
import { computeGenerations } from './generations';

const push = <T>(map: Map<string, T[]>, key: string, value: T) => {
  const arr = map.get(key);
  if (arr) arr.push(value);
  else map.set(key, [value]);
};

/** One O(n) pass over the raw file → every derived index the app needs. */
export const buildDataset = (raw: FamilyDataV2): Dataset => {
  const people = new Map(raw.people.map(p => [p.id, p]));
  const unions = new Map(raw.unions.map(u => [u.id, u]));

  const parentsOf = new Map<string, RelRef[]>();
  const childrenOf = new Map<string, RelRef[]>();
  const spousesOf = new Map<string, SpouseRef[]>();
  const unionsOf = new Map<string, string[]>();
  const childUnionOf = new Map<string, { biological?: string; adoptive?: string }>();
  const membersOfFamily = new Map<string, Set<string>>();

  const addMember = (familyId: string | null, personId: string) => {
    if (!familyId) return;
    if (!membersOfFamily.has(familyId)) membersOfFamily.set(familyId, new Set());
    membersOfFamily.get(familyId)!.add(personId);
  };

  for (const p of raw.people) addMember(p.birthFamilyId, p.id);

  for (const u of raw.unions) {
    const partners = u.partners.filter(id => people.has(id));
    const bioKids = u.children.filter(id => people.has(id));
    const adoptedKids = (u.adoptedChildren ?? []).filter(id => people.has(id));

    for (const pid of partners) {
      push(unionsOf, pid, u.id);
      addMember(u.familyId, pid);
    }
    if (partners.length === 2) {
      const [a, b] = partners;
      push(spousesOf, a, { id: b, unionId: u.id, status: u.status });
      push(spousesOf, b, { id: a, unionId: u.id, status: u.status });
    }
    for (const kid of bioKids) {
      const slot = childUnionOf.get(kid) ?? {};
      slot.biological = u.id;
      childUnionOf.set(kid, slot);
      for (const pid of partners) {
        push(parentsOf, kid, { id: pid, tag: 'biological' });
        push(childrenOf, pid, { id: kid, tag: 'biological' });
      }
    }
    for (const kid of adoptedKids) {
      const slot = childUnionOf.get(kid) ?? {};
      slot.adoptive = u.id;
      childUnionOf.set(kid, slot);
      addMember(u.familyId, kid);
      for (const pid of partners) {
        push(parentsOf, kid, { id: pid, tag: 'adoptive' });
        push(childrenOf, pid, { id: kid, tag: 'adoptive' });
      }
    }
  }

  // Family affiliation history per person: birth, adopted-into, then married-into in union order.
  const familiesOf = new Map<string, FamilyAffiliation[]>();
  for (const p of raw.people) {
    const affs: FamilyAffiliation[] = [];
    if (p.birthFamilyId) affs.push({ familyId: p.birthFamilyId, kind: 'birth' });
    const adoptiveUnionId = childUnionOf.get(p.id)?.adoptive;
    if (adoptiveUnionId) {
      const au = unions.get(adoptiveUnionId);
      if (au?.familyId && au.familyId !== p.birthFamilyId) {
        affs.push({ familyId: au.familyId, kind: 'adopted-into', unionId: au.id });
      }
    }
    const partnerUnions = (unionsOf.get(p.id) ?? [])
      .map(id => unions.get(id)!)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    for (const u of partnerUnions) {
      if (u.familyId && u.familyId !== p.birthFamilyId && !affs.some(a => a.familyId === u.familyId)) {
        affs.push({ familyId: u.familyId, kind: 'married-into', status: u.status, unionId: u.id });
      }
    }
    familiesOf.set(p.id, affs);
  }

  const { gen, componentOf } = computeGenerations(raw.people, raw.unions);

  return {
    raw,
    people,
    unions,
    parentsOf,
    childrenOf,
    spousesOf,
    unionsOf,
    childUnionOf,
    familiesOf,
    membersOfFamily,
    generations: gen,
    componentOf,
  };
};

/** The family whose color a person wears: birth lineage, else the family that adopted them. */
export const displayFamilyOf = (ds: Dataset, personId: string): string | null => {
  const p = ds.people.get(personId);
  if (!p) return null;
  if (p.birthFamilyId) return p.birthFamilyId;
  const adoptiveUnionId = ds.childUnionOf.get(personId)?.adoptive;
  if (adoptiveUnionId) return ds.unions.get(adoptiveUnionId)?.familyId ?? null;
  return null;
};
