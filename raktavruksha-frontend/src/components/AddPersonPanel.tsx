import React, { useState, useEffect } from 'react';
import type { Person } from '../types';

interface ParentSlot {
  type: 'none' | 'existing' | 'unknown';
  personId?: string;
}

interface SpouseEntry {
  type: 'existing' | 'unknown';
  personId?: string;
}

export interface NewPersonData {
  firstName: string;
  lastName: string;
  gender: 'male' | 'female';
  alive: boolean;
  birthFamilyId: string;
  currentFamilyId: string;
  parent1: ParentSlot;
  parent2: ParentSlot;
  spouses: SpouseEntry[];
}

interface AddPersonPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (data: NewPersonData) => void;
  people: Person[];
  familyIds: string[];
}

const EMPTY_PARENT: ParentSlot = { type: 'none' };

const AddPersonPanel: React.FC<AddPersonPanelProps> = ({ isOpen, onClose, onAdd, people, familyIds }) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [alive, setAlive] = useState(true);
  const [birthFamilyId, setBirthFamilyId] = useState('');
  const [currentFamilyId, setCurrentFamilyId] = useState('');
  const [parent1, setParent1] = useState<ParentSlot>(EMPTY_PARENT);
  const [parent2, setParent2] = useState<ParentSlot>(EMPTY_PARENT);
  const [spouses, setSpouses] = useState<SpouseEntry[]>([]);

  useEffect(() => {
    if (isOpen && familyIds.length > 0) {
      setBirthFamilyId(familyIds[0]);
      setCurrentFamilyId(familyIds[0]);
    }
  }, [isOpen, familyIds]);

  const reset = () => {
    setFirstName('');
    setLastName('');
    setGender('male');
    setAlive(true);
    setBirthFamilyId(familyIds[0] || '');
    setCurrentFamilyId(familyIds[0] || '');
    setParent1(EMPTY_PARENT);
    setParent2(EMPTY_PARENT);
    setSpouses([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !birthFamilyId || !currentFamilyId) return;
    onAdd({ firstName: firstName.trim(), lastName: lastName.trim(), gender, alive, birthFamilyId, currentFamilyId, parent1, parent2, spouses });
    reset();
    onClose();
  };

  const handleClose = () => { reset(); onClose(); };

  const personLabel = (id: string) => {
    const p = people.find(x => x.id === id);
    return p ? `${p.first_name} ${p.last_name}`.trim() : id;
  };

  const usedParentIds = [parent1, parent2]
    .filter(s => s.type === 'existing')
    .map(s => s.personId!);

  const usedSpouseIds = spouses
    .filter(s => s.type === 'existing')
    .map(s => s.personId!);

  const renderParentSlot = (slot: ParentSlot, setSlot: (s: ParentSlot) => void, label: string) => (
    <div className="form-slot">
      <label className="slot-label">{label}</label>
      {slot.type === 'none' ? (
        <div className="slot-inputs">
          <select
            className="slot-select"
            value=""
            onChange={e => e.target.value && setSlot({ type: 'existing', personId: e.target.value })}
          >
            <option value="">Select existing...</option>
            {people
              .filter(p => !usedParentIds.includes(p.id))
              .map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
          </select>
          <button type="button" className="unknown-btn" onClick={() => setSlot({ type: 'unknown' })}>Unknown</button>
        </div>
      ) : (
        <div className={`slot-pill${slot.type === 'unknown' ? ' slot-pill--unknown' : ''}`}>
          <span>{slot.type === 'unknown' ? 'Unknown' : personLabel(slot.personId!)}</span>
          <button type="button" className="pill-clear" onClick={() => setSlot(EMPTY_PARENT)}>✕</button>
        </div>
      )}
    </div>
  );

  if (!isOpen) return null;

  return (
    <>
      <div className="panel-overlay" onClick={handleClose} />
      <aside className="add-person-panel">
        <div className="panel-header">
          <h2>Add Person</h2>
          <button className="panel-close-btn" onClick={handleClose} aria-label="Close">✕</button>
        </div>

        <form className="add-person-form" onSubmit={handleSubmit}>
          <div className="form-row">
            <label>First Name *</label>
            <input
              type="text"
              value={firstName}
              onChange={e => setFirstName(e.target.value)}
              required
              placeholder="e.g. Harsha"
              autoFocus
            />
          </div>

          <div className="form-row">
            <label>Last Name</label>
            <input
              type="text"
              value={lastName}
              onChange={e => setLastName(e.target.value)}
              placeholder="e.g. Pandya"
            />
          </div>

          <div className="form-row">
            <label>Gender *</label>
            <div className="radio-group">
              <label className="radio-label">
                <input type="radio" value="male" checked={gender === 'male'} onChange={() => setGender('male')} /> Male
              </label>
              <label className="radio-label">
                <input type="radio" value="female" checked={gender === 'female'} onChange={() => setGender('female')} /> Female
              </label>
            </div>
          </div>

          <div className="form-row form-row--inline">
            <label>Alive</label>
            <input type="checkbox" checked={alive} onChange={e => setAlive(e.target.checked)} />
          </div>

          <div className="form-section">
            <div className="form-row">
              <label>Birth Family *</label>
              <select value={birthFamilyId} onChange={e => setBirthFamilyId(e.target.value)} required>
                {familyIds.map(id => <option key={id} value={id}>{id}</option>)}
              </select>
            </div>
            <div className="form-row">
              <label>Current Family *</label>
              <select value={currentFamilyId} onChange={e => setCurrentFamilyId(e.target.value)} required>
                {familyIds.map(id => <option key={id} value={id}>{id}</option>)}
              </select>
            </div>
          </div>

          <div className="form-section">
            <h3 className="section-title">Parents</h3>
            {renderParentSlot(parent1, setParent1, 'Parent 1')}
            {renderParentSlot(parent2, setParent2, 'Parent 2')}
          </div>

          <div className="form-section">
            <h3 className="section-title">Spouses</h3>
            {spouses.map((spouse, i) => (
              <div key={i} className={`slot-pill${spouse.type === 'unknown' ? ' slot-pill--unknown' : ''}`}>
                <span>{spouse.type === 'unknown' ? 'Unknown' : personLabel(spouse.personId!)}</span>
                <button type="button" className="pill-clear" onClick={() => setSpouses(prev => prev.filter((_, j) => j !== i))}>✕</button>
              </div>
            ))}
            <div className="slot-inputs">
              <select
                className="slot-select"
                value=""
                onChange={e => {
                  if (!e.target.value) return;
                  setSpouses(prev => [...prev, { type: 'existing', personId: e.target.value }]);
                  e.target.value = '';
                }}
              >
                <option value="">Add existing spouse...</option>
                {people
                  .filter(p => !usedSpouseIds.includes(p.id))
                  .map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
              </select>
              <button type="button" className="unknown-btn" onClick={() => setSpouses(prev => [...prev, { type: 'unknown' }])}>Unknown</button>
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="action-btn action-btn--secondary" onClick={handleClose}>Cancel</button>
            <button type="submit" className="action-btn action-btn--primary">Add Person</button>
          </div>
        </form>
      </aside>
    </>
  );
};

export default AddPersonPanel;
