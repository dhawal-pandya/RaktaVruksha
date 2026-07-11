import { useState } from 'react';
import { useStore } from '../state/store';

export default function Legend() {
  const dataset = useStore(s => s.dataset);
  const lensFamilyId = useStore(s => s.lensFamilyId);
  const family2d = useStore(s => s.family2d);
  const viewMode = useStore(s => s.viewMode);
  const setLens = useStore(s => s.setLens);
  const [openMobile, setOpenMobile] = useState(false);

  if (!dataset) return null;
  const families = Object.entries(dataset.raw.families).sort((a, b) =>
    a[1].name.localeCompare(b[1].name),
  );
  // In 2D the legend picks the single family shown; in 3D it toggles the lens.
  const activeId = viewMode === '2d' ? family2d : lensFamilyId;

  return (
    <aside className={`legend ${openMobile ? 'legend-open' : ''}`}>
      <button className="legend-toggle btn btn-subtle" onClick={() => setOpenMobile(v => !v)}>
        {openMobile ? '× Families' : `Families (${families.length})`}
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
          </button>
        ))}
      </div>
    </aside>
  );
}
