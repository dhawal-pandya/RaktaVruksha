import type { Dataset, Graph, GraphLink, GraphNode } from "./types";
import { personName } from "./types";
import { displayFamilyOf } from "./dataset";
import { personColor } from "./colors";

export const unionNodeId = (unionId: string): string => `un:${unionId}`;

/** Radiant gold worn by every deva, regardless of lineage. */
export const DIVINE_COLOR = "#ffd76a";

/**
 * Dataset → renderable graph. Person nodes for every person; a union node for every
 * 2-partner union (the marriage bridge); 1-partner unions collapse to direct
 * parent→child links. Pure structure: no positions, no three.js.
 */
export const buildGraph = (ds: Dataset): Graph => {
  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];

  for (const p of ds.raw.people) {
    // A free-agent deva (one that fathers a divine child) clusters near — and
    // hovers just above — that child, so it borrows the child's family for
    // layout. A deva merely flagged divine but rooted in the tree (e.g. Chandra
    // Deva, an ancestor) keeps its own lineage.
    const divineChild = ds.divineChildrenOf.get(p.id)?.[0];
    const famId = divineChild
      ? displayFamilyOf(ds, divineChild)
      : displayFamilyOf(ds, p.id);
    const famColor = famId ? (ds.raw.families[famId]?.color ?? null) : null;
    nodes.push({
      id: p.id,
      kind: "person",
      personId: p.id,
      label: personName(p),
      color: p.divine ? DIVINE_COLOR : personColor(famColor, p.alive),
      gen: ds.generations.get(p.id) ?? 0,
      familyId: famId,
      alive: p.alive,
      gender: p.gender,
      ...(p.divine ? { divine: true } : {}),
    });
  }

  // Free-agent divine parentage: a distinct ray from each deva down to its child.
  for (const p of ds.raw.people) {
    for (const dp of p.divineParents ?? []) {
      if (ds.people.has(dp)) links.push({ source: dp, target: p.id, kind: "divine" });
    }
  }

  for (const u of ds.raw.unions) {
    const partners = u.partners.filter((id) => ds.people.has(id));
    const bioKids = u.children.filter((id) => ds.people.has(id));
    const adoptedKids = (u.adoptedChildren ?? []).filter((id) =>
      ds.people.has(id),
    );

    if (partners.length === 2) {
      const gen = Math.max(
        ...partners.map((id) => ds.generations.get(id) ?? 0),
      );
      const unId = unionNodeId(u.id);
      nodes.push({
        id: unId,
        kind: "union",
        unionId: u.id,
        gen,
        status: u.status,
        familyId: u.familyId ?? displayFamilyOf(ds, partners[0]),
        order: u.order,
      });
      for (const pid of partners) {
        links.push({
          source: pid,
          target: unId,
          kind: "partner",
          status: u.status,
        });
      }
      for (const kid of bioKids) {
        links.push({
          source: unId,
          target: kid,
          kind: "child",
          tag: "biological",
        });
      }
      for (const kid of adoptedKids) {
        links.push({
          source: unId,
          target: kid,
          kind: "child",
          tag: "adoptive",
        });
      }
    } else if (partners.length === 1) {
      for (const kid of bioKids) {
        links.push({
          source: partners[0],
          target: kid,
          kind: "child",
          tag: "biological",
        });
      }
      for (const kid of adoptedKids) {
        links.push({
          source: partners[0],
          target: kid,
          kind: "child",
          tag: "adoptive",
        });
      }
    }
  }

  return { nodes, links };
};
