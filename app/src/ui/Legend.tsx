import { useEffect, useRef, useState } from 'react';
import { useStore } from '../state/store';

export default function Legend() {
  const dataset = useStore(s => s.dataset);
  const lensFamilyId = useStore(s => s.lensFamilyId);
  const family2d = useStore(s => s.family2d);
  const viewMode = useStore(s => s.viewMode);
  const setLens = useStore(s => s.setLens);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLElement>(null);

  // Clicking anywhere outside (canvas, other HUD, top bar) closes the dropdown.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [open]);

  if (!dataset) return null;
  const families = Object.entries(dataset.raw.families).sort((a, b) =>
    a[1].name.localeCompare(b[1].name),
  );
  const label = (id: string) => dataset.familyLabels.get(id);
  // In 2D the legend picks the single family shown; in 3D it toggles the lens.
  const activeId = viewMode === '2d' ? family2d : lensFamilyId;

  return (
    <aside ref={rootRef} className={`legend ${open ? 'legend-open' : ''}`}>
      <button
        className="legend-toggle btn"
        onClick={() => setOpen(v => !v)}
        title={viewMode === '2d' ? 'Pick the family to view' : 'Spotlight a family'}
      >
        {open ? '× Families' : `Families (${families.length})`}
      </button>
      <div className="legend-body panel">
        {viewMode === '3d' && lensFamilyId && (
          <button className="legend-item legend-everyone" onClick={() => setLens(null)}>
            ⟲ Everyone
          </button>
        )}
        {families.map(([id, fam]) => (
          <button
            key={id}
            className={`legend-item ${activeId === id ? 'legend-active' : ''}`}
            onClick={() => setLens(viewMode === '3d' && activeId === id ? null : id)}
            title={`${dataset.membersOfFamily.get(id)?.size ?? 0} people born or married in`}
          >
            <span className="fam-dot" style={{ background: fam.color }} />
            <span>{fam.name}</span>
            {label(id)?.distinguisher && (
              <span className="legend-branch">{label(id)!.distinguisher}</span>
            )}
          </button>
        ))}
      </div>
    </aside>
  );
}
