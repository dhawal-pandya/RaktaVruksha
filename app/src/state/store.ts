import { create } from 'zustand';
import type {
  Dataset,
  FamilyDataV2,
  Graph,
  KinStep,
  MergeReport,
  UnionStatus,
  Vec3,
} from '../core/types';
import { buildDataset } from '../core/dataset';
import { largestFamily, primaryFamilyOf } from '../core/family2d';
import { buildGraph } from '../core/graph';
import { computeLayout } from '../core/layout';
import { parseFamilyData, validateData } from '../core/validate';
import { mergeData } from '../core/merge';
import { serialize } from '../core/exporter';
import { nameRelation, shortestKinPath } from '../core/kinship';
import {
  addFamily,
  growChild,
  growParent,
  growSpouse,
  addPerson,
  updatePerson,
  updateUnion,
  type PersonFields,
} from '../core/mutate';
import {
  clearDraft,
  downloadFile,
  getSavedHandle,
  loadDraft,
  pickSaveFile,
  saveDraft,
  supportsFileSave,
  writeToHandle,
} from './persistence';

export type CameraRequest =
  | { seq: number; kind: 'person'; id: string }
  | { seq: number; kind: 'family'; id: string }
  | { seq: number; kind: 'component'; comp: number }
  | { seq: number; kind: 'fit' };

export interface RelationState {
  active: boolean;
  aId: string | null;
  bId: string | null;
  steps: KinStep[] | null;
  name: string | null;
  chain: { personId: string; label: string }[] | null;
  noRelation: boolean;
}

export type FormMode = 'standalone' | 'child' | 'spouse' | 'parent' | 'edit';

export interface FormPayload {
  fields: PersonFields;
  newFamily: { name: string; color: string } | null;
  unionId?: string | null;
  adopted?: boolean;
  existingId?: string | null;
  status?: UnionStatus;
  unionFamilyId?: string | null;
  unionStatusPatches?: { unionId: string; status: UnionStatus }[];
}

const emptyRelation: RelationState = {
  active: false,
  aId: null,
  bId: null,
  steps: null,
  name: null,
  chain: null,
  noRelation: false,
};

interface AppState {
  phase: 'loading' | 'ready' | 'error';
  loadError: string | null;
  dataSource: 'default' | 'stress';
  viewMode: '2d' | '3d';

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
  canFileSave: boolean;

  form: { mode: FormMode; anchorId: string | null } | null;
  formError: string | null;
  mergeReport: MergeReport | null;
  importErrors: string[] | null;
  confirmReset: boolean;
  hintDismissed: boolean;
  toast: string | null;

  boot: () => Promise<void>;
  toggleViewMode: () => void;
  clickPerson: (id: string) => void;
  focusPerson: (id: string) => void;
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

  importText: (text: string) => void;
  closeMergeReport: () => void;
  closeImportErrors: () => void;
  saveToFile: () => Promise<void>;
  exportDownload: () => void;
  requestReset: () => void;
  cancelReset: () => void;
  confirmResetNow: () => Promise<void>;
  dismissHint: () => void;
  clearToast: () => void;
}

type CameraRequestInput =
  | { kind: 'person'; id: string }
  | { kind: 'family'; id: string }
  | { kind: 'component'; comp: number }
  | { kind: 'fit' };

let cameraSeq = 0;
const cam = (req: CameraRequestInput): CameraRequest => ({ ...req, seq: ++cameraSeq });

const deriveAll = (raw: FamilyDataV2) => {
  const dataset = buildDataset(raw);
  const graph = buildGraph(dataset);
  const layout = computeLayout(graph);
  return { raw, dataset, graph, layout };
};

