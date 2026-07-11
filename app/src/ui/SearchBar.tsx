import { useMemo, useState } from 'react';
import { personName } from '../core/types';
import { useStore } from '../state/store';

interface Result {
  kind: 'person' | 'family';
  id: string;
  label: string;
  sub: string;
  color?: string;
}

export default function SearchBar() {
  const dataset = useStore(s => s.dataset);
  const focusPerson = useStore(s => s.focusPerson);
  const relationActive = useStore(s => s.relation.active);
  const clickPerson = useStore(s => s.clickPerson);
  const setLens = useStore(s => s.setLens);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const results = useMemo((): Result[] => {
    if (!dataset || query.trim().length < 1) return [];
    const q = query.trim().toLowerCase();
    const out: Result[] = [];
    for (const [id, fam] of Object.entries(dataset.raw.families)) {
      if (fam.name.toLowerCase().includes(q)) {
        const dist = dataset.familyLabels.get(id)?.distinguisher;
        out.push({
          kind: 'family',
          id,
          label: dist ? `${fam.name} · ${dist}` : fam.name,
          sub: `family · ${dataset.membersOfFamily.get(id)?.size ?? 0} people`,
          color: fam.color,
        });
      }
      if (out.length >= 4) break;
    }
    for (const p of dataset.raw.people) {
      const name = personName(p).toLowerCase();
      if (name.includes(q)) {
        const famId = p.birthFamilyId;
        out.push({
          kind: 'person',
          id: p.id,
          label: personName(p),
          sub: famId ? dataset.raw.families[famId]?.name ?? famId : 'unknown lineage',
          color: famId ? dataset.raw.families[famId]?.color : undefined,
        });
      }
      if (out.length >= 9) break;
    }
    return out;
  }, [dataset, query]);

  const select = (r: Result) => {
    if (r.kind === 'person') {
      // In relation mode a search hit counts as a pick, same as clicking the node.
      if (relationActive) clickPerson(r.id);
      else focusPerson(r.id);
    } else {
      setLens(r.id);
    }
    setQuery('');
    setOpen(false);
  };

  return (
    <div className="search">
      <input
        className="search-input"
        type="search"
        placeholder="Search people or families…"
        value={query}
        onChange={e => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={e => {
          if (e.key === 'Enter' && results.length > 0) select(results[0]);
          if (e.key === 'Escape') {
            setQuery('');
            (e.target as HTMLInputElement).blur();
          }
        }}
      />
      {open && results.length > 0 && (
        <ul className="search-results panel">
          {results.map(r => (
            <li key={`${r.kind}:${r.id}`}>
              <button className="search-result" onMouseDown={e => e.preventDefault()} onClick={() => select(r)}>
                <span className="fam-dot" style={{ background: r.color ?? '#8a93a6' }} />
                <span className="search-label">{r.label}</span>
                <span className="search-sub">{r.sub}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
