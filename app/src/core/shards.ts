/**
 * The on-disk form of a dataset: one small, hand-editable file per family.
 *
 * A flat family-data file is ~90% ceremony. Every person in the Hiranyagarbha
 * tree carries `"lastName": ""` and `"alive": true`; four in five are male and
 * named exactly like their id; and 225 of its 612 unions say nothing beyond
 * "A begat B", in nineteen lines. What is left when that is stripped — a name
 * and a citation — is one line long.
 *
 * So a shard hoists the constants into a `defaults` header and collapses
 * father-son successions into arrays:
 *
 *   "people": {
 *     "Anena": "Son of Puranjaya. SB 9.6.16",
 *     "PrithuI": { "name": "Prithu", "note": "Fifth of the solar kings…" }
 *   },
 *   "unions": [
 *     ["Ikshvaku", "Vikukshi", "Puranjaya", "Anena"],
 *     { "id": "u_saubhari", "p": ["Saubhari", "MandhatriKanya"], "c": [] }
 *   ]
 *
 * A person is one line: the string shorthand IS the note, and everything else
 * falls back to the header. An entry in `unions` that is an ARRAY is a chain,
 * each adjacent pair implying the union `u_<parent>_<child>`; an entry that is
 * an OBJECT is a union that carries something a chain cannot say. Chains and
 * unions share one array so that their file order is exactly their order in the
 * rebuilt dataset — see "Order" below.
 *
 * This module is pure (no fs) so the browser loads shards with it and the
 * scripts write them with the same code.
 *
 * ## Order
 *
 * `expand(dense(raw))` returns every record byte-identical, but the people and
 * unions arrays come back GROUPED BY FAMILY rather than in their original
 * interleaving. That is deliberate and it is safe, because the only thing in the
 * app that reads those arrays positionally is the 3D layout seed, and it reads
 * them per-family: family ring centres come from a sorted key list, and the
 * phyllotaxis index is a counter that restarts for each family (see
 * core/layout.ts). Relative order WITHIN a family is what has to survive, and it
 * does — shards keep their records in the order they were found, and a chain is
 * only ever formed from a run that is already consecutive.
 *
 * shards.test.ts asserts both halves of that: records deep-equal as a set, and
 * computeLayout returns identical coordinates.
 */
import type {
  FamilyDataV2,
  FamilyRecord,
  Gender,
  PersonRecord,
  UnionRecord,
  UnionStatus,
} from "./types";
import { buildDataset, displayFamilyOf } from "./dataset";

export const MANIFEST = "_manifest.json";
const FLOATING = "_floating.json";

/** Header constants a shard's records fall back to. */
interface Defaults {
  stamp: string;
  gender: Gender;
  alive: boolean;
  lastName: string;
  status: UnionStatus;
}

/** A person minus everything the header already says. `note` alone is written
 *  as a bare string instead of an object. */
interface PersonEntry {
  name?: string;
  /** Birth lineage, when it is not the file's own family — someone shown here
   *  because this is where they are drawn, but born elsewhere or nowhere. */
  fam?: string | null;
  last?: string;
  gender?: Gender;
  alive?: boolean;
  u?: string;
  divine?: boolean;
  divineParents?: string[];
  anchor?: PersonRecord["genAnchor"];
  altName?: string;
  altGender?: Gender;
  note?: string;
}

interface UnionEntry {
  id: string;
  p: string[];
  c: string[];
  /** The family this union's children take, when it is not the file's own. */
  fam?: string | null;
  a?: string[];
  status?: UnionStatus;
  order?: number;
  gap?: number;
  /** A bond across generations: drawn, never levelled. See UnionRecord.crossEra. */
  cross?: boolean;
  note?: string;
  u?: string;
}

/** An array is a father-son chain; an object is a union stated in full. */
type UnionSlot = string[] | UnionEntry;

