import type { FamilyDataV2 } from './types';

/** Serialize the dataset for Save/Export — refreshes the export timestamp. */
export const serialize = (raw: FamilyDataV2): string =>
  JSON.stringify(
    {
      meta: { schemaVersion: 2 as const, exportedAt: new Date().toISOString() },
      families: raw.families,
      people: raw.people,
      unions: raw.unions,
    },
    null,
    2,
  );
