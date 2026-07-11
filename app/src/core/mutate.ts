import type {
  FamilyDataV2,
  Gender,
  PersonRecord,
  UnionRecord,
  UnionStatus,
} from './types';
import { newFamilyId, newPersonId, newUnionId } from './ids';

const now = () => new Date().toISOString();

export interface PersonFields {
  firstName: string;
  lastName: string;
  gender: Gender;
  alive: boolean;
  birthFamilyId: string | null;
  notes?: string;
}

export const addFamily = (
  raw: FamilyDataV2,
  name: string,
  color: string,
): { raw: FamilyDataV2; familyId: string } => {
  const familyId = newFamilyId(raw, name);
  return {
    raw: { ...raw, families: { ...raw.families, [familyId]: { name, color } } },
    familyId,
  };
};

export const addPerson = (
  raw: FamilyDataV2,
  fields: PersonFields,
): { raw: FamilyDataV2; personId: string } => {
  const personId = newPersonId(raw);
  const person: PersonRecord = { id: personId, ...fields, updatedAt: now() };
  return { raw: { ...raw, people: [...raw.people, person] }, personId };
};

export const updatePerson = (
  raw: FamilyDataV2,
  personId: string,
  patch: Partial<PersonFields>,
): FamilyDataV2 => ({
  ...raw,
  people: raw.people.map(p =>
    p.id === personId ? { ...p, ...patch, updatedAt: now() } : p,
  ),
});

export const findUnionByPartners = (
  raw: FamilyDataV2,
  partnerIds: string[],
): UnionRecord | undefined => {
  const key = [...partnerIds].sort().join('|');
  return raw.unions.find(u => [...u.partners].sort().join('|') === key);
};

export const createUnion = (
  raw: FamilyDataV2,
  init: { partners: string[]; familyId: string | null; status: UnionStatus },
): { raw: FamilyDataV2; unionId: string } => {
  const unionId = newUnionId(raw);
  const maxOrder = Math.max(
    0,
    ...raw.unions
      .filter(u => u.partners.some(p => init.partners.includes(p)))
      .map(u => u.order ?? 0),
  );
  const union: UnionRecord = {
    id: unionId,
    partners: init.partners,
    children: [],
    adoptedChildren: [],
    familyId: init.familyId,
    status: init.status,
    order: maxOrder + 1,
    updatedAt: now(),
  };
  return { raw: { ...raw, unions: [...raw.unions, union] }, unionId };
};

export const updateUnion = (
  raw: FamilyDataV2,
  unionId: string,
  patch: Partial<Omit<UnionRecord, 'id'>>,
): FamilyDataV2 => ({
  ...raw,
  unions: raw.unions.map(u =>
    u.id === unionId ? { ...u, ...patch, updatedAt: now() } : u,
  ),
});

export const addChildToUnion = (
  raw: FamilyDataV2,
  unionId: string,
  childId: string,
  tag: 'biological' | 'adoptive',
): FamilyDataV2 => ({
  ...raw,
  unions: raw.unions.map(u => {
    if (u.id !== unionId) return u;
    if (tag === 'biological') {
      return { ...u, children: [...u.children, childId], updatedAt: now() };
    }
    return { ...u, adoptedChildren: [...(u.adoptedChildren ?? []), childId], updatedAt: now() };
  }),
});

export const addPartnerToUnion = (
  raw: FamilyDataV2,
  unionId: string,
  partnerId: string,
): FamilyDataV2 => ({
  ...raw,
  unions: raw.unions.map(u =>
    u.id === unionId ? { ...u, partners: [...u.partners, partnerId], updatedAt: now() } : u,
  ),
});

// ---------------------------------------------------------------------------
// Composite flows used by the UI ("grow" actions on a focused person).
// ---------------------------------------------------------------------------

export interface GrowChildInput {
  parentId: string;
  /** Existing union of the parent to attach to, or null to create a 1-partner union. */
  unionId: string | null;
  adopted: boolean;
  child: PersonFields;
}

export const growChild = (
  raw: FamilyDataV2,
  input: GrowChildInput,
): { raw: FamilyDataV2; personId: string } => {
  let next = raw;
  let unionId = input.unionId;
  if (!unionId) {
    const parent = next.people.find(p => p.id === input.parentId);
    const created = createUnion(next, {
      partners: [input.parentId],
      familyId: input.adopted ? parent?.birthFamilyId ?? null : input.child.birthFamilyId,
      status: 'unknown',
    });
    next = created.raw;
    unionId = created.unionId;
  }
  const union = next.unions.find(u => u.id === unionId)!;
  const fields = input.adopted
    ? input.child
    : { ...input.child, birthFamilyId: union.familyId };
  const added = addPerson(next, fields);
  next = addChildToUnion(added.raw, unionId, added.personId, input.adopted ? 'adoptive' : 'biological');
  return { raw: next, personId: added.personId };
};

export interface GrowSpouseInput {
  anchorId: string;
  /** Existing person to marry, or null to create from `spouse`. */
  existingId: string | null;
  spouse?: PersonFields;
  status: UnionStatus;
  familyId: string | null;
}

export const growSpouse = (
  raw: FamilyDataV2,
  input: GrowSpouseInput,
): { raw: FamilyDataV2; personId: string; unionId: string } => {
  let next = raw;
  let spouseId = input.existingId;
  if (!spouseId) {
    const added = addPerson(next, input.spouse!);
    next = added.raw;
    spouseId = added.personId;
  }
  const existing = findUnionByPartners(next, [input.anchorId, spouseId]);
  if (existing) {
    next = updateUnion(next, existing.id, { status: input.status, familyId: input.familyId });
    return { raw: next, personId: spouseId, unionId: existing.id };
  }
  const created = createUnion(next, {
    partners: [input.anchorId, spouseId],
    familyId: input.familyId,
    status: input.status,
  });
  return { raw: created.raw, personId: spouseId, unionId: created.unionId };
};

export interface GrowParentInput {
  childId: string;
  adoptive: boolean;
  /** Existing person as the parent, or null to create from `parent`. */
  existingId: string | null;
  parent?: PersonFields;
}

export const growParent = (
  raw: FamilyDataV2,
  input: GrowParentInput,
): { raw: FamilyDataV2; personId: string } => {
  let next = raw;
  let parentId = input.existingId;
  if (!parentId) {
    const added = addPerson(next, input.parent!);
    next = added.raw;
    parentId = added.personId;
  }
  const tag = input.adoptive ? 'adoptive' : 'biological';
  const child = next.people.find(p => p.id === input.childId)!;

  // Attach to the child's existing parent union when it has room for a second partner.
  const holding = next.unions.find(u =>
    (tag === 'biological' ? u.children : u.adoptedChildren ?? []).includes(input.childId),
  );
  if (holding) {
    if (holding.partners.length >= 2) {
      throw new Error(
        `${child.firstName} already has two ${tag} parents`,
      );
    }
    if (holding.partners.includes(parentId)) {
      throw new Error('that person is already a parent here');
    }
    return { raw: addPartnerToUnion(next, holding.id, parentId), personId: parentId };
  }

  const parentRec = next.people.find(p => p.id === parentId);
  const created = createUnion(next, {
    partners: [parentId],
    familyId: input.adoptive ? parentRec?.birthFamilyId ?? null : child.birthFamilyId,
    status: 'unknown',
  });
  next = addChildToUnion(created.raw, created.unionId, input.childId, tag);
  return { raw: next, personId: parentId };
};