interface ShardDoc {
  family: string | null;
  name?: string;
  color?: string;
  note?: string;
  defaults: Defaults;
  people: Record<string, string | PersonEntry>;
  unions: UnionSlot[];
}

export interface Manifest {
  meta: FamilyDataV2["meta"];
  shards: string[];
}

/**
 * Shard filename for a family. Derived from the family **id**, never its name:
 * names are not unique (`familyMatsya` and `familyAvatarMatsya` are both
 * "Matsya") and would collide on disk.
 */
export const shardFileName = (familyId: string | null): string => {
  if (familyId === null) return FLOATING;
  const stem = familyId.startsWith("family")
    ? familyId.slice(6, 7).toLowerCase() + familyId.slice(7)
    : familyId;
  return `${stem}.json`;
};

const modal = <T>(values: T[], fallback: T): T => {
  if (values.length === 0) return fallback;
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = values[0];
  let bestN = 0;
  for (const [v, n] of counts) if (n > bestN) [best, bestN] = [v, n];
  return best;
};

const chainId = (parent: string, child: string) => `u_${parent}_${child}`;

/** True when a union says nothing a chain link cannot say, so it can vanish
 *  into an array. Its id must be regenerable, which is why stage 0 normalised
 *  the sixty-four that carried a hand-written one. */
const isChainLink = (
  u: UnionRecord,
  d: Defaults,
  famId: string | null,
): boolean =>
  (u.familyId ?? null) === famId &&
  u.partners.length === 1 &&
  u.children.length === 1 &&
  (u.adoptedChildren?.length ?? 0) === 0 &&
  u.status === d.status &&
  u.order === undefined &&
  u.childGap === undefined &&
  u.crossEra === undefined &&
  u.notes === undefined &&
  u.updatedAt === d.stamp &&
  u.id === chainId(u.partners[0], u.children[0]);

// --- encode -----------------------------------------------------------------

const encodePerson = (
  p: PersonRecord,
  d: Defaults,
  famId: string | null,
): string | PersonEntry => {
  const e: PersonEntry = {};
  if (p.firstName !== p.id) e.name = p.firstName;
  if ((p.birthFamilyId ?? null) !== famId) e.fam = p.birthFamilyId;
  if (p.lastName !== d.lastName) e.last = p.lastName;
  if (p.gender !== d.gender) e.gender = p.gender;
  if (p.alive !== d.alive) e.alive = p.alive;
  if (p.updatedAt !== d.stamp) e.u = p.updatedAt;
  if (p.divine !== undefined) e.divine = p.divine;
  if (p.divineParents !== undefined) e.divineParents = p.divineParents;
  if (p.genAnchor !== undefined) e.anchor = p.genAnchor;
  if (p.altName !== undefined) e.altName = p.altName;
  if (p.altGender !== undefined) e.altGender = p.altGender;
  if (p.notes !== undefined) e.note = p.notes;
  const keys = Object.keys(e);
  return keys.length === 1 && keys[0] === "note" ? (e.note as string) : e;
};

const encodeUnion = (
  u: UnionRecord,
  d: Defaults,
  famId: string | null,
): UnionEntry => {
  const e: UnionEntry = { id: u.id, p: u.partners, c: u.children };
  if ((u.familyId ?? null) !== famId) e.fam = u.familyId;
  if (u.adoptedChildren?.length) e.a = u.adoptedChildren;
  if (u.status !== d.status) e.status = u.status;
  if (u.order !== undefined) e.order = u.order;
  if (u.childGap !== undefined) e.gap = u.childGap;
  if (u.crossEra !== undefined) e.cross = u.crossEra;
  if (u.notes !== undefined) e.note = u.notes;
  if (u.updatedAt !== d.stamp) e.u = u.updatedAt;
  return e;
};

