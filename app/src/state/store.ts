import { create } from "zustand";
import type {
  Dataset,
  FamilyDataV2,
  Graph,
  KinStep,
  MergeReport,
  UnionStatus,
  Vec3,
} from "../core/types";
import { buildDataset } from "../core/dataset";
import { largestFamily, primaryFamilyOf } from "../core/family2d";
import { buildGraph } from "../core/graph";
import { computeLayout } from "../core/layout";
import { parseFamilyData, validateData } from "../core/validate";
import { mergeData } from "../core/merge";
import { serialize } from "../core/exporter";
import { nameRelation, shortestKinPath } from "../core/kinship";
import {
  addFamily,
  deletePerson,
  growChild,
  growParent,
  growSpouse,
  mergePerson,
  moveChildInUnion,
  addPerson,
  updateFamily,
  updatePerson,
  updateUnion,
  type PersonFields,
} from "../core/mutate";
import type { FamilyRecord } from "../core/types";

// Secret that unlocks editing via ?edit=<key>. Edit tools are gated purely on
// this URL param each load — never persisted — so the app defaults to a plain
// viewing platform for anyone without the link.
const EDIT_KEY = "durga";
// Editing exists only on the local dev server, where changes write through to
// public/family-data.json. The deployed site is a read-only viewer: no edit
// unlock, no browser-side persistence.
const computeEditUnlocked = (): boolean => {
  if (!import.meta.env.DEV || typeof window === "undefined") return false;
  try {
    return new URLSearchParams(window.location.search).get("edit") === EDIT_KEY;
  } catch {
    return false;
  }
};
import { downloadFile, purgeLegacyBrowserData } from "./persistence";

export type CameraRequest =
  | { seq: number; kind: "person"; id: string }
  | { seq: number; kind: "family"; id: string }
  | { seq: number; kind: "component"; comp: number }
  | { seq: number; kind: "fit" };

export interface RelationState {
  active: boolean;
  aId: string | null;
  bId: string | null;
  steps: KinStep[] | null;
  name: string | null;
  /** Sanskrit (Gujarati) term for the relation, when we have one. */
  local: string | null;
  chain: { personId: string; label: string }[] | null;
  noRelation: boolean;
}

export type FormMode = "standalone" | "child" | "spouse" | "parent" | "edit";

export interface FormPayload {
  fields: PersonFields;
  newFamily: { name: string; color: string; note?: string } | null;
  unionId?: string | null;
  adopted?: boolean;
  existingId?: string | null;
  status?: UnionStatus;
  unionFamilyId?: string | null;
  unionStatusPatches?: { unionId: string; status: UnionStatus }[];
  /** +Spouse: existing children of the anchor to also assign to this marriage. */
  childIds?: string[];
}

const emptyRelation: RelationState = {
  active: false,
  aId: null,
  bId: null,
  steps: null,
  name: null,
  local: null,
  chain: null,
  noRelation: false,
};

// Alternate datasets live beside the default file and are selected with ?data=<key>.
// The default (no param) is always my real family; extend this map to add more.
export type DataSource = "default" | "stress" | "mahabharat" | "ramayan";
const DATA_FILES: Record<DataSource, string> = {
  default: "family-data.json",
  stress: "family-data.stress.json",
  mahabharat: "family-data.mahabharat.json",
  ramayan: "family-data.ramayan.json",
};

interface AppState {
  phase: "loading" | "ready" | "error";
  loadError: string | null;
  dataSource: DataSource;
  viewMode: "2d" | "3d";

  raw: FamilyDataV2 | null;
  dataset: Dataset | null;
  graph: Graph | null;
  layout: Map<string, Vec3> | null;

  focusId: string | null;
  lensFamilyId: string | null;
  /** The single family shown in 2D mode (2D shows one family at a time). */
  family2d: string | null;
  isolateComponent: number | null;
  relation: RelationState;
  cameraRequest: CameraRequest | null;

