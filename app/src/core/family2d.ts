import type { Dataset, Graph } from './types';
import { unionNodeId } from './graph';
import { displayFamilyOf } from './dataset';

export interface FamilyView {
  /** Node ids (persons + union nodes) to render for this family. */
  nodeIds: Set<string>;
  /** Persons shown but not part of this family — spouses who married in/out elsewhere. */
  external: Set<string>;
}

/**
 * The subgraph to show when viewing a single family in 2D:
 *  - everyone born, married, or adopted into the family (its members);
 *  - the spouse of any member whose marriage points outside the family — so a
 *    daughter (or son) who married away still shows, with their partner as an
 *    external leaf you can click to jump to that family;
 *  - the union nodes joining any two visible people.
 * Children that belong to another family (an out-married couple's kids) are not
 * pulled in — they live in that other family's view.
 */
export const familyView = (dataset: Dataset, familyId: string): FamilyView => {
  const members = dataset.membersOfFamily.get(familyId) ?? new Set<string>();
  const persons = new Set<string>(members);
  const external = new Set<string>();

  for (const pid of members) {
    for (const uid of dataset.unionsOf.get(pid) ?? []) {
      const u = dataset.unions.get(uid);
      if (!u) continue;
      for (const partner of u.partners) {
        if (!members.has(partner) && dataset.people.has(partner)) {
          persons.add(partner);
          external.add(partner);
        }
      }
    }
  }

  const nodeIds = new Set<string>(persons);
  for (const u of dataset.raw.unions) {
    if (u.partners.length === 2 && u.partners.every(p => persons.has(p))) {
      nodeIds.add(unionNodeId(u.id));
    }
  }
  return { nodeIds, external };
};

/** Restrict a full graph to the nodes/links a family view shows. */
export const subgraphForFamily = (graph: Graph, view: FamilyView): Graph => {
  const nodes = graph.nodes.filter(n => view.nodeIds.has(n.id));
  const links = graph.links.filter(
    l => view.nodeIds.has(l.source) && view.nodeIds.has(l.target),
  );
  return { nodes, links };
};

/** The family whose tree a person sits in for the 2D view: their lineage if
 *  known, else the family they married into. */
export const primaryFamilyOf = (dataset: Dataset, personId: string): string | null => {
  const lineage = displayFamilyOf(dataset, personId);
  if (lineage) return lineage;
  return dataset.familiesOf.get(personId)?.[0]?.familyId ?? null;
};

/** Default family to open the 2D view on: the one with the most people. */
export const largestFamily = (dataset: Dataset): string | null => {
  let best: string | null = null;
  let bestN = -1;
  for (const [fid, set] of dataset.membersOfFamily) {
    if (set.size > bestN) {
      bestN = set.size;
      best = fid;
    }
  }
  return best;
};
