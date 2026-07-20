export type Gender = "male" | "female";
export type UnionStatus = "married" | "divorced" | "partners" | "unknown";
export type ParentTag = "biological" | "adoptive";

export interface PersonRecord {
  id: string;
  firstName: string;
  lastName: string;
  gender: Gender;
  alive: boolean;
  /** Family born into; null = unknown lineage. */
  birthFamilyId: string | null;
  notes?: string;
  updatedAt: string;
  /** A deva / divine being. Rendered distinctly and kept as a "free agent": its
   *  parentage never binds the generation leveling of mortals. */
  divine?: boolean;
  /** Divine parent(s): a free-agent parentage that adds a divine father/mother
   *  without disturbing the child's mortal (biological/adoptive) parentage. */
  divineParents?: string[];
}

export interface UnionRecord {
  id: string;
  /** 1 or 2 person ids. 1 = the other parent is unknown (a data gap, not a status). */
  partners: string[];
  /** Biological children of this union. */
  children: string[];
  /** Children raised by this union but not biologically its own. */
  adoptedChildren?: string[];
  /** The family this union's children are born/adopted into. */
  familyId: string | null;
  status: UnionStatus;
  order?: number;
  updatedAt: string;
}

export interface FamilyRecord {
  name: string;
  color: string;
  /** Optional human distinguisher for lineages that share a name: e.g. a place
   *  or branch ("Surat branch"). Ids are always unique; names may repeat. */
  note?: string;
}

/** Display name for a family, with a distinguisher when the name isn't unique. */
export interface FamilyLabel {
  name: string;
  distinguisher?: string;
}

export interface FamilyDataV2 {
  meta: { schemaVersion: 2; exportedAt: string };
  families: Record<string, FamilyRecord>;
  people: PersonRecord[];
  unions: UnionRecord[];
}

export interface FamilyAffiliation {
  familyId: string;
  kind: "birth" | "adopted-into" | "married-into";
  status?: UnionStatus;
  unionId?: string;
}

export interface RelRef {
  id: string;
  tag: ParentTag;
}

export interface SpouseRef {
  id: string;
  unionId: string;
  status: UnionStatus;
}

/** Fully indexed dataset: everything the app derives from the raw file, built in one pass. */
export interface Dataset {
  raw: FamilyDataV2;
  people: Map<string, PersonRecord>;
  unions: Map<string, UnionRecord>;
  parentsOf: Map<string, RelRef[]>;
  childrenOf: Map<string, RelRef[]>;
  spousesOf: Map<string, SpouseRef[]>;
  /** Unions in which the person is a partner. */
  unionsOf: Map<string, string[]>;
  /** Unions in which the person is a child, by role. */
  childUnionOf: Map<string, { biological?: string; adoptive?: string }>;
  familiesOf: Map<string, FamilyAffiliation[]>;
  membersOfFamily: Map<string, Set<string>>;
  /** Deva id → the ids of its divine children (free-agent parentage). */
  divineChildrenOf: Map<string, string[]>;
  /** Per-family display label; adds a distinguisher when a name is shared. */
  familyLabels: Map<string, FamilyLabel>;
  generations: Map<string, number>;
  componentOf: Map<string, number>;
}

export interface PersonNode {
  id: string;
  kind: "person";
  personId: string;
  label: string;
  color: string;
  gen: number;
  familyId: string | null;
  alive: boolean;
  gender: Gender;
  /** True for a deva, the renderer gives these a distinct, radiant treatment. */
  divine?: boolean;
}

export interface UnionNode {
  id: string;
  kind: "union";
  unionId: string;
  gen: number;
  status: UnionStatus;
  familyId: string | null;
  /** Authoring order among a person's unions; drives spouse placement in 2D. */
  order?: number;
}

export type GraphNode = PersonNode | UnionNode;

export interface GraphLink {
  source: string;
  target: string;
  kind: "partner" | "child" | "divine";
  tag?: ParentTag;
  status?: UnionStatus;
}

export interface Graph {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface KinStep {
  from: string;
  to: string;
  dir: "up" | "down" | "side";
  tag?: ParentTag;
  status?: UnionStatus;
}

export interface MergeReport {
  peopleAdded: string[];
  peopleUpdated: string[];
  unionsAdded: number;
  unionsUpdated: number;
  familiesAdded: string[];
}

export const personName = (p: {
  firstName: string;
  lastName: string;
}): string => [p.firstName, p.lastName].filter(Boolean).join(" ");

/** "Pandya" normally; "Pandya · of Kevalji" when the name is shared by another lineage. */
export const formatFamilyLabel = (
  label: FamilyLabel | undefined,
  fallback = "",
): string => {
  if (!label) return fallback;
  return label.distinguisher
    ? `${label.name} · ${label.distinguisher}`
    : label.name;
};
