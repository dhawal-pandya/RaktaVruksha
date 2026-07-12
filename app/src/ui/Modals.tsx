import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../state/store';
import { personName } from '../core/types';
import { mergeBlockReason } from '../core/mutate';

export function MergeReportModal() {
  const report = useStore(s => s.mergeReport);
  const close = useStore(s => s.closeMergeReport);
  if (!report) return null;
  const nothing =
    report.peopleAdded.length + report.peopleUpdated.length + report.unionsAdded + report.unionsUpdated + report.familiesAdded.length === 0;
  return (
    <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && close()}>
      <div className="modal panel">
        <header className="detail-head">
          <h2 className="detail-name">Merge report</h2>
          <button className="btn btn-icon" onClick={close} aria-label="Close">×</button>
        </header>
        {nothing ? (
          <p className="muted">Nothing new: your data already contains everything in that file.</p>
        ) : (
          <div className="detail-body">
            {report.familiesAdded.length > 0 && (
              <div className="detail-section">
                <h3>{report.familiesAdded.length} families added</h3>
                <p>{report.familiesAdded.join(', ')}</p>
              </div>
            )}
            {report.peopleAdded.length > 0 && (
              <div className="detail-section">
                <h3>{report.peopleAdded.length} people added</h3>
                <p>{report.peopleAdded.join(', ')}</p>
              </div>
            )}
            {report.peopleUpdated.length > 0 && (
              <div className="detail-section">
                <h3>{report.peopleUpdated.length} people updated</h3>
                <p>{report.peopleUpdated.join(', ')}</p>
              </div>
            )}
            {(report.unionsAdded > 0 || report.unionsUpdated > 0) && (
              <div className="detail-section">
                <h3>Unions</h3>
                <p>
                  {report.unionsAdded} added, {report.unionsUpdated} updated
                </p>
              </div>
            )}
            <p className="muted">Nothing was deleted: merges only add and update.</p>
          </div>
        )}
        <footer className="modal-actions">
          <button className="btn btn-primary" onClick={close}>Done</button>
        </footer>
      </div>
    </div>
  );
}

export function ImportErrorModal() {
  const errors = useStore(s => s.importErrors);
  const close = useStore(s => s.closeImportErrors);
  if (!errors) return null;
  return (
    <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && close()}>
      <div className="modal panel">
        <header className="detail-head">
          <h2 className="detail-name">Couldn't import that file</h2>
          <button className="btn btn-icon" onClick={close} aria-label="Close">×</button>
        </header>
        <ul className="error-list">
          {errors.slice(0, 8).map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
        <p className="muted">Your data was not changed.</p>
        <footer className="modal-actions">
          <button className="btn btn-primary" onClick={close}>OK</button>
        </footer>
      </div>
    </div>
  );
}

export function ConfirmResetModal() {
  const open = useStore(s => s.confirmReset);
  const cancel = useStore(s => s.cancelReset);
  const confirm = useStore(s => s.confirmResetNow);
  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && cancel()}>
      <div className="modal panel">
        <header className="detail-head">
          <h2 className="detail-name">Discard draft?</h2>
        </header>
        <p>
          This throws away every unsaved change and reloads the bundled data file. If you want to
          keep your edits, Save (or Export) first.
        </p>
        <footer className="modal-actions">
          <button className="btn btn-subtle" onClick={cancel}>Keep my draft</button>
          <button className="btn btn-danger" onClick={() => void confirm()}>Discard draft</button>
        </footer>
      </div>
    </div>
  );
}

export function ConfirmDeleteModal() {
  const dataset = useStore(s => s.dataset);
  const targetId = useStore(s => s.confirmDelete);
  const cancel = useStore(s => s.cancelDelete);
  const confirm = useStore(s => s.confirmDeleteNow);
  if (!targetId || !dataset) return null;
  const person = dataset.people.get(targetId);
  const name = person ? [person.firstName, person.lastName].filter(Boolean).join(' ') : targetId;
  const childCount = (dataset.childrenOf.get(targetId) ?? []).length;
  return (
    <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && cancel()}>
      <div className="modal panel">
        <header className="detail-head">
          <h2 className="detail-name">Delete {name}?</h2>
        </header>
        <p>
          {name} will be removed from the tree and from every marriage and parent link.
          {childCount > 0 && (
            <>
              {' '}
              Their {childCount} child{childCount > 1 ? 'ren' : ''} stay, but lose {name} as a parent.
            </>
          )}{' '}
          This can't be undone (but you haven't Saved yet: a reload restores the file).
        </p>
        <footer className="modal-actions">
          <button className="btn btn-subtle" onClick={cancel}>Cancel</button>
          <button className="btn btn-danger" onClick={confirm}>Delete</button>
        </footer>
      </div>
    </div>
  );
}

