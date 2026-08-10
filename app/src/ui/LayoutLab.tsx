import { useEffect, useRef, useState } from 'react';
import {
  DEFAULT_LAYOUT_TUNING,
  LAYOUT_TUNING,
  type LayoutTuning,
} from '../core/layoutTuning';
import { useStore } from '../state/store';

/**
 * Control surface for the 3D spread. Every slider writes straight into
 * LAYOUT_TUNING, re-runs the layout so the tree re-seats under the camera where it
 * stands, and — after a pause — writes public/layout.json back through the dev
 * server, exactly as editing a person writes family-data.json. Tune it locally,
 * commit the JSON, deploy: no rebuild, no code change.
 *
 * Gated on editUnlocked, which is itself DEV-only, so this is invisible without
 * ?edit=<key> on a local server and absent from the deployed bundle entirely.
 */

type Knob = { key: keyof LayoutTuning; label: string; min: number; max: number; step: number };

const GROUPS: { title: string; hint: string; knobs: Knob[] }[] = [
  {
    title: 'Spread',
    hint: 'How hard orbs push each other apart, and how far up and down the tree that push carries.',
    knobs: [
      { key: 'chargeStrength', label: 'charge', min: -1200, max: 0, step: 10 },
      { key: 'chargeDistanceMax', label: 'reach', min: 60, max: 1200, step: 10 },
      { key: 'chargeLayerBand', label: 'layer band', min: 0, max: 6, step: 1 },
    ],
  },
  {
    title: 'Descent',
    hint: 'Keeps children under their own parents, fanned out on a disc among their siblings.',
    knobs: [
      { key: 'descentPull', label: 'pull', min: 0, max: 1, step: 0.01 },
      { key: 'siblingSpacing', label: 'sibling gap', min: 0, max: 200, step: 2 },
    ],
  },
  {
    title: 'Families',
    hint: 'Where each family cluster sits and how tightly it holds together.',
    knobs: [
      { key: 'familyPull', label: 'pull', min: 0, max: 0.4, step: 0.005 },
      { key: 'familyRingScale', label: 'ring scale', min: 0, max: 120, step: 1 },
      { key: 'familyRingBase', label: 'ring base', min: 0, max: 400, step: 5 },
    ],
  },
  {
    title: 'Links',
    hint: 'Preferred lengths for the marriage and parent-child ties.',
    knobs: [
      { key: 'partnerDistance', label: 'partner dist', min: 5, max: 80, step: 1 },
      { key: 'partnerStrength', label: 'partner str', min: 0, max: 1, step: 0.05 },
      { key: 'childDistance', label: 'child dist', min: 10, max: 300, step: 2 },
      { key: 'childStrength', label: 'child str', min: 0, max: 1, step: 0.01 },
    ],
  },
  {
    title: 'Collision',
    hint: 'Hard minimum spacing. coupleCollideFactor below 2 breaks the couple-adjacency guarantee.',
    knobs: [
      { key: 'personCollide', label: 'person', min: 4, max: 60, step: 1 },
      { key: 'unionCollide', label: 'union', min: 1, max: 40, step: 1 },
      { key: 'coupleOffset', label: 'couple offset', min: 5, max: 60, step: 1 },
      { key: 'coupleCollideFactor', label: 'couple ×', min: 1, max: 4, step: 0.1 },
    ],
  },
  {
    title: 'Simulation',
    hint: 'More ticks settle further, at the cost of a slower relayout.',
    knobs: [
      { key: 'ticks', label: 'ticks', min: 40, max: 600, step: 10 },
      { key: 'ticksLarge', label: 'ticks (large)', min: 40, max: 600, step: 10 },
    ],
  },
];

export default function LayoutLab() {
  const commitLayoutTuning = useStore(s => s.commitLayoutTuning);
  const editUnlocked = useStore(s => s.editUnlocked);
  const layoutSave = useStore(s => s.layoutSave);
  const viewMode = useStore(s => s.viewMode);
  const [open, setOpen] = useState(false);
  const [, bump] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // A relayout on the deep lineages costs a couple of hundred milliseconds, which
  // is more than a slider drag emits, so coalesce the run to the end of the drag.
  const schedule = () => {
    bump(v => v + 1);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(commitLayoutTuning, 90);
  };

  useEffect(() => () => clearTimeout(timerRef.current), []);

  // Editing the layout is a local, unlocked-only job, and the dials only shape the
  // 3D view — 2D uses the tidy-tree packer, which has none of them.
  if (!editUnlocked || viewMode !== '3d') return null;

  if (!open)
    return (
      <button className="lab-toggle btn" onClick={() => setOpen(true)} title="3D layout dials — writes public/layout.json">
        ⚙ Layout
      </button>
    );

  return (
    <aside className="layout-lab panel">
      <header className="lab-head">
        <strong>Layout Lab</strong>
        <span className={`tag ${layoutSave === 'failed' ? 'lab-failed' : ''}`}>
          {layoutSave === 'saving' ? 'saving…' : layoutSave === 'failed' ? 'write failed' : 'layout.json'}
        </span>
        <button className="btn btn-icon" onClick={() => setOpen(false)} aria-label="Close">
          ×
        </button>
      </header>

      <div className="lab-body">
        {GROUPS.map(g => (
          <section key={g.title} className="lab-group">
            <h3 title={g.hint}>{g.title}</h3>
            {g.knobs.map(k => (
              <label key={k.key} className="lab-knob">
                <span className="lab-knob-name">{k.label}</span>
                <input
                  type="range"
                  min={k.min}
                  max={k.max}
                  step={k.step}
                  value={LAYOUT_TUNING[k.key]}
                  onChange={e => {
                    LAYOUT_TUNING[k.key] = Number(e.target.value);
                    schedule();
                  }}
                />
                <span className="lab-knob-value">{LAYOUT_TUNING[k.key]}</span>
              </label>
            ))}
          </section>
        ))}
      </div>

      <footer className="lab-actions">
        <span className="lab-note">saves to public/layout.json</span>
        <button
          className="btn btn-subtle"
          onClick={() => {
            Object.assign(LAYOUT_TUNING, DEFAULT_LAYOUT_TUNING);
            schedule();
          }}
          title="Back to the built-in defaults, and save those"
        >
          Reset
        </button>
      </footer>
    </aside>
  );
}