  isDraft: boolean;
  dirty: boolean;
  /** When family-data.json was last modified (epoch ms), from the fetch response. */
  dataUpdatedAt: number | null;
  /** True when the hidden edit key has unlocked writing/import/export. */
  editUnlocked: boolean;

  form: { mode: FormMode; anchorId: string | null } | null;
  formError: string | null;
  mergeReport: MergeReport | null;
  importErrors: string[] | null;
  confirmReset: boolean;
  confirmDelete: string | null;
  /** Person kept when a "same person" merge dialog is open; the other is absorbed. */
  mergeKeepId: string | null;
  familyEditorOpen: boolean;
  hintDismissed: boolean;
  toast: string | null;

  boot: () => Promise<void>;
  toggleViewMode: () => void;
  clickPerson: (id: string) => void;
  focusPerson: (id: string) => void;
  showPersonIn3D: (id: string) => void;
  fitView: () => void;
  clearFocus: () => void;
  setLens: (familyId: string | null) => void;
  isolatePerson: (id: string) => void;
  backgroundClick: () => void;
  escape: () => void;

  toggleRelationMode: () => void;
  clearRelationPicks: () => void;

  openForm: (mode: FormMode, anchorId?: string | null) => void;
  closeForm: () => void;
  submitForm: (payload: FormPayload) => void;
  requestDelete: (id: string) => void;
  cancelDelete: () => void;
  confirmDeleteNow: () => void;
  openMerge: (keepId: string) => void;
  cancelMerge: () => void;
  confirmMerge: (absorbId: string) => void;
  reorderChild: (unionId: string, childId: string, dir: -1 | 1) => void;
  openFamilyEditor: () => void;
  closeFamilyEditor: () => void;
  updateFamilyRecord: (familyId: string, patch: Partial<FamilyRecord>) => void;
  lockEditing: () => void;

  importText: (text: string) => void;
  closeMergeReport: () => void;
  closeImportErrors: () => void;
  saveToFile: () => Promise<void>;
  exportDownload: () => void;
  requestReset: () => void;
  cancelReset: () => void;
  confirmResetNow: () => Promise<void>;
  dismissHint: () => void;
  showToast: (msg: string) => void;
  clearToast: () => void;
}

type CameraRequestInput =
  | { kind: "person"; id: string }
  | { kind: "family"; id: string }
  | { kind: "component"; comp: number }
  | { kind: "fit" };

let cameraSeq = 0;
const cam = (req: CameraRequestInput): CameraRequest => ({
  ...req,
  seq: ++cameraSeq,
});

// The family currently on screen is mirrored into this URL param (via
// replaceState, so it never grows browser history) so copying the address bar
// shares the same family with whoever opens the link.
const FAMILY_PARAM = "family";
const syncFamilyParam = (familyId: string | null) => {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (familyId) url.searchParams.set(FAMILY_PARAM, familyId);
  else url.searchParams.delete(FAMILY_PARAM);
  window.history.replaceState(null, "", url);
};

const deriveAll = (raw: FamilyDataV2) => {
  const dataset = buildDataset(raw);
  const graph = buildGraph(dataset);
  const layout = computeLayout(graph);
  return { raw, dataset, graph, layout };
};

// On the local dev server, edits can be written straight to public/family-data.json
// via the dev-only /__save-data endpoint (see vite.config.ts): no export needed.
// In production this route doesn't exist, so callers fall back to download/export.
const DEV = import.meta.env.DEV;
const postDataFile = async (text: string): Promise<boolean> => {
  try {
    const res = await fetch("/__save-data", { method: "POST", body: text });
    return res.ok;
  } catch {
    return false;
  }
};