export function MergePersonModal() {
  const dataset = useStore(s => s.dataset);
  const raw = useStore(s => s.raw);
  const keepId = useStore(s => s.mergeKeepId);
  const cancel = useStore(s => s.cancelMerge);
  const confirm = useStore(s => s.confirmMerge);
  const [query, setQuery] = useState('');

  // Reset the picker each time the dialog opens for a different person.
  useEffect(() => {
    setQuery('');
  }, [keepId]);

  const options = useMemo(() => {
    if (!dataset || !keepId) return [];
    return dataset.raw.people
      .filter(p => p.id !== keepId)
      .map(p => ({ id: p.id, label: `${personName(p)}: ${p.id}` }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [dataset, keepId]);

  const absorbId = useMemo(
    () => options.find(o => o.label === query)?.id ?? null,
    [options, query],
  );

  if (!keepId || !dataset || !raw) return null;
  const keep = dataset.people.get(keepId);
  if (!keep) return null;

  const absorb = absorbId ? dataset.people.get(absorbId) : null;
  const blocked = absorbId ? mergeBlockReason(raw, keepId, absorbId) : null;

  // What currently hangs off the absorbed person and will move onto the kept one.
  const spouses = absorbId ? (dataset.spousesOf.get(absorbId) ?? []) : [];
  const children = absorbId ? (dataset.childrenOf.get(absorbId) ?? []) : [];
  const parents = absorbId ? (dataset.parentsOf.get(absorbId) ?? []) : [];
  const nameOf = (id: string) => {
    const p = dataset.people.get(id);
    return p ? personName(p) : id;
  };

  return (
    <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && cancel()}>
      <div className="modal panel">
        <header className="detail-head">
          <h2 className="detail-name">Merge someone into {personName(keep)}</h2>
          <button className="btn btn-icon" onClick={cancel} aria-label="Close">×</button>
        </header>

        <p className="muted">
          Use this when the same person was entered twice. The person you pick is
          absorbed into <strong>{personName(keep)}</strong> — their marriages, children and
          parents move over, and the duplicate record is deleted.
        </p>

        <label className="field">
          <span>Duplicate to absorb</span>
          <input
            list="rv-merge-people"
            placeholder="type the duplicate person's name…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
          />
          <datalist id="rv-merge-people">
            {options.map(o => (
              <option key={o.id} value={o.label} />
            ))}
          </datalist>
        </label>

        {absorb && blocked && <p className="form-error">{blocked}</p>}

        {absorb && !blocked && (
          <div className="detail-section">
            <h3>Moving onto {personName(keep)}</h3>
            {spouses.length + children.length + parents.length === 0 ? (
              <span className="muted">
                {personName(absorb)} has no relations to move — the record is just removed.
              </span>
            ) : (
              <>
                {spouses.length > 0 && (
                  <div className="children-label">
                    Marriage{spouses.length > 1 ? 's' : ''}: {spouses.map(s => nameOf(s.id)).join(', ')}
                  </div>
                )}
                {children.length > 0 && (
                  <div className="children-label">
                    {children.length} child{children.length > 1 ? 'ren' : ''}: {children.map(c => nameOf(c.id)).join(', ')}
                  </div>
                )}
                {parents.length > 0 && (
                  <div className="children-label">
                    Parent{parents.length > 1 ? 's' : ''}: {parents.map(p => nameOf(p.id)).join(', ')}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <footer className="modal-actions">
          <button className="btn btn-subtle" onClick={cancel}>Cancel</button>
          <button
            className="btn btn-danger"
            disabled={!absorbId || !!blocked}
            onClick={() => absorbId && confirm(absorbId)}
          >
            Merge & delete duplicate
          </button>
        </footer>
      </div>
    </div>
  );
}

export function Toast() {
  const toast = useStore(s => s.toast);
  const clear = useStore(s => s.clearToast);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(clear, 4200);
    return () => clearTimeout(t);
  }, [toast, clear]);
  if (!toast) return null;
  return <div className="toast panel">{toast}</div>;
}

export function Hint() {
  const dismissed = useStore(s => s.hintDismissed);
  const dismiss = useStore(s => s.dismissHint);
  if (dismissed) return null;
  return (
    <div className="hint panel">
      <span>
        click a person to focus · double-click to isolate their web · scroll to zoom · esc to step
        back
      </span>
      <button className="btn btn-icon" onClick={dismiss} aria-label="Dismiss hint">×</button>
    </div>
  );
}
