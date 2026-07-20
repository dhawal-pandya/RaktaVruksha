import type {
  Dataset,
  FamilyAffiliation,
  FamilyDataV2,
  FamilyLabel,
  PersonRecord,
  RelRef,
  SpouseRef,
} from "./types";
import { computeGenerations } from "./generations";

const push = <T>(map: Map<string, T[]>, key: string, value: T) => {
  const arr = map.get(key);
  if (arr) arr.push(value);
  else map.set(key, [value]);
};

/** One O(n) pass over the raw file → every derived index the app needs. */
export const buildDataset = (raw: FamilyDataV2): Dataset => {
  const people = new Map(raw.people.map((p) => [p.id, p]));
  const unions = new Map(raw.unions.map((u) => [u.id, u]));

  const parentsOf = new Map<string, RelRef[]>();
  const childrenOf = new Map<string, RelRef[]>();
  const spousesOf = new Map<string, SpouseRef[]>();
  const unionsOf = new Map<string, string[]>();
  const childUnionOf = new Map<
    string,
    { biological?: string; adoptive?: string }
  >();
  const membersOfFamily = new Map<string, Set<string>>();

  const addMember = (familyId: string | null, personId: string) => {
    if (!familyId) return;
    if (!membersOfFamily.has(familyId))
      membersOfFamily.set(familyId, new Set());
    membersOfFamily.get(familyId)!.add(personId);
  };

  for (const p of raw.people) addMember(p.birthFamilyId, p.id);

  for (const u of raw.unions) {
    const partners = u.partners.filter((id) => people.has(id));
    const bioKids = u.children.filter((id) => people.has(id));
    const adoptedKids = (u.adoptedChildren ?? []).filter((id) =>
      people.has(id),
    );

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
        push(parentsOf, kid, { id: pid, tag: "biological" });
        push(childrenOf, pid, { id: kid, tag: "biological" });
      }
    }
    for (const kid of adoptedKids) {
      const slot = childUnionOf.get(kid) ?? {};
      slot.adoptive = u.id;
      childUnionOf.set(kid, slot);
      addMember(u.familyId, kid);
      for (const pid of partners) {
        push(parentsOf, kid, { id: pid, tag: "adoptive" });
        push(childrenOf, pid, { id: kid, tag: "adoptive" });
      }
    }
  }

  // Family affiliation history per person: birth, adopted-into, then married-into in union order.
  const familiesOf = new Map<string, FamilyAffiliation[]>();
  for (const p of raw.people) {
    const affs: FamilyAffiliation[] = [];
    if (p.birthFamilyId)
      affs.push({ familyId: p.birthFamilyId, kind: "birth" });
    const adoptiveUnionId = childUnionOf.get(p.id)?.adoptive;
    if (adoptiveUnionId) {
      const au = unions.get(adoptiveUnionId);
      if (au?.familyId && au.familyId !== p.birthFamilyId) {
        affs.push({
          familyId: au.familyId,
          kind: "adopted-into",
          unionId: au.id,
        });
      }
    }
    const partnerUnions = (unionsOf.get(p.id) ?? [])
      .map((id) => unions.get(id)!)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    for (const u of partnerUnions) {
      if (
        u.familyId &&
        u.familyId !== p.birthFamilyId &&
        !affs.some((a) => a.familyId === u.familyId)
      ) {
        affs.push({
          familyId: u.familyId,
          kind: "married-into",
          status: u.status,
          unionId: u.id,
        });
      }
    }
    familiesOf.set(p.id, affs);
  }

  // Divine parentage: index deva → children, and let a deva "belong" (for the 2D
  // family view and camera framing) to each of its children's families, so it
  // hovers above them. Membership only; the deva keeps no family colour of its own.
  const divineChildrenOf = new Map<string, string[]>();
  for (const p of raw.people) {
    for (const dp of p.divineParents ?? []) {
      if (!people.has(dp)) continue;
      const list = divineChildrenOf.get(dp);
      if (list) list.push(p.id);
      else divineChildrenOf.set(dp, [p.id]);
      addMember(familiesOf.get(p.id)?.[0]?.familyId ?? null, dp);
    }
  }

  const { gen, componentOf } = computeGenerations(raw.people, raw.unions);
  const familyLabels = computeFamilyLabels(raw, people, gen);

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
    divineChildrenOf,
    familyLabels,
    generations: gen,
    componentOf,
  };
};

/**
 * A display label per family. Family ids are always unique but names may repeat
 * (two distinct "Pandya" lineages). When a name is shared, we add a distinguisher:
 * the family's own `note` if set, otherwise "of <eldest ancestor>" derived from the
 * oldest member born into it: so same-named families are always tellable apart.
 */
const computeFamilyLabels = (
  raw: FamilyDataV2,
  people: Map<string, PersonRecord>,
  gen: Map<string, number>,
): Map<string, FamilyLabel> => {
  const nameCount = new Map<string, number>();
  for (const fam of Object.values(raw.families)) {
    const key = fam.name.trim().toLowerCase();
    nameCount.set(key, (nameCount.get(key) ?? 0) + 1);
  }

  const eldestBornInto = (familyId: string): string | undefined => {
    const born = raw.people.filter((p) => p.birthFamilyId === familyId);
    if (born.length === 0) return undefined;
    return born
      .slice()
      .sort(
        (a, b) =>
          (gen.get(a.id) ?? 0) - (gen.get(b.id) ?? 0) ||
          a.firstName.localeCompare(b.firstName) ||
          a.id.localeCompare(b.id),
      )[0].id;
  };

  const labels = new Map<string, FamilyLabel>();
  for (const [id, fam] of Object.entries(raw.families)) {
    const shared = (nameCount.get(fam.name.trim().toLowerCase()) ?? 0) > 1;
    if (!shared) {
      labels.set(id, { name: fam.name });
      continue;
    }
    let distinguisher = fam.note?.trim() || undefined;
    if (!distinguisher) {
      const elderId = eldestBornInto(id);
      const elder = elderId ? people.get(elderId) : undefined;
      distinguisher = elder ? `${elder.firstName}` : `#${id.slice(-4)}`;
    }
    labels.set(id, { name: fam.name, distinguisher });
  }
  return labels;
};

/** The family whose color a person wears: birth lineage, else the family that adopted them. */
export const displayFamilyOf = (
  ds: Dataset,
  personId: string,
): string | null => {
  const p = ds.people.get(personId);
  if (!p) return null;
  if (p.birthFamilyId) return p.birthFamilyId;
  const adoptiveUnionId = ds.childUnionOf.get(personId)?.adoptive;
  if (adoptiveUnionId) return ds.unions.get(adoptiveUnionId)?.familyId ?? null;
  return null;
};