export const useStore = create<AppState>((set, get) => {
  // Debounced write-through to family-data.json on the dev server (local editing).
  let devWriteTimer: ReturnType<typeof setTimeout> | undefined;
  const scheduleDevWrite = (raw: FamilyDataV2) => {
    if (devWriteTimer) clearTimeout(devWriteTimer);
    devWriteTimer = setTimeout(async () => {
      const ok = await postDataFile(serialize(raw));
      if (ok) set({ dirty: false });
    }, 700);
  };

  /** Apply a data mutation: re-derive everything and write through to
   *  family-data.json on the dev server. The file is the only persistence:
   *  nothing is ever stored in the browser. */
  const commit = (raw: FamilyDataV2) => {
    set({ ...deriveAll(raw), isDraft: true, dirty: true });
    if (get().editUnlocked) scheduleDevWrite(raw);
  };

  return {
    phase: "loading",
    loadError: null,
    dataSource: "default",
    viewMode: "2d",
    raw: null,
    dataset: null,
    graph: null,
    layout: null,
    focusId: null,
    lensFamilyId: null,
    family2d: null,
    isolateComponent: null,
    relation: emptyRelation,
    cameraRequest: null,
    isDraft: false,
    dirty: false,
    dataUpdatedAt: null,
    editUnlocked: computeEditUnlocked(),
    confirmDelete: null,
    mergeKeepId: null,
    familyEditorOpen: false,
    form: null,
    formError: null,
    mergeReport: null,
    importErrors: null,
    confirmReset: false,
    hintDismissed: false,
    toast: null,

    boot: async () => {
      const params = new URLSearchParams(window.location.search);
      const requested = params.get("data");
      const dataSource: DataSource =
        requested === "stress" ||
        requested === "mahabharat" ||
        requested === "ramayan"
          ? requested
          : "default";
      set({ dataSource });
      // Older builds stored a data draft in IndexedDB that shadowed the deployed
      // file forever. Clean out anything they left behind so every visitor is
      // unpinned from stale data on their next load.
      purgeLegacyBrowserData();
      try {
        // family-data.json is the single source of truth: always fetch it.
        // Relative to BASE_URL so it resolves under a GitHub Pages subpath too;
        // 'no-cache' revalidates against the server (cheap 304 when unchanged)
        // so a plain refresh always shows the latest deployed data.
        const base = import.meta.env.BASE_URL;
        const file = base + DATA_FILES[dataSource];
        const res = await fetch(file, { cache: "no-cache" });
        if (!res.ok)
          throw new Error(`could not load ${file} (${res.status})`);
        const lastModified = Date.parse(res.headers.get("last-modified") ?? "");
        const parsed = parseFamilyData(await res.text());
        if (!parsed.raw)
          throw new Error(parsed.errors[0] ?? "invalid data file");
        const raw = parsed.raw;
        const derived = deriveAll(raw);
        const requestedFamily = params.get(FAMILY_PARAM);
        const sharedFamily =
          requestedFamily && derived.dataset.raw.families[requestedFamily]
            ? requestedFamily
            : null;
        const is3d = get().viewMode === "3d";
        set({
          ...derived,
          phase: "ready",
          isDraft: false,
          dirty: false,
          dataUpdatedAt: Number.isNaN(lastModified) ? null : lastModified,
          family2d: sharedFamily ?? largestFamily(derived.dataset),
          lensFamilyId: is3d ? sharedFamily : null,
          cameraRequest:
            sharedFamily && is3d
              ? cam({ kind: "family", id: sharedFamily })
              : cam({ kind: "fit" }),
          toast:
            DEV && get().editUnlocked
              ? "Local edit mode: changes autosave to family-data.json"
              : null,
        });
      } catch (e) {
        set({ phase: "error", loadError: (e as Error).message });
      }
    },

    clickPerson: (id) => {
      const s = get();
      if (!s.dataset) return;
      if (s.relation.active) {
        // Pick A, then B; picking again restarts from the new person.
        const r = s.relation;
        if (!r.aId || (r.aId && r.bId)) {
          set({ relation: { ...emptyRelation, active: true, aId: id } });
        } else if (id !== r.aId) {
          const steps = shortestKinPath(s.dataset, r.aId, id);
          if (steps === null) {
            set({
              relation: {
                ...r,
                bId: id,
                steps: null,
                name: null,
                local: null,
                chain: null,
                noRelation: true,
              },
            });
          } else {
            const { name, local, chain } = nameRelation(s.dataset, r.aId, steps);
            set({
              relation: {
                ...r,
                bId: id,
                steps,
                name,
                local,
                chain,
                noRelation: false,
              },
              cameraRequest: cam({ kind: "fit" }),
            });
          }
        }
        return;
      }
      const lens = s.lensFamilyId;
      if (s.viewMode === "3d" && lens) {
        const p = s.dataset.people.get(id);
        const isMember = s.dataset.membersOfFamily.get(lens)?.has(id) ?? false;
        if (p && isMember && p.birthFamilyId && p.birthFamilyId !== lens) {
          // Married/adopted into the lens family → follow them home: switch lens to their birth family.
          set({
            lensFamilyId: p.birthFamilyId,
            focusId: id,
            cameraRequest: cam({ kind: "family", id: p.birthFamilyId }),
          });
          return;
        }
      }
      get().focusPerson(id);
    },

    focusPerson: (id) => {
      const s = get();
      // In 2D (one family at a time), clicking anyone navigates to their birth
      // family (their lineage). Someone shown as a married-in/out spouse in the
      // current family takes you to the family they were born into: and the
      // person they married is in turn shown there, so you hop across families.
      if (s.viewMode === "2d" && s.dataset) {
        const fam = primaryFamilyOf(s.dataset, id);
        if (fam && fam !== s.family2d) set({ family2d: fam });
      }
      set({ focusId: id, cameraRequest: cam({ kind: "person", id }) });
    },

    // Focus a person and make sure they are shown in the 3D view, switching from
    // 2D if needed and framing the camera once the 3D scene has mounted.
    showPersonIn3D: (id) => {
      const s = get();
      if (!s.dataset || !s.dataset.people.has(id)) return;
      if (s.viewMode === "3d") {
        set({ focusId: id, cameraRequest: cam({ kind: "person", id }) });
        return;
      }
      set({ viewMode: "3d", focusId: id });
      // Wait for the 3D renderer to mount before framing the person.
      setTimeout(() => set({ cameraRequest: cam({ kind: "person", id }) }), 500);
    },

    clearFocus: () => set({ focusId: null }),

    toggleViewMode: () => {
      const s = get();
      const next = s.viewMode === "3d" ? "2d" : "3d";
      const patch: Partial<AppState> = { viewMode: next };
      if (next === "2d" && !s.family2d && s.dataset) {
        patch.family2d =
          s.lensFamilyId ??
          (s.focusId ? primaryFamilyOf(s.dataset, s.focusId) : null) ??
          largestFamily(s.dataset);
      }
      set(patch);
      // Re-fit after the new renderer mounts and lays out.
      setTimeout(() => set({ cameraRequest: cam({ kind: "fit" }) }), 400);
    },

    fitView: () => set({ cameraRequest: cam({ kind: "fit" }) }),

    setLens: (familyId) => {
      const s = get();
      // In 2D, "select a family" chooses the single family to show.
      if (s.viewMode === "2d") {
        if (familyId) {
          set({
            family2d: familyId,
            focusId: null,
            cameraRequest: cam({ kind: "family", id: familyId }),
          });
        }
        return;
      }
      if (familyId) {
        set({
          lensFamilyId: familyId,
          cameraRequest: cam({ kind: "family", id: familyId }),
        });
      } else {
        set({ lensFamilyId: null, cameraRequest: cam({ kind: "fit" }) });
      }
    },

    isolatePerson: (id) => {
      const s = get();
      const comp = s.dataset?.componentOf.get(id);
      if (comp === undefined) return;
      set({
        isolateComponent: comp,
        focusId: id,
        cameraRequest: cam({ kind: "component", comp }),
      });
    },

    backgroundClick: () => {
      const s = get();
      if (s.relation.active) return;
      if (s.focusId) set({ focusId: null });
    },

    escape: () => {
      const s = get();
      if (s.form) set({ form: null, formError: null });
      else if (s.mergeReport) set({ mergeReport: null });
      else if (s.importErrors) set({ importErrors: null });
      else if (s.confirmReset) set({ confirmReset: false });
      else if (s.relation.active) set({ relation: emptyRelation });
      else if (s.isolateComponent !== null)
        set({ isolateComponent: null, cameraRequest: cam({ kind: "fit" }) });
      else if (s.focusId) set({ focusId: null });
      else if (s.lensFamilyId)
        set({ lensFamilyId: null, cameraRequest: cam({ kind: "fit" }) });
    },

    toggleRelationMode: () => {
      const s = get();
      set({
        relation: s.relation.active
          ? emptyRelation
          : { ...emptyRelation, active: true },
        focusId: null,
      });
    },

    clearRelationPicks: () =>
      set({ relation: { ...emptyRelation, active: true } }),

    openForm: (mode, anchorId = null) =>
      set({ form: { mode, anchorId }, formError: null }),
    closeForm: () => set({ form: null, formError: null }),

    submitForm: (payload) => {
      const s = get();
      if (!s.raw || !s.form) return;
      try {
        let raw = s.raw;
        let fields = payload.fields;
        let createdFamilyId: string | null = null;
        if (payload.newFamily) {
          const r = addFamily(
            raw,
            payload.newFamily.name,
            payload.newFamily.color,
            payload.newFamily.note,
          );
          raw = r.raw;
          createdFamilyId = r.familyId;
          fields = { ...fields, birthFamilyId: r.familyId };
        }
        let newPersonId: string | null = null;
        const anchor = s.form.anchorId;
        switch (s.form.mode) {
          case "standalone": {
            const r = addPerson(raw, fields);
            raw = r.raw;
            newPersonId = r.personId;
            break;
          }
          case "child": {
            const r = growChild(raw, {
              parentId: anchor!,
              unionId: payload.unionId ?? null,
              adopted: payload.adopted ?? false,
              existingId: payload.existingId ?? null,
              child: fields,
            });
            raw = r.raw;
            newPersonId = r.personId;
            break;
          }
          case "spouse": {
            // "__spouse__" means the children take the spouse's own family: resolve
            // it to the newly created family, or the existing spouse's birth family.
            let unionFamilyId = payload.unionFamilyId ?? null;
            if (unionFamilyId === "__spouse__") {
              const existingSpouse = payload.existingId
                ? (s.dataset?.people.get(payload.existingId)?.birthFamilyId ??
                  null)
                : null;
              unionFamilyId =
                createdFamilyId ?? fields.birthFamilyId ?? existingSpouse;
            }
            const r = growSpouse(raw, {
              anchorId: anchor!,
              existingId: payload.existingId ?? null,
              spouse: fields,
              status: payload.status ?? "married",
              familyId: unionFamilyId,
              childIds: payload.childIds ?? [],
            });
            raw = r.raw;
            newPersonId = r.personId;
            break;
          }
          case "parent": {
            const r = growParent(raw, {
              childId: anchor!,
              adoptive: payload.adopted ?? false,
              existingId: payload.existingId ?? null,
              parent: fields,
            });
            raw = r.raw;
            newPersonId = r.personId;
            break;
          }
          case "edit": {
            raw = updatePerson(raw, anchor!, fields);
            for (const patch of payload.unionStatusPatches ?? []) {
              raw = updateUnion(raw, patch.unionId, { status: patch.status });
            }
            newPersonId = anchor;
            break;
          }
        }
        const { errors } = validateData(raw);
        if (errors.length) throw new Error(errors[0]);
        commit(raw);
        set({ form: null, formError: null });
        if (newPersonId) {
          set({
            focusId: newPersonId,
            cameraRequest: cam({ kind: "person", id: newPersonId }),
          });
        }
      } catch (e) {
        set({ formError: (e as Error).message });
      }
    },

    importText: (text) => {
      const s = get();
      if (!s.raw) return;
      const parsed = parseFamilyData(text);
      if (!parsed.raw) {
        set({ importErrors: parsed.errors });
        return;
      }
      const { merged, report } = mergeData(s.raw, parsed.raw);
      const { errors } = validateData(merged);
      if (errors.length) {
        set({
          importErrors: [
            "merge would corrupt the dataset:",
            ...errors.slice(0, 8),
          ],
        });
        return;
      }
      commit(merged);
      set({ mergeReport: report });
    },

    closeMergeReport: () => set({ mergeReport: null }),
    closeImportErrors: () => set({ importErrors: null }),

    // Dev-only (editing exists only there): write straight to
    // public/family-data.json via the dev endpoint.
    saveToFile: async () => {
      const s = get();
      if (!s.raw) return;
      if (devWriteTimer) clearTimeout(devWriteTimer);
      const ok = await postDataFile(serialize(s.raw));
      set({
        dirty: false,
        toast: ok
          ? "Saved to public/family-data.json"
          : "Could not reach the dev server to save",
      });
    },

    exportDownload: () => {
      const s = get();
      if (!s.raw) return;
      downloadFile("family-data-export.json", serialize(s.raw));
    },

    requestReset: () => set({ confirmReset: true }),
    cancelReset: () => set({ confirmReset: false }),
    confirmResetNow: async () => {
      set({
        confirmReset: false,
        isDraft: false,
        dirty: false,
        focusId: null,
        lensFamilyId: null,
        isolateComponent: null,
        relation: emptyRelation,
        phase: "loading",
      });
      await get().boot();
    },

    requestDelete: (id) => set({ confirmDelete: id }),
    cancelDelete: () => set({ confirmDelete: null }),

    reorderChild: (unionId, childId, dir) => {
      const s = get();
      if (!s.raw) return;
      commit(moveChildInUnion(s.raw, unionId, childId, dir));
    },

    openFamilyEditor: () => set({ familyEditorOpen: true }),
    closeFamilyEditor: () => set({ familyEditorOpen: false }),
    updateFamilyRecord: (familyId, patch) => {
      const s = get();
      if (!s.raw) return;
      commit(updateFamily(s.raw, familyId, patch));
    },

    confirmDeleteNow: () => {
      const s = get();
      if (!s.raw || !s.confirmDelete) return;
      const next = deletePerson(s.raw, s.confirmDelete);
      commit(next);
      set({ confirmDelete: null, focusId: null, form: null });
    },

    openMerge: (keepId) => set({ mergeKeepId: keepId }),
    cancelMerge: () => set({ mergeKeepId: null }),
    confirmMerge: (absorbId) => {
      const s = get();
      if (!s.raw || !s.mergeKeepId) return;
      try {
        const next = mergePerson(s.raw, s.mergeKeepId, absorbId);
        const { errors } = validateData(next);
        if (errors.length) throw new Error(errors[0]);
        commit(next);
        set({
          mergeKeepId: null,
          focusId: s.mergeKeepId,
          cameraRequest: cam({ kind: "person", id: s.mergeKeepId }),
        });
      } catch (e) {
        set({ mergeKeepId: null, toast: `Merge failed: ${(e as Error).message}` });
      }
    },

    lockEditing: () => {
      set({ editUnlocked: false, form: null, confirmDelete: null, mergeKeepId: null });
    },

    dismissHint: () => set({ hintDismissed: true }),
    showToast: (msg) => set({ toast: msg }),
    clearToast: () => set({ toast: null }),
  };
});

// Keep the URL's family param mirroring whatever family is on screen — in 2D
// that's family2d, in 3D the lens (null lens means "everyone", so no param).
useStore.subscribe((state, prev) => {
  if (
    state.family2d !== prev.family2d ||
    state.lensFamilyId !== prev.lensFamilyId ||
    state.viewMode !== prev.viewMode
  ) {
    syncFamilyParam(state.viewMode === "2d" ? state.family2d : state.lensFamilyId);
  }
});
