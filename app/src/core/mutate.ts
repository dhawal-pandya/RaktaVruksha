import type {
  FamilyDataV2,
  FamilyRecord,
  Gender,
  PersonRecord,
  UnionRecord,
  UnionStatus,
} from "./types";
import { newFamilyId, newPersonId, newUnionId } from "./ids";

/** Edit a family's name / color / note (an empty note is dropped). */
export const updateFamily = (
  raw: FamilyDataV2,
  familyId: string,
  patch: Partial<FamilyRecord>,
): FamilyDataV2 => {
  const cur = raw.families[familyId];
  if (!cur) return raw;
  const next: FamilyRecord = { ...cur, ...patch };
  if ("note" in patch && !patch.note?.trim()) delete next.note;
  return { ...raw, families: { ...raw.families, [familyId]: next } };
};

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
  note?: string,
): { raw: FamilyDataV2; familyId: string } => {
  const familyId = newFamilyId(raw, name);
  const record = note?.trim()
    ? { name, color, note: note.trim() }
    : { name, color };
  return {
    raw: { ...raw, families: { ...raw.families, [familyId]: record } },
    familyId,
  };
};

export const addPerson = (
  raw: FamilyDataV2,
  fields: PersonFields,
): { raw: FamilyDataV2; personId: string } => {
  const personId = newPersonId(raw, fields.firstName);
  const person: PersonRecord = { id: personId, ...fields, updatedAt: now() };
  return { raw: { ...raw, people: [...raw.people, person] }, personId };
};

export const updatePerson = (
  raw: FamilyDataV2,
  personId: string,
  patch: Partial<PersonFields>,
): FamilyDataV2 => ({
  ...raw,
  people: raw.people.map((p) =>
    p.id === personId ? { ...p, ...patch, updatedAt: now() } : p,
  ),
});

export const findUnionByPartners = (
  raw: FamilyDataV2,
  partnerIds: string[],
): UnionRecord | undefined => {
  const key = [...partnerIds].sort().join("|");
  return raw.unions.find((u) => [...u.partners].sort().join("|") === key);
};

export const createUnion = (
  raw: FamilyDataV2,
  init: { partners: string[]; familyId: string | null; status: UnionStatus },
): { raw: FamilyDataV2; unionId: string } => {
  const unionId = newUnionId(raw, init.partners);
  const maxOrder = Math.max(
    0,
    ...raw.unions
      .filter((u) => u.partners.some((p) => init.partners.includes(p)))
      .map((u) => u.order ?? 0),
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
  patch: Partial<Omit<UnionRecord, "id">>,
): FamilyDataV2 => ({
  ...raw,
  unions: raw.unions.map((u) =>
    u.id === unionId ? { ...u, ...patch, updatedAt: now() } : u,
  ),
});

export const addChildToUnion = (
  raw: FamilyDataV2,
  unionId: string,
  childId: string,
  tag: "biological" | "adoptive",
): FamilyDataV2 => ({
  ...raw,
  unions: raw.unions.map((u) => {
    if (u.id !== unionId) return u;
    if (tag === "biological") {
      return { ...u, children: [...u.children, childId], updatedAt: now() };
    }
    return {
      ...u,
      adoptedChildren: [...(u.adoptedChildren ?? []), childId],
      updatedAt: now(),
    };
  }),
});

/** Move a biological child one slot earlier (-1) or later (+1) within its union's
 *  children array: the array order is the birth order shown on the graph. */
export const moveChildInUnion = (
  raw: FamilyDataV2,
  unionId: string,
  childId: string,
  dir: -1 | 1,
): FamilyDataV2 => ({
  ...raw,
  unions: raw.unions.map((u) => {
    if (u.id !== unionId) return u;
    const idx = u.children.indexOf(childId);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= u.children.length) return u;
    const children = [...u.children];
    [children[idx], children[j]] = [children[j], children[idx]];
    return { ...u, children, updatedAt: now() };
  }),
});

