import { useStore } from '../state/store';

export default function FamilyEditor() {
  const dataset = useStore(s => s.dataset);
  const open = useStore(s => s.familyEditorOpen);
  const close = useStore(s => s.closeFamilyEditor);
  const update = useStore(s => s.updateFamilyRecord);

  if (!open || !dataset) return null;
  const families = Object.entries(dataset.raw.families).sort((a, b) =>
    a[1].name.localeCompare(b[1].name),
  );

  return (
    <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && close()}>
      <div className="modal panel">
        <header className="detail-head">
          <h2 className="detail-name">Families</h2>
          <button className="btn btn-icon" onClick={close} aria-label="Close">
            ×
          </button>
        </header>
        <p className="muted">
          Color, name, and an optional branch/place to tell same-named lineages apart.
          Changes save automatically.
        </p>
        <div className="detail-body family-editor">
          {families.map(([id, f]) => {
            const dist = dataset.familyLabels.get(id)?.distinguisher;
            return (
              <div className="family-row" key={id}>
                <input
                  type="color"
                  value={f.color}
                  onChange={e => update(id, { color: e.target.value })}
                  title="Family color"
                />
                <input
                  className="fam-name-input"
                  defaultValue={f.name}
                  onBlur={e => e.target.value.trim() && update(id, { name: e.target.value.trim() })}
                  aria-label="Family name"
                />
                <input
                  className="fam-note-input"
                  defaultValue={f.note ?? ''}
                  placeholder={dist ? `auto: ${dist}` : 'branch / place'}
                  onBlur={e => update(id, { note: e.target.value })}
                  aria-label="Branch or place"
                />
                <span className="fam-count muted">{dataset.membersOfFamily.get(id)?.size ?? 0}</span>
              </div>
            );
          })}
        </div>
        <footer className="modal-actions">
          <button className="btn btn-primary" onClick={close}>
            Done
          </button>
        </footer>
      </div>
    </div>
  );
}
