import { useRef } from 'react';
import { useStore } from '../state/store';
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

  const fileRef = useRef<HTMLInputElement>(null);

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
        {dataSource === 'stress' && <span className="badge badge-stress">stress</span>}
      </div>

      <SearchBar />

      <nav className="topbar-actions">
        <button
          className="btn"
          onClick={toggleViewMode}
          title={viewMode === '3d' ? 'Switch to 2D view' : 'Switch to 3D view'}
        >
          {viewMode === '3d' ? '2D' : '3D'}
        </button>
        <button className="btn" onClick={fitView} title="Fit the whole tree in view">
          ⌂ Fit
        </button>
        <button className="btn" onClick={() => openForm('standalone')} title="Add a standalone person">
          + Add
        </button>
        <button
          className={`btn ${relationActive ? 'btn-active' : ''}`}
          onClick={toggleRelationMode}
          title="Find the relationship between two people (r)"
        >
          Relation
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
        <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={e => void onFile(e)} />
      </nav>
    </header>
  );
}
