import type { FamilyDataV2, MergeReport } from "./types";
import { personName } from "./types";

/**
 * Additive merge of an incoming file into the local dataset.
 * Unknown ids are added; known ids are updated only if the incoming record is
 * newer (updatedAt); nothing is ever deleted; family conflicts keep local values.
 */
export const mergeData = (
  local: FamilyDataV2,
  incoming: FamilyDataV2,
): { merged: FamilyDataV2; report: MergeReport } => {
  const report: MergeReport = {
    peopleAdded: [],
    peopleUpdated: [],
    unionsAdded: 0,
    unionsUpdated: 0,
    familiesAdded: [],
  };

  const families = { ...local.families };
  for (const [id, fam] of Object.entries(incoming.families)) {
    if (!(id in families)) {
      families[id] = fam;
      report.familiesAdded.push(fam.name);
    }
    // Known family: keep local name/color: the owner's palette wins.
  }

  const people = [...local.people];
  const personIdx = new Map(people.map((p, i) => [p.id, i]));
  for (const inc of incoming.people) {
    const idx = personIdx.get(inc.id);
    if (idx === undefined) {
      people.push(inc);
      personIdx.set(inc.id, people.length - 1);
      report.peopleAdded.push(personName(inc));
    } else if (inc.updatedAt > people[idx].updatedAt) {
      people[idx] = inc;
      report.peopleUpdated.push(personName(inc));
    }
  }

  const unions = [...local.unions];
  const unionIdx = new Map(unions.map((u, i) => [u.id, i]));
  for (const inc of incoming.unions) {
    const idx = unionIdx.get(inc.id);
    if (idx === undefined) {
      unions.push(inc);
      unionIdx.set(inc.id, unions.length - 1);
      report.unionsAdded++;
    } else if (inc.updatedAt > unions[idx].updatedAt) {
      unions[idx] = inc;
      report.unionsUpdated++;
    }
  }

  return { merged: { meta: local.meta, families, people, unions }, report };
};
