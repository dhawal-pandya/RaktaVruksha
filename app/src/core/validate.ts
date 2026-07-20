import type { FamilyDataV2, PersonRecord, UnionRecord } from './types';

export interface ValidationResult {
  errors: string[];
  warnings: string[];
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Structural + referential validation of a v2 file. Errors make the file unusable;
 * warnings are data-quality issues the app tolerates.
 */
export const validateData = (raw: FamilyDataV2): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (raw.meta?.schemaVersion !== 2) {
    errors.push(`meta.schemaVersion must be 2 (got ${String(raw.meta?.schemaVersion)})`);
  }

  const personIds = new Set<string>();
  for (const p of raw.people) {
    if (!p.id) errors.push('person with empty id');
    else if (personIds.has(p.id)) errors.push(`duplicate person id "${p.id}"`);
    personIds.add(p.id);
    if (p.birthFamilyId !== null && !(p.birthFamilyId in raw.families)) {
      errors.push(`person "${p.id}": unknown birthFamilyId "${p.birthFamilyId}"`);
    }
  }

  // Divine parentage: parents must exist and be marked divine (a free-agent link,
  // so it isn't subject to the one-biological-union rule).
  const divineById = new Map(raw.people.map(p => [p.id, p.divine === true]));
  for (const p of raw.people) {
    for (const dp of p.divineParents ?? []) {
      if (!personIds.has(dp)) errors.push(`person "${p.id}": unknown divineParent "${dp}"`);
      else if (!divineById.get(dp)) warnings.push(`"${p.id}": divineParent "${dp}" is not marked divine`);
    }
  }

  const unionIds = new Set<string>();
  const partnerKeys = new Set<string>();
  const bioUnionOf = new Map<string, string>();
  const adoptUnionOf = new Map<string, string>();

  for (const u of raw.unions) {
    if (!u.id) errors.push('union with empty id');
    else if (unionIds.has(u.id)) errors.push(`duplicate union id "${u.id}"`);
    unionIds.add(u.id);

    if (u.partners.length < 1 || u.partners.length > 2) {
      errors.push(`union "${u.id}": must have 1 or 2 partners (got ${u.partners.length})`);
    }
    for (const pid of u.partners) {
      if (!personIds.has(pid)) errors.push(`union "${u.id}": unknown partner "${pid}"`);
    }
    if (u.partners.length === 2 && u.partners[0] === u.partners[1]) {
      errors.push(`union "${u.id}": duplicate partner "${u.partners[0]}"`);
    }
    const key = [...u.partners].sort().join('|');
    if (u.partners.length === 2) {
      if (partnerKeys.has(key)) warnings.push(`unions share the same partner pair (${key})`);
      partnerKeys.add(key);
    }
    if (u.familyId !== null && !(u.familyId in raw.families)) {
      errors.push(`union "${u.id}": unknown familyId "${u.familyId}"`);
    }

    const adopted = u.adoptedChildren ?? [];
    for (const cid of u.children) {
      if (!personIds.has(cid)) errors.push(`union "${u.id}": unknown child "${cid}"`);
      if (u.partners.includes(cid)) errors.push(`union "${u.id}": "${cid}" is both partner and child`);
      if (adopted.includes(cid)) errors.push(`union "${u.id}": "${cid}" is both biological and adopted child`);
      const prev = bioUnionOf.get(cid);
      if (prev) errors.push(`"${cid}" is a biological child of two unions ("${prev}", "${u.id}")`);
      else bioUnionOf.set(cid, u.id);
    }
    for (const cid of adopted) {
      if (!personIds.has(cid)) errors.push(`union "${u.id}": unknown adopted child "${cid}"`);
      if (u.partners.includes(cid)) errors.push(`union "${u.id}": "${cid}" is both partner and adopted child`);
      const prev = adoptUnionOf.get(cid);
      if (prev) errors.push(`"${cid}" is an adopted child of two unions ("${prev}", "${u.id}")`);
      else adoptUnionOf.set(cid, u.id);
    }
  }

  // Data-quality warnings: biological children whose birth family disagrees with their union's family
  const peopleById = new Map(raw.people.map(p => [p.id, p]));
  for (const u of raw.unions) {
    for (const cid of u.children) {
      const child = peopleById.get(cid);
      if (child && child.birthFamilyId !== u.familyId) {
        warnings.push(
          `"${cid}": birthFamilyId "${child.birthFamilyId}" differs from union "${u.id}" familyId "${u.familyId}"`,
        );
      }
    }
  }

  return { errors, warnings };
};

/** Parse untrusted JSON text into a normalized FamilyDataV2, or explain why not. */
export const parseFamilyData = (
  text: string,
): { raw: FamilyDataV2 | null; errors: string[]; warnings: string[] } => {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (e) {
    return { raw: null, errors: [`not valid JSON: ${(e as Error).message}`], warnings: [] };
  }
  if (!isRecord(json)) return { raw: null, errors: ['root must be a JSON object'], warnings: [] };
  if (!Array.isArray(json.people) || !Array.isArray(json.unions) || !isRecord(json.families)) {
    return {
      raw: null,
      errors: ['file must contain "families" (object), "people" (array) and "unions" (array)'],
      warnings: [],
    };
  }

  const people: PersonRecord[] = (json.people as Record<string, unknown>[]).map(p => ({
    id: String(p.id ?? ''),
    firstName: String(p.firstName ?? ''),
    lastName: String(p.lastName ?? ''),
    gender: p.gender === 'female' ? 'female' : 'male',
    alive: p.alive !== false,
    birthFamilyId: p.birthFamilyId == null ? null : String(p.birthFamilyId),
    ...(p.notes ? { notes: String(p.notes) } : {}),
    updatedAt: String(p.updatedAt ?? new Date(0).toISOString()),
    ...(p.divine === true ? { divine: true } : {}),
    ...(Array.isArray(p.divineParents) && p.divineParents.length
      ? { divineParents: p.divineParents.map(String) }
      : {}),
  }));

  const unions: UnionRecord[] = (json.unions as Record<string, unknown>[]).map(u => ({
    id: String(u.id ?? ''),
    partners: Array.isArray(u.partners) ? u.partners.map(String) : [],
    children: Array.isArray(u.children) ? u.children.map(String) : [],
    adoptedChildren: Array.isArray(u.adoptedChildren) ? u.adoptedChildren.map(String) : [],
    familyId: u.familyId == null ? null : String(u.familyId),
    status:
      u.status === 'divorced' || u.status === 'partners' || u.status === 'unknown'
        ? u.status
        : 'married',
    ...(typeof u.order === 'number' ? { order: u.order } : {}),
    updatedAt: String(u.updatedAt ?? new Date(0).toISOString()),
  }));

  const families: FamilyDataV2['families'] = {};
  for (const [id, f] of Object.entries(json.families as Record<string, unknown>)) {
    if (isRecord(f)) {
      families[id] = {
        name: String(f.name ?? id.replace(/^family/, '')),
        color: String(f.color ?? '#8a93a6'),
        ...(f.note ? { note: String(f.note) } : {}),
      };
    }
  }

  const raw: FamilyDataV2 = {
    meta: { schemaVersion: 2, exportedAt: String((json.meta as Record<string, unknown>)?.exportedAt ?? new Date(0).toISOString()) },
    families,
    people,
    unions,
  };
  const { errors, warnings } = validateData(raw);
  return { raw: errors.length ? null : raw, errors, warnings };
};
