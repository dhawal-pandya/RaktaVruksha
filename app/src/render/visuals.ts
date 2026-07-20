import type { Dataset, Graph, KinStep } from '../core/types';
import { unionNodeId } from '../core/graph';

export interface VisualState {
  /** Target opacity per node id (person and union nodes). */
  nodeOpacity: Map<string, number>;
  /** Nodes that should glow brighter (focus, relation endpoints). */
  glow: Set<string>;
  /** Node ids on the active relation path (persons + bridging unions), or null. */
  pathSet: Set<string> | null;
}

export interface VisualInputs {
  focusId: string | null;
  lensFamilyId: string | null;
  isolateComponent: number | null;
  relationActive: boolean;
  relationSteps: KinStep[] | null;
  relationEndpoints: (string | null)[];
}

const DIM_LENS = 0.04;
const DIM_FOCUS = 0.15;
const DIM_ISOLATE = 0.03;
const DIM_RELATION = 0.06;

const findUnionIdBetween = (ds: Dataset, a: string, b: string): string | null => {
  for (const uid of ds.unionsOf.get(a) ?? []) {
    const u = ds.unions.get(uid);
    if (u && u.partners.includes(b)) return uid;
  }
  return null;
};

/** Person ids + bridging union-node ids that a kinship path passes through. */
export const relationPathNodeSet = (ds: Dataset, steps: KinStep[]): Set<string> => {
  const set = new Set<string>();
  if (steps.length === 0) return set;
  set.add(steps[0].from);
  for (const step of steps) {
    set.add(step.to);
    if (step.dir === 'side') {
      const uid = findUnionIdBetween(ds, step.from, step.to);
      if (uid) set.add(unionNodeId(uid));
    } else {
      const childId = step.dir === 'up' ? step.from : step.to;
      const tag = step.tag ?? 'biological';
      const uid = ds.childUnionOf.get(childId)?.[tag];
      if (uid && (ds.unions.get(uid)?.partners.length ?? 0) === 2) set.add(unionNodeId(uid));
    }
  }
  return set;
};

/** Everything visually "near" a focused person: relatives plus their bridging unions. */
const focusNeighborhood = (ds: Dataset, focusId: string): Set<string> => {
  const set = new Set<string>([focusId]);
  for (const p of ds.parentsOf.get(focusId) ?? []) set.add(p.id);
  for (const c of ds.childrenOf.get(focusId) ?? []) set.add(c.id);
  for (const s of ds.spousesOf.get(focusId) ?? []) set.add(s.id);
  for (const uid of ds.unionsOf.get(focusId) ?? []) set.add(unionNodeId(uid));
  // A deva and its divine child light up together.
  for (const dp of ds.people.get(focusId)?.divineParents ?? []) set.add(dp);
  for (const dc of ds.divineChildrenOf.get(focusId) ?? []) set.add(dc);
  const asChild = ds.childUnionOf.get(focusId);
  for (const uid of [asChild?.biological, asChild?.adoptive]) {
    if (uid && (ds.unions.get(uid)?.partners.length ?? 0) === 2) set.add(unionNodeId(uid));
  }
  return set;
};

export const computeVisuals = (
  ds: Dataset,
  graph: Graph,
  inputs: VisualInputs,
): VisualState => {
  const nodeOpacity = new Map<string, number>();
  const glow = new Set<string>();

  const pathSet =
    inputs.relationActive && inputs.relationSteps
      ? relationPathNodeSet(ds, inputs.relationSteps)
      : null;
  for (const id of inputs.relationEndpoints) if (id) glow.add(id);
  if (inputs.focusId && !inputs.relationActive) glow.add(inputs.focusId);

  const lensMembers = inputs.lensFamilyId
    ? ds.membersOfFamily.get(inputs.lensFamilyId) ?? new Set<string>()
    : null;
  const neighborhood =
    inputs.focusId && !inputs.relationActive ? focusNeighborhood(ds, inputs.focusId) : null;

  const unionInLens = (unionId: string): boolean => {
    if (!lensMembers || !inputs.lensFamilyId) return true;
    const u = ds.unions.get(unionId);
    if (!u) return false;
    if (u.familyId === inputs.lensFamilyId) return true;
    return u.partners.some(p => lensMembers.has(p));
  };

  for (const node of graph.nodes) {
    const base = node.kind === 'person' ? 0.96 : 0.8;
    const personRef = node.kind === 'person' ? node.id : null;
    const comp =
      node.kind === 'person'
        ? ds.componentOf.get(node.id)
        : ds.componentOf.get(ds.unions.get(node.unionId)?.partners[0] ?? '');

    let factor = 1;
    if (inputs.relationActive) {
      if (pathSet) factor = pathSet.has(node.id) ? 1 : DIM_RELATION;
      // While still picking endpoints, keep the world bright.
    } else if (inputs.isolateComponent !== null) {
      factor = comp === inputs.isolateComponent ? 1 : DIM_ISOLATE;
    } else {
      let lensFactor = 1;
      if (lensMembers) {
        const inLens = personRef ? lensMembers.has(personRef) : unionInLens((node as { unionId: string }).unionId);
        lensFactor = inLens ? 1 : DIM_LENS;
      }
      let focusFactor = 1;
      if (neighborhood) focusFactor = neighborhood.has(node.id) ? 1 : DIM_FOCUS;
      factor = Math.min(lensFactor, focusFactor);
    }
    nodeOpacity.set(node.id, base * factor);
  }

  return { nodeOpacity, glow, pathSet };
};
