import { useEffect, useMemo, useState } from 'react';
import type { Gender, UnionStatus } from '../core/types';
import { formatFamilyLabel, personName } from '../core/types';
import { displayFamilyOf } from '../core/dataset';
import { randomFamilyColor } from '../core/colors';
import { useStore, type FormPayload } from '../state/store';

const NEW_FAMILY = '__new__';
const UNKNOWN = '';
// +Spouse: the marriage's children take the spouse's family (e.g. a son-in-law's).
const SAME_AS_SPOUSE = '__spouse__';

const STATUS_OPTIONS: { value: UnionStatus; label: string }[] = [
  { value: 'married', label: 'married' },
  { value: 'partners', label: 'partners (never married)' },
  { value: 'divorced', label: 'divorced' },
  { value: 'unknown', label: 'unknown' },
];

export default function PersonForm() {
  const form = useStore(s => s.form);
  const formError = useStore(s => s.formError);
  const dataset = useStore(s => s.dataset);
  const closeForm = useStore(s => s.closeForm);
  const submitForm = useStore(s => s.submitForm);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState<Gender>('male');
  const [alive, setAlive] = useState(true);
  const [notes, setNotes] = useState('');
  const [familyChoice, setFamilyChoice] = useState<string>(UNKNOWN);
  const [newFamName, setNewFamName] = useState('');
  const [newFamColor, setNewFamColor] = useState('#e07b56');
  const [newFamNote, setNewFamNote] = useState('');
  const [unionChoice, setUnionChoice] = useState<string>('__newunion__');
  const [adopted, setAdopted] = useState(false);
  const [existingQuery, setExistingQuery] = useState('');
  const [status, setStatus] = useState<UnionStatus>('married');
  const [unionFamily, setUnionFamily] = useState<string>(UNKNOWN);
  const [unionFamilyTouched, setUnionFamilyTouched] = useState(false);
  const [unionStatuses, setUnionStatuses] = useState<Record<string, UnionStatus>>({});
  const [attachChildIds, setAttachChildIds] = useState<string[]>([]);

  const anchor = form?.anchorId ? dataset?.people.get(form.anchorId) : null;

  // (Re)initialize whenever a different form opens.
  useEffect(() => {
    if (!form || !dataset) return;
    const a = form.anchorId ? dataset.people.get(form.anchorId) : null;
    if (form.mode === 'edit' && a) {
      setFirstName(a.firstName);
      setLastName(a.lastName);
      setGender(a.gender);
      setAlive(a.alive);
      setNotes(a.notes ?? '');
      setFamilyChoice(a.birthFamilyId ?? UNKNOWN);
      const patches: Record<string, UnionStatus> = {};
      for (const uid of dataset.unionsOf.get(a.id) ?? []) {
        patches[uid] = dataset.unions.get(uid)!.status;
      }
      setUnionStatuses(patches);
    } else {
      setFirstName('');
      setLastName(a?.lastName ?? '');
      setGender(form.mode === 'spouse' && a ? (a.gender === 'male' ? 'female' : 'male') : 'male');
      setAlive(true);
      setNotes('');
      setFamilyChoice(form.mode === 'spouse' ? UNKNOWN : (a ? displayFamilyOf(dataset, a.id) ?? UNKNOWN : UNKNOWN));
      setUnionStatuses({});
    }
    const firstUnion = form.anchorId ? (dataset.unionsOf.get(form.anchorId) ?? [])[0] : undefined;
    setUnionChoice(form.mode === 'child' && firstUnion ? firstUnion : '__newunion__');
    setAdopted(false);
    setExistingQuery('');
    setStatus('married');
    setUnionFamily(a ? displayFamilyOf(dataset, a.id) ?? UNKNOWN : UNKNOWN);
    setUnionFamilyTouched(false);
    setAttachChildIds([]);
    setNewFamName('');
    setNewFamNote('');
  }, [form, dataset]);

  // For +Spouse: the anchor's children who currently have no second parent
  // (they sit in a single-parent union). These can be assigned to this marriage.
  const soloChildren = useMemo(() => {
    if (!dataset || form?.mode !== 'spouse' || !form.anchorId) return [];
    return (dataset.unionsOf.get(form.anchorId) ?? [])
      .map(uid => dataset.unions.get(uid)!)
      .filter(u => u.partners.length === 1)
      .flatMap(u => u.children);
  }, [dataset, form]);

  // Existing-person picker: matches "Name: id" datalist entries.
  const peopleOptions = useMemo(() => {
    if (!dataset) return [];
    return dataset.raw.people
      .map(p => ({ id: p.id, label: `${personName(p)}: ${p.id}` }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [dataset]);
  const existingId = useMemo(() => {
    const hit = peopleOptions.find(o => o.label === existingQuery);
    return hit?.id ?? null;
  }, [existingQuery, peopleOptions]);

  // In a marriage, children take the FATHER's family. Default the union's family to
  // the male partner's: the spouse's when adding a son-in-law (so his: often
  // brand-new: family flows to the kids), else the anchor's. The user can override.
  const spouseGender: Gender =
    (existingId ? dataset?.people.get(existingId)?.gender : gender) ?? gender;
  const anchorFamily = anchor && dataset ? displayFamilyOf(dataset, anchor.id) ?? UNKNOWN : UNKNOWN;
  const defaultUnionFamily =
    form?.mode === 'spouse' && spouseGender === 'male' ? SAME_AS_SPOUSE : anchorFamily;
  useEffect(() => {
    if (form?.mode === 'spouse' && !unionFamilyTouched) setUnionFamily(defaultUnionFamily);
  }, [defaultUnionFamily, form, unionFamilyTouched]);

  // Human name for the spouse's family, to label the "same as spouse" option.
  const existingSpousePerson = existingId ? dataset?.people.get(existingId) : undefined;
  const existingSpouseName = existingSpousePerson?.firstName ?? '';
  const spouseFamilyName = (() => {
    if (familyChoice === NEW_FAMILY) return newFamName.trim() || 'new family';
    if (familyChoice !== UNKNOWN) return dataset?.raw.families[familyChoice]?.name ?? '';
    const fam = existingSpousePerson?.birthFamilyId;
    return fam ? dataset?.raw.families[fam]?.name ?? '' : '';
  })();

  if (!form || !dataset) return null;

  const families = Object.entries(dataset.raw.families).sort((a, b) =>
    a[1].name.localeCompare(b[1].name),
  );
  const anchorUnions = form.anchorId ? dataset.unionsOf.get(form.anchorId) ?? [] : [];
  const creatingNew = !existingId;
  const picksExisting = form.mode === 'spouse' || form.mode === 'parent' || form.mode === 'child';
  const needsPersonFields = picksExisting ? creatingNew : true;
  const chosenUnion = unionChoice !== '__newunion__' ? dataset.unions.get(unionChoice) : null;
  const childFamilyLocked = form.mode === 'child' && !adopted && !!chosenUnion;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const birthFamilyId =
      familyChoice === NEW_FAMILY ? null : familyChoice === UNKNOWN ? null : familyChoice;
    const payload: FormPayload = {
      fields: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        gender,
        alive,
        birthFamilyId: childFamilyLocked ? chosenUnion!.familyId : birthFamilyId,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      },
      newFamily:
        familyChoice === NEW_FAMILY && newFamName.trim()
          ? {
              name: newFamName.trim(),
              color: newFamColor,
              ...(newFamNote.trim() ? { note: newFamNote.trim() } : {}),
            }
          : null,
      unionId: unionChoice === '__newunion__' ? null : unionChoice,
      adopted,
      existingId,
      status,
      unionFamilyId: unionFamily === UNKNOWN ? null : unionFamily,
      unionStatusPatches: Object.entries(unionStatuses).map(([unionId, st]) => ({
        unionId,
        status: st,
      })),
      childIds: attachChildIds,
    };
    submitForm(payload);
  };

  const title =
    form.mode === 'standalone'
      ? 'Add a person'
      : form.mode === 'child'
        ? `Add a child of ${anchor ? personName(anchor) : ''}`
        : form.mode === 'spouse'
          ? `Add a spouse of ${anchor ? personName(anchor) : ''}`
          : form.mode === 'parent'
            ? `Add a parent of ${anchor ? personName(anchor) : ''}`
            : `Edit ${anchor ? personName(anchor) : ''}`;

  const familySelect = (
    <label className="field">
      <span>Birth family</span>
      <select
        value={familyChoice}
        onChange={e => {
          const v = e.target.value;
          setFamilyChoice(v);
          // Seed a distinct color so a new family doesn't clash with the others.
          if (v === NEW_FAMILY) {
            setNewFamColor(randomFamilyColor(Object.values(dataset.raw.families).map(f => f.color)));
          }
        }}
        disabled={childFamilyLocked}
      >
        <option value={UNKNOWN}>unknown lineage</option>
        {families.map(([id, f]) => (
          <option key={id} value={id}>
            {formatFamilyLabel(dataset.familyLabels.get(id), f.name)}
          </option>
        ))}
        <option value={NEW_FAMILY}>➕ new family…</option>
      </select>
      {childFamilyLocked && chosenUnion?.familyId && (
        <em className="muted">born into {dataset.raw.families[chosenUnion.familyId]?.name} (from the union)</em>
      )}
    </label>
  );

  // A different family already uses this exact name → the new one gets its own id.
  const duplicateName =
    familyChoice === NEW_FAMILY &&
    newFamName.trim() &&
    Object.values(dataset.raw.families).some(
      f => f.name.trim().toLowerCase() === newFamName.trim().toLowerCase(),
    );

  return (
    <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && closeForm()}>
      <form className="modal panel" onSubmit={submit}>
        <header className="detail-head">
          <h2 className="detail-name">{title}</h2>
          <button type="button" className="btn btn-icon" onClick={closeForm} aria-label="Close">
            ×
          </button>
        </header>

        {picksExisting && (
          <label className="field">
            <span>{form.mode === 'spouse' ? 'Spouse' : form.mode === 'parent' ? 'Parent' : 'Child'}</span>
            <input
              list="rv-people"
              placeholder="type to pick an existing person, or leave empty to create new"
              value={existingQuery}
              onChange={e => setExistingQuery(e.target.value)}
            />
            <datalist id="rv-people">
              {peopleOptions.map(o => (
                <option key={o.id} value={o.label} />
              ))}
            </datalist>
          </label>
        )}

        {form.mode === 'child' && (
          <>
            <label className="field">
              <span>Other parent</span>
              <select value={unionChoice} onChange={e => setUnionChoice(e.target.value)}>
                {anchorUnions.map(uid => {
                  const u = dataset.unions.get(uid)!;
                  const partner = u.partners.find(p => p !== form.anchorId);
                  return (
                    <option key={uid} value={uid}>
                      {partner ? personName(dataset.people.get(partner)!) : 'unknown'} · {u.status}
                    </option>
                  );
                })}
                <option value="__newunion__">unknown (new)</option>
              </select>
            </label>
            <label className="field field-check">
              <input type="checkbox" checked={adopted} onChange={e => setAdopted(e.target.checked)} />
              <span>adopted (not a biological child of this union)</span>
            </label>
          </>
        )}

        {form.mode === 'parent' && (
          <label className="field field-check">
            <input type="checkbox" checked={adopted} onChange={e => setAdopted(e.target.checked)} />
            <span>adoptive parent</span>
          </label>
        )}

        {needsPersonFields && (
          <>
            <div className="field-row">
              <label className="field">
                <span>First name</span>
                <input value={firstName} onChange={e => setFirstName(e.target.value)} required autoFocus />
              </label>
              <label className="field">
                <span>Last name</span>
                <input value={lastName} onChange={e => setLastName(e.target.value)} />
              </label>
            </div>
            <div className="field-row">
              <label className="field">
                <span>Gender</span>
                <select value={gender} onChange={e => setGender(e.target.value as Gender)}>
                  <option value="male">male</option>
                  <option value="female">female</option>
                </select>
              </label>
              <label className="field field-check">
                <input type="checkbox" checked={alive} onChange={e => setAlive(e.target.checked)} />
                <span>alive</span>
              </label>
            </div>
            {familySelect}
            {familyChoice === NEW_FAMILY && (
              <>
                <div className="field-row">
                  <label className="field">
                    <span>New family name</span>
                    <input value={newFamName} onChange={e => setNewFamName(e.target.value)} required />
                  </label>
                  <label className="field">
                    <span>Color</span>
                    <input type="color" value={newFamColor} onChange={e => setNewFamColor(e.target.value)} />
                  </label>
                </div>
                <label className="field">
                  <span>Branch / place {duplicateName ? '(recommended)' : '(optional)'}</span>
                  <input
                    value={newFamNote}
                    onChange={e => setNewFamNote(e.target.value)}
                    placeholder="e.g. Surat branch: distinguishes same-named lineages"
                  />
                </label>
                {duplicateName && (
                  <p className="muted">
                    Another lineage is already named "{newFamName.trim()}". This creates a
                    separate family with its own id: add a branch/place so they're tellable apart.
                  </p>
                )}
              </>
            )}
            <label className="field">
              <span>Notes</span>
              <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
            </label>
          </>
        )}

        {form.mode === 'spouse' && (
          <>
            <div className="field-row">
              <label className="field">
                <span>Status</span>
                <select value={status} onChange={e => setStatus(e.target.value as UnionStatus)}>
                  {STATUS_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Children take the family</span>
                <select
                  value={unionFamily}
                  onChange={e => {
                    setUnionFamilyTouched(true);
                    setUnionFamily(e.target.value);
                  }}
                >
                  <option value={SAME_AS_SPOUSE}>
                    {firstName.trim() || existingSpouseName || 'the spouse'}'s family
                    {spouseFamilyName ? ` (${spouseFamilyName})` : ''}
                  </option>
                  <option value={UNKNOWN}>unknown</option>
                  {families.map(([id, f]) => (
                    <option key={id} value={id}>
                      {formatFamilyLabel(dataset.familyLabels.get(id), f.name)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <span className="muted">
              Whose family the children are born into: usually the father's. For a
              son-in-law, pick his family (create it as his birth family above).
            </span>
            {soloChildren.length > 0 && (
              <div className="detail-section">
                <h3>Also a parent of</h3>
                <span className="muted">
                  {anchor ? personName(anchor) : 'their'} existing children with no second parent:
                  tick any that belong to this marriage too.
                </span>
                {soloChildren.map(cid => {
                  const c = dataset.people.get(cid);
                  if (!c) return null;
                  return (
                    <label key={cid} className="field field-check">
                      <input
                        type="checkbox"
                        checked={attachChildIds.includes(cid)}
                        onChange={e =>
                          setAttachChildIds(prev =>
                            e.target.checked ? [...prev, cid] : prev.filter(x => x !== cid),
                          )
                        }
                      />
                      <span>{personName(c)}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </>
        )}

        {form.mode === 'edit' && Object.keys(unionStatuses).length > 0 && (
          <div className="detail-section">
            <h3>Unions</h3>
            {Object.entries(unionStatuses).map(([uid, st]) => {
              const u = dataset.unions.get(uid)!;
              const partner = u.partners.find(p => p !== form.anchorId);
              return (
                <label key={uid} className="field field-row union-edit">
                  <span>{partner ? personName(dataset.people.get(partner)!) : 'unknown partner'}</span>
                  <select
                    value={st}
                    onChange={e =>
                      setUnionStatuses(prev => ({ ...prev, [uid]: e.target.value as UnionStatus }))
                    }
                  >
                    {STATUS_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              );
            })}
          </div>
        )}

        {formError && <p className="form-error">{formError}</p>}

        <footer className="modal-actions">
          <button type="button" className="btn btn-subtle" onClick={closeForm}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            {form.mode === 'edit' ? 'Save changes' : 'Add'}
          </button>
        </footer>
      </form>
    </div>
  );
}
