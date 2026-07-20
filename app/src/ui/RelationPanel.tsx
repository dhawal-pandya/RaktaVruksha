import { useMemo, useState } from 'react';
import { personName } from '../core/types';
import { useStore } from '../state/store';

export default function RelationPanel() {
  const dataset = useStore(s => s.dataset);
  const relation = useStore(s => s.relation);
  const toggleRelationMode = useStore(s => s.toggleRelationMode);
  const clearRelationPicks = useStore(s => s.clearRelationPicks);
  const clickPerson = useStore(s => s.clickPerson);
  const focusPerson = useStore(s => s.focusPerson);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const results = useMemo(() => {
    if (!dataset || query.trim().length < 1) return [];
    const q = query.trim().toLowerCase();
    const out: { id: string; label: string; sub: string; color?: string }[] = [];
    for (const p of dataset.raw.people) {
      if (personName(p).toLowerCase().includes(q)) {
        const famId = p.birthFamilyId;
        out.push({
          id: p.id,
          label: personName(p),
          sub: famId ? dataset.raw.families[famId]?.name ?? famId : 'unknown lineage',
          color: famId ? dataset.raw.families[famId]?.color : undefined,
        });
      }
      if (out.length >= 8) break;
    }
    return out;
  }, [dataset, query]);

  if (!dataset || !relation.active) return null;

  const name = (id: string | null) =>
    id ? personName(dataset.people.get(id) ?? { firstName: id, lastName: '' }) : null;

  const pick = (id: string) => {
    clickPerson(id);
    setQuery('');
    setOpen(false);
  };

  return (
    <section className="relation-panel panel" aria-label="Relation finder">
      <header className="detail-head">
        <h2 className="detail-name">Relation finder</h2>
        <button className="btn btn-icon" onClick={toggleRelationMode} aria-label="Exit relation mode">
          ×
        </button>
      </header>

      <div className="relation-slots">
        <div className={`relation-slot ${relation.aId ? 'filled' : ''}`}>
          <span className="slot-label">A</span>
          {name(relation.aId) ?? 'search or click…'}
        </div>
        <span className="relation-arrow">→</span>
        <div className={`relation-slot ${relation.bId ? 'filled' : ''}`}>
          <span className="slot-label">B</span>
          {name(relation.bId) ?? (relation.aId ? 'search or click…' : '·')}
        </div>
      </div>

      <div className="search relation-search">
        <input
          className="search-input"
          type="search"
          placeholder={relation.aId && !relation.bId ? 'Search for person B…' : 'Search for person A…'}
          value={query}
          onChange={e => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={e => {
            if (e.key === 'Enter' && results.length > 0) pick(results[0].id);
            if (e.key === 'Escape') {
              setQuery('');
              (e.target as HTMLInputElement).blur();
            }
          }}
        />
        {open && results.length > 0 && (
          <ul className="search-results panel">
            {results.map(r => (
              <li key={r.id}>
                <button
                  className="search-result"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => pick(r.id)}
                >
                  <span className="fam-dot" style={{ background: r.color ?? '#8a93a6' }} />
                  <span className="search-label">{r.label}</span>
                  <span className="search-sub">{r.sub}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {relation.noRelation && (
        <p className="relation-result muted">
          No known relation: these two live in disconnected parts of the tree.
        </p>
      )}

      {relation.name && relation.aId && relation.bId && (
        <p className="relation-result">
          <strong>{name(relation.bId)}</strong> is <strong>{name(relation.aId)}</strong>'s{' '}
          <strong className="relation-name">{relation.local ?? relation.name}</strong>
          {relation.local && (
            <span className="relation-en muted"> · {relation.name}</span>
          )}
        </p>
      )}
      {!relation.name && relation.steps && relation.steps.length > 0 && (
        <p className="relation-result muted">No simple name for this one: here's the path:</p>
      )}

      {relation.chain && relation.chain.length > 1 && (
        <ol className="relation-chain">
          {relation.chain.map((hop, i) => (
            <li key={`${hop.personId}-${i}`}>
              <button className="person-link" onClick={() => focusPerson(hop.personId)}>
                {hop.label}
              </button>
            </li>
          ))}
        </ol>
      )}

      {(relation.aId || relation.bId) && (
        <button className="btn btn-subtle" onClick={clearRelationPicks}>
          Clear picks
        </button>
      )}
    </section>
  );
}
