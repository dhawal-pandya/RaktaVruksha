import { useRef } from 'react';
import {
  isShowcase,
  SHOWCASE_LABELS,
  SHOWCASE_ORDER,
  useStore,
  type ShowcaseSource,
} from '../state/store';
import Legend from './Legend';
import SearchBar from './SearchBar';

export default function TopBar() {
  const relationActive = useStore(s => s.relation.active);
  const dirty = useStore(s => s.dirty);
  const isDraft = useStore(s => s.isDraft);
  const dataSource = useStore(s => s.dataSource);
  const openForm = useStore(s => s.openForm);
  const toggleRelationMode = useStore(s => s.toggleRelationMode);
  const importText = useStore(s => s.importText);
  const exportDownload = useStore(s => s.exportDownload);
  const saveToFile = useStore(s => s.saveToFile);
  const requestReset = useStore(s => s.requestReset);
  const fitView = useStore(s => s.fitView);
  const viewMode = useStore(s => s.viewMode);
  const toggleViewMode = useStore(s => s.toggleViewMode);
  const editUnlocked = useStore(s => s.editUnlocked);
  const lockEditing = useStore(s => s.lockEditing);
  const openFamilyEditor = useStore(s => s.openFamilyEditor);
  const gotoShowcase = useStore(s => s.gotoShowcase);

  const fileRef = useRef<HTMLInputElement>(null);

  // On a showcase lineage the wordmark's label doubles as the lineage picker, and
  // the 2D/3D toggle disappears, since those trees are 3D-only.
  const showcase = isShowcase(dataSource) ? dataSource : null;

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) importText(await file.text());
    e.target.value = '';
  };

  return (
    <header className="topbar">
      <div className="wordmark">
        <div className="wordmark-latin">Raktavruksha</div>
        <div className="wordmark-devanagari">रक्तवृक्ष</div>
        {showcase && (
          // A native <select> on purpose: it gets the platform's own picker, which
          // on a phone is a full-height wheel instead of a tiny custom menu.
          <label className="showcase-picker">
            <select
              className="showcase-select"
              value={showcase}
              onChange={e => gotoShowcase(e.target.value as ShowcaseSource)}
              aria-label="Choose a lineage"
            >
              {SHOWCASE_ORDER.map(key => (
                <option key={key} value={key}>
                  {SHOWCASE_LABELS[key].devanagari} {SHOWCASE_LABELS[key].latin}
                </option>
              ))}
            </select>
            <span className="showcase-caret" aria-hidden="true">
              ▾
            </span>
          </label>
        )}
      </div>

      <SearchBar />

      <nav className="topbar-actions">
        {!showcase && (
          <button
            className="btn"
            onClick={toggleViewMode}
            title={viewMode === '3d' ? 'Switch to 2D view' : 'Switch to 3D view'}
          >
            {viewMode === '3d' ? '2D' : '3D'}
          </button>
        )}
        <button className="btn" onClick={fitView} title="Fit the whole tree in view">
          ⌂ Fit
        </button>
        <button
          className={`btn ${relationActive ? 'btn-active' : ''}`}
          onClick={toggleRelationMode}
          title="Find the relationship between two people (r)"
        >
          Relation
        </button>
        <Legend />

        {/* Editing tools: only shown once unlocked with the edit key. Grouped so the
            mobile rules can leave them alone, since editing is a laptop-only job. */}
        {editUnlocked && (
          <div className="topbar-edit">
            <button className="btn" onClick={() => openForm('standalone')} title="Add a standalone person">
              + Add
            </button>
            <button className="btn" onClick={openFamilyEditor} title="Edit family names, colors, branches">
              Edit families
            </button>
            <button className="btn" onClick={() => fileRef.current?.click()} title="Merge a relative's file into yours">
              Import
            </button>
            <button className="btn" onClick={exportDownload} title="Download a copy to share">
              Export
            </button>
            <button className={`btn btn-primary ${dirty ? 'btn-dirty' : ''}`} onClick={() => void saveToFile()} title="Save as the default data file">
              Save{dirty && <span className="dirty-dot" />}
            </button>
            {isDraft && (
              <button className="btn btn-subtle" onClick={requestReset} title="Discard the draft and reload the saved file">
                Reset
              </button>
            )}
            <button className="btn btn-subtle" onClick={lockEditing} title="Hide editing tools">
              Lock
            </button>
            <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={e => void onFile(e)} />
          </div>
        )}
      </nav>
    </header>
  );
}
