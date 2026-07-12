import { personName } from '../core/types';
import { useStore } from '../state/store';

export default function RelationPanel() {
  const dataset = useStore(s => s.dataset);
  const relation = useStore(s => s.relation);
  const toggleRelationMode = useStore(s => s.toggleRelationMode);
  const clearRelationPicks = useStore(s => s.clearRelationPicks);
  const focusPerson = useStore(s => s.focusPerson);

  if (!dataset || !relation.active) return null;

  const name = (id: string | null) =>
    id ? personName(dataset.people.get(id) ?? { firstName: id, lastName: '' }) : null;

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
          {name(relation.aId) ?? 'click a person…'}
        </div>
        <span className="relation-arrow">→</span>
        <div className={`relation-slot ${relation.bId ? 'filled' : ''}`}>
          <span className="slot-label">B</span>
          {name(relation.bId) ?? (relation.aId ? 'click another…' : '—')}
        </div>
      </div>

      {relation.noRelation && (
        <p className="relation-result muted">
          No known relation: these two live in disconnected parts of the tree.
        </p>
      )}

      {relation.name && relation.aId && relation.bId && (
        <p className="relation-result">
          <strong>{name(relation.bId)}</strong> is <strong>{name(relation.aId)}</strong>'s{' '}
          <strong className="relation-name">{relation.name}</strong>
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