export const useStore = create<AppState>((set, get) => {
  /** Apply a data mutation: re-derive everything, autosave the draft. */
  const commit = (raw: FamilyDataV2) => {
    set({ ...deriveAll(raw), isDraft: true, dirty: true });
    void saveDraft(raw);
  };

  return {
    phase: 'loading',
    loadError: null,
    dataSource: 'default',
    viewMode:
      typeof localStorage !== 'undefined' && localStorage.getItem('rv-view') === '3d'
        ? '3d'
        : '2d',
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
    canFileSave: typeof window !== 'undefined' && supportsFileSave(),
    form: null,
    formError: null,
    mergeReport: null,
    importErrors: null,
    confirmReset: false,
    hintDismissed: typeof localStorage !== 'undefined' && localStorage.getItem('rv-hint') === '1',
    toast: null,

    boot: async () => {
      const params = new URLSearchParams(window.location.search);
      const dataSource = params.get('data') === 'stress' ? 'stress' : 'default';
      set({ dataSource });
      try {
        let raw: FamilyDataV2 | null = null;
        let isDraft = false;
        if (dataSource === 'default') {
          const draft = await loadDraft().catch(() => undefined);
          if (draft && validateData(draft).errors.length === 0) {
            raw = draft;
            isDraft = true;
          }
        }
        if (!raw) {
          const file = dataSource === 'stress' ? '/family-data.stress.json' : '/family-data.json';
          const res = await fetch(file);
          if (!res.ok) throw new Error(`could not load ${file} (${res.status})`);
          const parsed = parseFamilyData(await res.text());
          if (!parsed.raw) throw new Error(parsed.errors[0] ?? 'invalid data file');
          raw = parsed.raw;
        }
        const derived = deriveAll(raw);
        set({
          ...derived,
          phase: 'ready',
          isDraft,
          dirty: isDraft,
          family2d: largestFamily(derived.dataset),
          cameraRequest: cam({ kind: 'fit' }),
        });
      } catch (e) {
        set({ phase: 'error', loadError: (e as Error).message });
      }
    },

    clickPerson: id => {
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
            set({ relation: { ...r, bId: id, steps: null, name: null, chain: null, noRelation: true } });
          } else {
            const { name, chain } = nameRelation(s.dataset, r.aId, steps);
            set({
              relation: { ...r, bId: id, steps, name, chain, noRelation: false },
              cameraRequest: cam({ kind: 'fit' }),
            });
          }
        }
        return;
      }
      const lens = s.lensFamilyId;
      if (s.viewMode === '3d' && lens) {
        const p = s.dataset.people.get(id);
        const isMember = s.dataset.membersOfFamily.get(lens)?.has(id) ?? false;
        if (p && isMember && p.birthFamilyId && p.birthFamilyId !== lens) {
          // Married/adopted into the lens family → follow them home: switch lens to their birth family.
          set({
            lensFamilyId: p.birthFamilyId,
            focusId: id,
            cameraRequest: cam({ kind: 'family', id: p.birthFamilyId }),
          });
          return;
        }
      }
      get().focusPerson(id);
    },

    focusPerson: id => {
      const s = get();
      // In 2D (one family at a time), clicking anyone navigates to their birth
      // family (their lineage). Someone shown as a married-in/out spouse in the
      // current family takes you to the family they were born into — and the
      // person they married is in turn shown there, so you hop across families.
      if (s.viewMode === '2d' && s.dataset) {
        const fam = primaryFamilyOf(s.dataset, id);
        if (fam && fam !== s.family2d) set({ family2d: fam });
      }
      set({ focusId: id, cameraRequest: cam({ kind: 'person', id }) });
    },

    clearFocus: () => set({ focusId: null }),

    toggleViewMode: () => {
      const s = get();
      const next = s.viewMode === '3d' ? '2d' : '3d';
      localStorage.setItem('rv-view', next);
      const patch: Partial<AppState> = { viewMode: next };
      if (next === '2d' && !s.family2d && s.dataset) {
        patch.family2d =
          s.lensFamilyId ??
          (s.focusId ? primaryFamilyOf(s.dataset, s.focusId) : null) ??
          largestFamily(s.dataset);
      }
      set(patch);
      // Re-fit after the new renderer mounts and lays out.
      setTimeout(() => set({ cameraRequest: cam({ kind: 'fit' }) }), 400);
    },

    fitView: () => set({ cameraRequest: cam({ kind: 'fit' }) }),

    setLens: familyId => {
      const s = get();
      // In 2D, "select a family" chooses the single family to show.
      if (s.viewMode === '2d') {
        if (familyId) {
          set({ family2d: familyId, focusId: null, cameraRequest: cam({ kind: 'family', id: familyId }) });
        }
        return;
      }
      if (familyId) {
        set({ lensFamilyId: familyId, cameraRequest: cam({ kind: 'family', id: familyId }) });
      } else {
        set({ lensFamilyId: null, cameraRequest: cam({ kind: 'fit' }) });
      }
    },

    isolatePerson: id => {
      const s = get();
      const comp = s.dataset?.componentOf.get(id);
      if (comp === undefined) return;
      set({
        isolateComponent: comp,
        focusId: id,
        cameraRequest: cam({ kind: 'component', comp }),
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
        set({ isolateComponent: null, cameraRequest: cam({ kind: 'fit' }) });
      else if (s.focusId) set({ focusId: null });
      else if (s.lensFamilyId) set({ lensFamilyId: null, cameraRequest: cam({ kind: 'fit' }) });
    },

    toggleRelationMode: () => {
      const s = get();
      set({
        relation: s.relation.active ? emptyRelation : { ...emptyRelation, active: true },
        focusId: null,
      });
    },

    clearRelationPicks: () => set({ relation: { ...emptyRelation, active: true } }),

    openForm: (mode, anchorId = null) => set({ form: { mode, anchorId }, formError: null }),
    closeForm: () => set({ form: null, formError: null }),

    submitForm: payload => {
      const s = get();
      if (!s.raw || !s.form) return;
      try {
        let raw = s.raw;
        let fields = payload.fields;
        if (payload.newFamily) {
          const r = addFamily(raw, payload.newFamily.name, payload.newFamily.color);
          raw = r.raw;
          fields = { ...fields, birthFamilyId: r.familyId };
        }
        let newPersonId: string | null = null;
        const anchor = s.form.anchorId;
        switch (s.form.mode) {
          case 'standalone': {
            const r = addPerson(raw, fields);
            raw = r.raw;
            newPersonId = r.personId;
            break;
          }
          case 'child': {
            const r = growChild(raw, {
              parentId: anchor!,
              unionId: payload.unionId ?? null,
              adopted: payload.adopted ?? false,
              child: fields,
            });
            raw = r.raw;
            newPersonId = r.personId;
            break;
          }
          case 'spouse': {
            const r = growSpouse(raw, {
              anchorId: anchor!,
              existingId: payload.existingId ?? null,
              spouse: fields,
              status: payload.status ?? 'married',
              familyId: payload.unionFamilyId ?? null,
            });
            raw = r.raw;
            newPersonId = r.personId;
            break;
          }
          case 'parent': {
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
          case 'edit': {
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
          set({ focusId: newPersonId, cameraRequest: cam({ kind: 'person', id: newPersonId }) });
        }
      } catch (e) {
        set({ formError: (e as Error).message });
      }
    },

    importText: text => {
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
        set({ importErrors: ['merge would corrupt the dataset:', ...errors.slice(0, 8)] });
        return;
      }
      commit(merged);
      set({ mergeReport: report });
    },

    closeMergeReport: () => set({ mergeReport: null }),
    closeImportErrors: () => set({ importErrors: null }),

    saveToFile: async () => {
      const s = get();
      if (!s.raw) return;
      const text = serialize(s.raw);
      if (!s.canFileSave) {
        downloadFile('family-data.json', text);
        set({ dirty: false, toast: 'Downloaded — drop it into app/public/ to make it the default' });
        return;
      }
      let handle = await getSavedHandle().catch(() => undefined);
      if (!handle) handle = (await pickSaveFile()) ?? undefined;
      if (!handle) return; // cancelled
      const ok = await writeToHandle(handle, text);
      if (ok) {
        set({ dirty: false, toast: `Saved to ${handle.name}` });
      } else {
        downloadFile('family-data.json', text);
        set({ dirty: false, toast: 'File write failed — downloaded instead' });
      }
    },

    exportDownload: () => {
      const s = get();
      if (!s.raw) return;
      downloadFile('family-data-export.json', serialize(s.raw));
    },

    requestReset: () => set({ confirmReset: true }),
    cancelReset: () => set({ confirmReset: false }),
    confirmResetNow: async () => {
      await clearDraft().catch(() => undefined);
      set({ confirmReset: false, isDraft: false, dirty: false, focusId: null, lensFamilyId: null, isolateComponent: null, relation: emptyRelation, phase: 'loading' });
      await get().boot();
    },

    dismissHint: () => {
      localStorage.setItem('rv-hint', '1');
      set({ hintDismissed: true });
    },
    clearToast: () => set({ toast: null }),
  };
});