/**
 * Fold a family's father-to-son links into chain arrays.
 *
 * A succession is rarely contiguous in the file — the kings were spliced in over
 * many passes — so a chain is allowed to reach forward and pull a link back to
 * join its run. What that reordering must never disturb is **sibling order**: a
 * parent's children are drawn around a ring in the order their links appear, and
 * that order is birth order. Two unions swapping places only matters when they
 * share a parent, so a link is pulled back only when nothing it jumps over is a
 * union of the same parent. Everything else about union order is invisible —
 * single-partner unions draw no node at all.
 */
const packUnions = (
  unions: UnionRecord[],
  d: Defaults,
  famId: string | null,
): UnionSlot[] => {
  const out: UnionSlot[] = [];
  const remaining = unions.map((u, i) => ({ u, i, taken: false }));

  for (const slot of remaining) {
    if (slot.taken) continue;
    if (!isChainLink(slot.u, d, famId)) {
      out.push(encodeUnion(slot.u, d, famId));
      slot.taken = true;
      continue;
    }
    const run = [slot.u];
    slot.taken = true;
    let from = slot.i;
    for (;;) {
      const wantParent = run[run.length - 1].children[0];
      const next = remaining.find(
        (s) =>
          !s.taken &&
          s.i > from &&
          isChainLink(s.u, d, famId) &&
          s.u.partners[0] === wantParent,
      );
      if (!next) break;
      // Everything still unplaced between here and there gets pushed later.
      // That is only visible if one of them is another union of the same parent.
      const jumped = remaining.some(
        (s) =>
          !s.taken &&
          s.i > from &&
          s.i < next.i &&
          s.u.partners.includes(wantParent),
      );
      if (jumped) break;
      run.push(next.u);
      next.taken = true;
      from = next.i;
    }
    out.push([run[0].partners[0], ...run.map((u) => u.children[0])]);
  }
  return out;
};

const defaultsFor = (people: PersonRecord[], unions: UnionRecord[]): Defaults => ({
  stamp: modal(
    [...people.map((p) => p.updatedAt), ...unions.map((u) => u.updatedAt)],
    "",
  ),
  gender: modal(people.map((p) => p.gender), "male"),
  alive: modal(people.map((p) => p.alive), true),
  lastName: modal(people.map((p) => p.lastName), ""),
  status: modal(unions.map((u) => u.status), "married"),
});

/**
 * Which file a record lives in: **the family it is drawn with**, which is not
 * always the family it was born into. Karna's `birthFamilyId` is null, but he is
 * rendered among the Sutas who raised him, so he belongs in `suta.json` — where
 * a reader looking at him on screen would think to go. His record still says
 * `"fam": null`, so nothing about the data changes.
 *
 * This must match `buildGraph`'s node `familyId` exactly, because that is what
 * the layout groups by when it seeds positions. Sharding on any other key
 * reshuffles the constellation.
 */
const placement = (raw: FamilyDataV2) => {
  const ds = buildDataset(raw);
  const forPerson = (p: PersonRecord): string | null => {
    const own = displayFamilyOf(ds, p.id);
    if (own) return own;
    const divineChild = ds.divineChildrenOf.get(p.id)?.[0];
    return divineChild ? displayFamilyOf(ds, divineChild) : null;
  };
  const forUnion = (u: UnionRecord): string | null => {
    if (u.familyId) return u.familyId;
    const partner = u.partners.find((id) => ds.people.has(id));
    return partner ? displayFamilyOf(ds, partner) : null;
  };
  return { forPerson, forUnion };
};

