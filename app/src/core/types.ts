export type Gender = 'male' | 'female';
export type UnionStatus = 'married' | 'divorced' | 'partners' | 'unknown';
export type ParentTag = 'biological' | 'adoptive';

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
}

export interface FamilyDataV2 {
  meta: { schemaVersion: 2; exportedAt: string };
  families: Record<string, FamilyRecord>;
  people: PersonRecord[];
  unions: UnionRecord[];
}

export interface FamilyAffiliation {
  familyId: string;
  kind: 'birth' | 'adopted-into' | 'married-into';
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

/** Fully indexed dataset — everything the app derives from the raw file, built in one pass. */
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
  generations: Map<string, number>;
  componentOf: Map<string, number>;
}

export interface PersonNode {
  id: string;
  kind: 'person';
  personId: string;
  label: string;
  color: string;
  gen: number;
  familyId: string | null;
  alive: boolean;
}

export interface UnionNode {
  id: string;
  kind: 'union';
  unionId: string;
  gen: number;
  status: UnionStatus;
  familyId: string | null;
}

export type GraphNode = PersonNode | UnionNode;

export interface GraphLink {
  source: string;
  target: string;
  kind: 'partner' | 'child';
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
  dir: 'up' | 'down' | 'side';
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

export const personName = (p: { firstName: string; lastName: string }): string =>
  [p.firstName, p.lastName].filter(Boolean).join(' ');