export const addPartnerToUnion = (
  raw: FamilyDataV2,
  unionId: string,
  partnerId: string,
): FamilyDataV2 => ({
  ...raw,
  unions: raw.unions.map((u) =>
    u.id === unionId
      ? { ...u, partners: [...u.partners, partnerId], updatedAt: now() }
      : u,
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
  /** Existing person to attach as the child, or null to create from `child`. */
  existingId?: string | null;
  child?: PersonFields;
}

export const growChild = (
  raw: FamilyDataV2,
  input: GrowChildInput,
): { raw: FamilyDataV2; personId: string } => {
  let next = raw;
  let unionId = input.unionId;
  const tag = input.adopted ? "adoptive" : "biological";

  // Attaching an existing person: guard against the states validate.ts rejects
  // (a person can't be a biological/adopted child of two unions) before mutating.
  const existingId = input.existingId ?? null;
  if (existingId) {
    if (existingId === input.parentId) {
      throw new Error("a person can't be their own child");
    }
    const held = next.unions.find((u) =>
      (tag === "biological" ? u.children : (u.adoptedChildren ?? [])).includes(
        existingId,
      ),
    );
    if (held) {
      const who =
        next.people.find((p) => p.id === existingId)?.firstName ?? "that person";
      throw new Error(`${who} is already a ${tag} child of another union`);
    }
  }
  // The existing person's own birth family, used to seed a new union so their
  // record and the union agree (we never overwrite an existing person's family).
  const existingFamily = existingId
    ? (next.people.find((p) => p.id === existingId)?.birthFamilyId ?? null)
    : null;

  if (!unionId) {
    const parent = next.people.find((p) => p.id === input.parentId);
    const created = createUnion(next, {
      partners: [input.parentId],
      familyId: input.adopted
        ? (parent?.birthFamilyId ?? null)
        : existingId
          ? existingFamily
          : input.child!.birthFamilyId,
      status: "unknown",
    });
    next = created.raw;
    unionId = created.unionId;
  }
  const union = next.unions.find((u) => u.id === unionId)!;

  let childId = existingId;
  if (!childId) {
    // A new biological child is born into the union's family; an adopted one keeps
    // whatever family the form gave. Existing people are attached as-is (above).
    const fields = input.adopted
      ? input.child!
      : { ...input.child!, birthFamilyId: union.familyId };
    const added = addPerson(next, fields);
    next = added.raw;
    childId = added.personId;
  } else if (union.partners.includes(childId)) {
    throw new Error("that person is a partner of this union");
  }

  next = addChildToUnion(next, unionId, childId, tag);
  return { raw: next, personId: childId };
};

/** Move a child from whatever biological union it's in into `unionId`, deleting a
 *  now-empty single-parent union it leaves behind. No-op if already there. */
export const moveChildToUnion = (
  raw: FamilyDataV2,
  childId: string,
  unionId: string,
): FamilyDataV2 => {
  const from = raw.unions.find((u) => u.children.includes(childId));
  if (from && from.id === unionId) return raw;
  let unions = raw.unions.map((u) => {
    if (from && u.id === from.id)
      return {
        ...u,
        children: u.children.filter((c) => c !== childId),
        updatedAt: now(),
      };
    if (u.id === unionId)
      return { ...u, children: [...u.children, childId], updatedAt: now() };
    return u;
  });
  // Drop a childless single-parent union that the child just vacated.
  unions = unions.filter(
    (u) =>
      !(
        from &&
        u.id === from.id &&
        u.partners.length < 2 &&
        u.children.length === 0 &&
        (u.adoptedChildren?.length ?? 0) === 0
      ),
  );
  return { ...raw, unions };
};

export interface GrowSpouseInput {
  anchorId: string;
  /** Existing person to marry, or null to create from `spouse`. */
  existingId: string | null;
  spouse?: PersonFields;
  status: UnionStatus;
  familyId: string | null;
  /** Existing children of the anchor to also assign to this marriage. */
  childIds?: string[];
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
  const childIds = input.childIds ?? [];

  const existing = findUnionByPartners(next, [input.anchorId, spouseId]);
  let unionId: string;
  if (existing) {
    next = updateUnion(next, existing.id, {
      status: input.status,
      familyId: input.familyId,
    });
    unionId = existing.id;
  } else {
    // If the anchor already has a single-parent union holding (some of) the chosen
    // children, complete it in place instead of making a duplicate marriage.
    const solo = childIds.length
      ? next.unions.find(
          (u) =>
            u.partners.length === 1 &&
            u.partners[0] === input.anchorId &&
            childIds.some((c) => u.children.includes(c)),
        )
      : undefined;
    if (solo) {
      next = updateUnion(next, solo.id, {
        partners: [input.anchorId, spouseId],
        status: input.status,
        familyId: input.familyId,
      });
      unionId = solo.id;
    } else {
      const created = createUnion(next, {
        partners: [input.anchorId, spouseId],
        familyId: input.familyId,
        status: input.status,
      });
      next = created.raw;
      unionId = created.unionId;
    }
  }

  for (const childId of childIds)
    next = moveChildToUnion(next, childId, unionId);
  return { raw: next, personId: spouseId, unionId };
};

/** Remove a person entirely: pull them out of every union (as partner, child, or
 *  adopted child) and drop any union left with no partners, or a lone partner and
 *  no children. Never leaves dangling references. */
export const deletePerson = (
  raw: FamilyDataV2,
  personId: string,
): FamilyDataV2 => {
  const unions = raw.unions
    .map((u) => ({
      ...u,
      partners: u.partners.filter((p) => p !== personId),
      children: u.children.filter((c) => c !== personId),
      adoptedChildren: (u.adoptedChildren ?? []).filter((c) => c !== personId),
    }))
    .filter(
      (u) =>
        u.partners.length > 0 &&
        !(
          u.partners.length < 2 &&
          u.children.length === 0 &&
          (u.adoptedChildren?.length ?? 0) === 0
        ),
    );
  return {
    ...raw,
    people: raw.people.filter((p) => p.id !== personId),
    unions,
  };
};

/**
 * Why a directional merge of `absorbId` into `keepId` can't proceed, or null if it
 * can. Blocks the one conflict validate.ts would reject: a person can be a
 * biological (or adoptive) child of only ONE union, so if both people already have
 * their own recorded parents, we can't silently pick a winner.
 */
export const mergeBlockReason = (
  raw: FamilyDataV2,
  keepId: string,
  absorbId: string,
): string | null => {
  if (keepId === absorbId) return "pick two different people";
  const keep = raw.people.find((p) => p.id === keepId);
  const absorb = raw.people.find((p) => p.id === absorbId);
  if (!keep || !absorb) return "one of those people no longer exists";

  const clashOn = (
    childrenKey: "children" | "adoptedChildren",
    label: string,
  ): string | null => {
    const uOf = (id: string) =>
      raw.unions.find((u) => (u[childrenKey] ?? []).includes(id));
    const a = uOf(keepId);
    const b = uOf(absorbId);
    return a && b && a.id !== b.id
      ? `${keep.firstName} and ${absorb.firstName} each already have ${label} parents. ` +
          `Detach one set first, then merge.`
      : null;
  };
  return clashOn("children", "biological") ?? clashOn("adoptedChildren", "adoptive");
};

/**
 * Fold `absorbId` into `keepId`: the two ids were the same human. Every reference to
 * the absorbed person becomes the kept person, unions that end up with the same
 * partners fuse (pooling their children), and the absorbed record is removed. The
 * kept person's own fields win; only blank fields are filled from the absorbed one.
 */
export const mergePerson = (
  raw: FamilyDataV2,
  keepId: string,
  absorbId: string,
): FamilyDataV2 => {
  const blocked = mergeBlockReason(raw, keepId, absorbId);
  if (blocked) throw new Error(blocked);
  const keep = raw.people.find((p) => p.id === keepId)!;
  const absorb = raw.people.find((p) => p.id === absorbId)!;

  const swap = (arr: string[]) => arr.map((x) => (x === absorbId ? keepId : x));
  const dedupe = (arr: string[]) => arr.filter((x, i) => arr.indexOf(x) === i);

  // 1. Rewrite absorb → keep everywhere, then normalize each union in isolation:
  //    a self-pair (both partners now keep) collapses to one; a person can't be
  //    their own child; duplicate/overlapping child entries are removed.
  let unions: UnionRecord[] = raw.unions.map((u) => {
    const partners = dedupe(swap(u.partners));
    const children = dedupe(swap(u.children)).filter((c) => !partners.includes(c));
    const adoptedChildren = dedupe(swap(u.adoptedChildren ?? [])).filter(
      (c) => !partners.includes(c) && !children.includes(c),
    );
    return { ...u, partners, children, adoptedChildren };
  });

  // 2. Fuse unions that now share the same partner set, pooling their children.
  const byKey = new Map<string, UnionRecord>();
  const keyOrder: string[] = [];
  for (const u of unions) {
    const key = [...u.partners].sort().join("|");
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, u);
      keyOrder.push(key);
      continue;
    }
    const children = dedupe([...prev.children, ...u.children]);
    const adoptedChildren = dedupe([
      ...(prev.adoptedChildren ?? []),
      ...(u.adoptedChildren ?? []),
    ]).filter((c) => !children.includes(c));
    byKey.set(key, {
      ...prev,
      children,
      adoptedChildren,
      // A concrete status/family beats a placeholder one.
      status: prev.status !== "unknown" ? prev.status : u.status,
      familyId: prev.familyId ?? u.familyId,
      updatedAt: now(),
    });
  }
  unions = keyOrder.map((k) => byKey.get(k)!);

  // 3. Drop unions left with no partners, or a lone partner and nothing else.
  unions = unions.filter(
    (u) =>
      u.partners.length > 0 &&
      !(
        u.partners.length < 2 &&
        u.children.length === 0 &&
        (u.adoptedChildren?.length ?? 0) === 0
      ),
  );

  // 4. Merge the two person records: kept fields win; fill only blanks from absorbed.
  const notes = [keep.notes, absorb.notes].filter(Boolean).join("\n").trim();
  const mergedKeep: PersonRecord = {
    ...keep,
    lastName: keep.lastName || absorb.lastName,
    birthFamilyId: keep.birthFamilyId ?? absorb.birthFamilyId,
    ...(notes ? { notes } : {}),
    updatedAt: now(),
  };
  const people = raw.people
    .filter((p) => p.id !== absorbId)
    .map((p) => (p.id === keepId ? mergedKeep : p));

  return { ...raw, people, unions };
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
  const tag = input.adoptive ? "adoptive" : "biological";
  const child = next.people.find((p) => p.id === input.childId)!;

  // Attach to the child's existing parent union when it has room for a second partner.
  const holding = next.unions.find((u) =>
    (tag === "biological" ? u.children : (u.adoptedChildren ?? [])).includes(
      input.childId,
    ),
  );
  if (holding) {
    if (holding.partners.length >= 2) {
      throw new Error(`${child.firstName} already has two ${tag} parents`);
    }
    if (holding.partners.includes(parentId)) {
      throw new Error("that person is already a parent here");
    }
    return {
      raw: addPartnerToUnion(next, holding.id, parentId),
      personId: parentId,
    };
  }

  const parentRec = next.people.find((p) => p.id === parentId);
  const created = createUnion(next, {
    partners: [parentId],
    familyId: input.adoptive
      ? (parentRec?.birthFamilyId ?? null)
      : child.birthFamilyId,
    status: "unknown",
  });
  next = addChildToUnion(created.raw, created.unionId, input.childId, tag);
  return { raw: next, personId: parentId };
};