/** Split a dataset into shard texts, keyed by filename. Includes the manifest. */
export const dense = (raw: FamilyDataV2): Map<string, string> => {
  const where = placement(raw);
  const groups = new Map<string | null, { people: PersonRecord[]; unions: UnionRecord[] }>();
  const group = (key: string | null) => {
    let g = groups.get(key);
    if (!g) groups.set(key, (g = { people: [], unions: [] }));
    return g;
  };
  for (const id of Object.keys(raw.families)) group(id);
  for (const p of raw.people) group(where.forPerson(p)).people.push(p);
  for (const u of raw.unions) group(where.forUnion(u)).unions.push(u);

  // Families in their original key order, then the unaffiliated. Expanding in
  // this order is what puts raw.families back in the order it was written.
  const keys = [...Object.keys(raw.families)];
  if (groups.has(null)) keys.push(null as unknown as string);

  const files = new Map<string, string>();
  const shards: string[] = [];
  const seen = new Set<string>();
  for (const key of keys) {
    const famId = (key as string | null) ?? null;
    const g = groups.get(famId)!;
    const file = shardFileName(famId);
    if (seen.has(file))
      throw new Error(`shard filename collision: ${file} (family ${famId})`);
    seen.add(file);
    const d = defaultsFor(g.people, g.unions);
    const fam: FamilyRecord | undefined = famId ? raw.families[famId] : undefined;
    const doc: ShardDoc = {
      family: famId,
      ...(fam ? { name: fam.name, color: fam.color } : {}),
      ...(fam?.note !== undefined ? { note: fam.note } : {}),
      defaults: d,
      people: Object.fromEntries(
        g.people.map((p) => [p.id, encodePerson(p, d, famId)]),
      ),
      unions: packUnions(g.unions, d, famId),
    };
    files.set(file, printShard(doc));
    shards.push(file);
  }

  const manifest: Manifest = { meta: raw.meta, shards };
  files.set(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  return files;
};

/** Valid JSON, but one record per line — the whole point of the format. */
const printShard = (s: ShardDoc): string => {
  const out: string[] = ["{"];
  out.push(`  "family": ${JSON.stringify(s.family)},`);
  if (s.name !== undefined) out.push(`  "name": ${JSON.stringify(s.name)},`);
  if (s.color !== undefined) out.push(`  "color": ${JSON.stringify(s.color)},`);
  if (s.note !== undefined) out.push(`  "note": ${JSON.stringify(s.note)},`);
  out.push(`  "defaults": ${JSON.stringify(s.defaults)},`);

  const people = Object.entries(s.people);
  if (people.length === 0) out.push(`  "people": {},`);
  else {
    out.push(`  "people": {`);
    people.forEach(([id, e], i) => {
      const comma = i < people.length - 1 ? "," : "";
      out.push(`    ${JSON.stringify(id)}: ${JSON.stringify(e)}${comma}`);
    });
    out.push(`  },`);
  }

  if (s.unions.length === 0) out.push(`  "unions": []`);
  else {
    out.push(`  "unions": [`);
    s.unions.forEach((u, i) => {
      const comma = i < s.unions.length - 1 ? "," : "";
      out.push(`    ${JSON.stringify(u)}${comma}`);
    });
    out.push(`  ]`);
  }

  out.push("}");
  return `${out.join("\n")}\n`;
};

// --- decode -----------------------------------------------------------------

const decodePerson = (
  id: string,
  raw: string | PersonEntry,
  d: Defaults,
  famId: string | null,
): PersonRecord => {
  const e: PersonEntry = typeof raw === "string" ? { note: raw } : raw;
  const p: PersonRecord = {
    id,
    firstName: e.name ?? id,
    lastName: e.last ?? d.lastName,
    gender: e.gender ?? d.gender,
    alive: e.alive ?? d.alive,
    birthFamilyId: "fam" in e ? (e.fam ?? null) : famId,
    updatedAt: e.u ?? d.stamp,
  };
  if (e.note !== undefined) p.notes = e.note;
  if (e.divine !== undefined) p.divine = e.divine;
  if (e.divineParents !== undefined) p.divineParents = e.divineParents;
  if (e.anchor !== undefined) p.genAnchor = e.anchor;
  if (e.altName !== undefined) p.altName = e.altName;
  if (e.altGender !== undefined) p.altGender = e.altGender;
  return p;
};

const decodeUnion = (
  e: UnionEntry,
  d: Defaults,
  famId: string | null,
): UnionRecord => {
  const u: UnionRecord = {
    id: e.id,
    partners: e.p,
    children: e.c,
    adoptedChildren: e.a ?? [],
    familyId: "fam" in e ? (e.fam ?? null) : famId,
    status: e.status ?? d.status,
    updatedAt: e.u ?? d.stamp,
  };
  if (e.order !== undefined) u.order = e.order;
  if (e.gap !== undefined) u.childGap = e.gap;
  if (e.cross !== undefined) u.crossEra = e.cross;
  if (e.note !== undefined) u.notes = e.note;
  return u;
};

const decodeChain = (
  chain: string[],
  d: Defaults,
  famId: string | null,
): UnionRecord[] => {
  const out: UnionRecord[] = [];
  for (let i = 0; i + 1 < chain.length; i++) {
    out.push({
      id: chainId(chain[i], chain[i + 1]),
      partners: [chain[i]],
      children: [chain[i + 1]],
      adoptedChildren: [],
      familyId: famId,
      status: d.status,
      updatedAt: d.stamp,
    });
  }
  return out;
};

/** Rebuild a dataset from a manifest and the shard texts it names. */
export const expand = (files: Map<string, string>): FamilyDataV2 => {
  const manifestText = files.get(MANIFEST);
  if (!manifestText) throw new Error(`missing ${MANIFEST}`);
  const manifest = JSON.parse(manifestText) as Manifest;

  const families: Record<string, FamilyRecord> = {};
  const people: PersonRecord[] = [];
  const unions: UnionRecord[] = [];

  for (const file of manifest.shards) {
    const text = files.get(file);
    if (!text) throw new Error(`manifest names a missing shard: ${file}`);
    const doc = JSON.parse(text) as ShardDoc;
    const famId = doc.family;
    if (famId !== null) {
      families[famId] = {
        name: doc.name ?? "",
        color: doc.color ?? "",
        ...(doc.note !== undefined ? { note: doc.note } : {}),
      };
    }
    for (const [id, entry] of Object.entries(doc.people)) {
      people.push(decodePerson(id, entry, doc.defaults, famId));
    }
    for (const slot of doc.unions) {
      if (Array.isArray(slot)) unions.push(...decodeChain(slot, doc.defaults, famId));
      else unions.push(decodeUnion(slot, doc.defaults, famId));
    }
  }

  return { meta: manifest.meta, families, people, unions };
};

// --- check ------------------------------------------------------------------

/**
 * Structural problems a shard set can have that the app itself would not
 * report: the same id defined twice, a chain naming somebody with no record, a
 * reference to an id no shard defines. Run by `npm run check`.
 */
export const checkShards = (files: Map<string, string>): string[] => {
  const errors: string[] = [];
  let data: FamilyDataV2;
  try {
    data = expand(files);
  } catch (e) {
    return [String(e)];
  }

  const seen = new Set<string>();
  for (const p of data.people) {
    if (seen.has(p.id)) errors.push(`person defined twice: ${p.id}`);
    seen.add(p.id);
  }
  const unionIds = new Set<string>();
  for (const u of data.unions) {
    if (unionIds.has(u.id)) errors.push(`union defined twice: ${u.id}`);
    unionIds.add(u.id);
  }

  const ref = (from: string, id: string) => {
    if (!seen.has(id)) errors.push(`${from} references unknown person "${id}"`);
  };
  for (const u of data.unions) {
    for (const id of u.partners) ref(`union ${u.id}`, id);
    for (const id of u.children) ref(`union ${u.id}`, id);
    for (const id of u.adoptedChildren ?? []) ref(`union ${u.id}`, id);
  }
  for (const p of data.people) {
    for (const id of p.divineParents ?? []) ref(`${p.id}.divineParents`, id);
    const a = p.genAnchor;
    if (a && typeof a === "object") ref(`${p.id}.genAnchor`, a.relativeTo);
    if (p.birthFamilyId && !data.families[p.birthFamilyId])
      errors.push(`${p.id} is born into unknown family "${p.birthFamilyId}"`);
  }
  return errors;
};
