import type { UnionStatus } from '../core/types';
import { personName } from '../core/types';
import { useStore } from '../state/store';

const statusWord = (s: UnionStatus): string =>
  s === 'married' ? 'married' : s === 'divorced' ? 'divorced ⚮' : s === 'partners' ? 'partners' : 'union';

export default function DetailCard() {
  const dataset = useStore(s => s.dataset);
  const focusId = useStore(s => s.focusId);
  const relationActive = useStore(s => s.relation.active);
  const focusPerson = useStore(s => s.focusPerson);
  const clearFocus = useStore(s => s.clearFocus);
  const setLens = useStore(s => s.setLens);
  const openForm = useStore(s => s.openForm);
  const lensFamilyId = useStore(s => s.lensFamilyId);

  if (!dataset || !focusId || relationActive) return null;
  const person = dataset.people.get(focusId);
  if (!person) return null;

  const fam = (id: string) => dataset.raw.families[id];
  const affiliations = dataset.familiesOf.get(focusId) ?? [];
  const parents = dataset.parentsOf.get(focusId) ?? [];
  const unionIds = dataset.unionsOf.get(focusId) ?? [];

  const PersonLink = ({ id, suffix }: { id: string; suffix?: string }) => {
    const p = dataset.people.get(id);
    if (!p) return null;
    return (
      <button className="person-link" onClick={() => focusPerson(id)}>
        {personName(p)}
        {!p.alive && ' ॐ'}
        {suffix && <em className="tag"> {suffix}</em>}
      </button>
    );
  };

  return (
    <section className="detail-card panel" aria-label="Person details">
      <header className="detail-head">
        <div>
          <h2 className="detail-name">
            {personName(person)}
            {!person.alive && <span className="deceased" title="deceased"> ॐ</span>}
          </h2>
          <div className="chips">
            {affiliations.length === 0 && <span className="chip chip-unknown">unknown lineage</span>}
            {affiliations.map(a => (
              <button
                key={`${a.familyId}:${a.kind}`}
                className={`chip ${lensFamilyId === a.familyId ? 'chip-active' : ''}`}
                style={{ borderColor: fam(a.familyId)?.color }}
                onClick={() => setLens(a.familyId)}
                title={`Lens on ${fam(a.familyId)?.name}`}
              >
                <span className="fam-dot" style={{ background: fam(a.familyId)?.color }} />
                {fam(a.familyId)?.name ?? a.familyId}
                <em className="tag">
                  {a.kind === 'birth' ? 'born' : a.kind === 'adopted-into' ? 'adopted in' : statusWord(a.status ?? 'married')}
                </em>
              </button>
            ))}
          </div>
        </div>
        <button className="btn btn-icon" onClick={clearFocus} aria-label="Close">
          ×
        </button>
      </header>

      <div className="detail-body">
        {parents.length > 0 && (
          <div className="detail-section">
            <h3>Parents</h3>
            {parents.map(p => (
              <PersonLink key={`${p.id}:${p.tag}`} id={p.id} suffix={p.tag === 'adoptive' ? 'adoptive' : undefined} />
            ))}
          </div>
        )}

        {unionIds.map(uid => {
          const u = dataset.unions.get(uid)!;
          const partner = u.partners.find(p => p !== focusId);
          const adopted = u.adoptedChildren ?? [];
          return (
            <div className="detail-section" key={uid}>
              <h3>
                {partner ? (
                  <>
                    {statusWord(u.status)} · <PersonLink id={partner} />
                  </>
                ) : (
                  'children · other parent unknown'
                )}
              </h3>
              {u.children.length + adopted.length === 0 && <span className="muted">no children</span>}
              {u.children.map(c => (
                <PersonLink key={c} id={c} />
              ))}
              {adopted.map(c => (
                <PersonLink key={c} id={c} suffix="adopted" />
              ))}
            </div>
          );
        })}

        {person.notes && <p className="detail-notes">{person.notes}</p>}
      </div>

      <footer className="detail-grow">
        <button className="btn" onClick={() => openForm('spouse', focusId)}>
          + Spouse
        </button>
        <button className="btn" onClick={() => openForm('child', focusId)}>
          + Child
        </button>
        <button className="btn" onClick={() => openForm('parent', focusId)}>
          + Parent
        </button>
        <button className="btn btn-subtle" onClick={() => openForm('edit', focusId)}>
          Edit
        </button>
      </footer>
    </section>
  );
}
