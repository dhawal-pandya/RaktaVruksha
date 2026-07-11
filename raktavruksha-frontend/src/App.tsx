import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { Person, FamilyData, FamilyEntry } from './types';
import FamilyTree from './components/FamilyTree';
import AddPersonPanel from './components/AddPersonPanel';
import type { NewPersonData } from './components/AddPersonPanel';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import './App.css';

// Utility function to filter people based on family ID
const filterPeopleByFamily = (allPeople: Person[], familyId: string | null): Person[] => {
  if (!familyId) return allPeople;

  // Direct members: born in or married into this family
  const directMemberIds = new Set<string>();
  allPeople.forEach(person => {
    if (person.birth_family_id === familyId || person.current_family_id === familyId) {
      directMemberIds.add(person.id);
    }
  });

  // Also include spouses of people born in this family — so you can see who family members married
  const extendedIds = new Set(directMemberIds);
  allPeople.forEach(person => {
    if (person.birth_family_id === familyId && person.spouses) {
      person.spouses.forEach(spouseId => extendedIds.add(spouseId));
    }
  });

  return allPeople.filter(p => extendedIds.has(p.id));
};

const AppContent: React.FC<{
  allPeopleData: Person[];
  selectedFamilyId: string | null;
  setSelectedFamilyId: (id: string | null) => void;
  uniqueFamilyIds: string[];
  familyColors: { [familyId: string]: string };
  onAddPerson: (data: NewPersonData) => void;
  onExport: () => void;
}> = ({ allPeopleData, selectedFamilyId, setSelectedFamilyId, uniqueFamilyIds, familyColors, onAddPerson, onExport }) => {
  const { theme, toggleTheme } = useTheme();
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  // State for the search bar input value
  const [searchTerm, setSearchTerm] = useState(selectedFamilyId || ''); // Initialize with selectedFamilyId or empty string

  // Filtered list of family IDs for search suggestions (memoized)
  const searchResults = useMemo(() => {
    if (!searchTerm) return [];
    return uniqueFamilyIds.filter(id =>
      id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, uniqueFamilyIds]);

  // Memoize filtered people for the FamilyTree component
  const peopleToDisplay = useMemo(() => {
    return filterPeopleByFamily(allPeopleData, selectedFamilyId);
  }, [allPeopleData, selectedFamilyId]);

  // Handle selection from search bar (on blur or Enter key)
  const handleSearchSelect = useCallback((value: string) => {
    // Only update if the value is a valid family ID and different from current selection
    if (uniqueFamilyIds.includes(value) && value !== selectedFamilyId) {
      setSelectedFamilyId(value);
      setSearchTerm(value); // Keep the selected value in the search box
    } else if (!value && selectedFamilyId !== null) {
      // If the search box is cleared, set selectedFamilyId to null to show all families
      setSelectedFamilyId(null);
      setSearchTerm(''); // Clear search term visually
    } else {
      // If input value is not a valid family ID, or it's the current selected, revert search term to current selected
      setSearchTerm(selectedFamilyId || '');
    }
    // No need to clear searchResults explicitly, they will be re-calculated by useMemo
  }, [uniqueFamilyIds, selectedFamilyId, setSelectedFamilyId]);


  const UNKNOWN_FAMILY = 'familyUnknown';

  // Clicking a person navigates to their "other" family.
  // If birth is unknown, or birth === current, treat person as a single-family member — go to current.
  // If viewing birth family → go to current. If viewing current → go to birth.
  // If viewing neither (shown as an in-law) → go to their birth family.
  const handlePersonClick = useCallback((clickedPerson: Person) => {
    const birth = clickedPerson.birth_family_id;
    const current = clickedPerson.current_family_id;

    let newFamily: string;

    if (birth === UNKNOWN_FAMILY || birth === current) {
      newFamily = current;
    } else if (selectedFamilyId === birth) {
      newFamily = current;
    } else if (selectedFamilyId === current) {
      newFamily = birth;
    } else {
      newFamily = birth;
    }

    if (newFamily !== selectedFamilyId) {
      setSelectedFamilyId(newFamily);
      setSearchTerm(newFamily);
    }
  }, [selectedFamilyId, setSelectedFamilyId]);


  return (
    <div className="App">
      <header className="app-header">
        <h1>Raktavruksha</h1>
        <div className="header-actions">
          <button className="header-btn" onClick={() => setIsPanelOpen(true)} title="Add person">+ Add</button>
          <button className="header-btn" onClick={onExport} title="Export JSON">Export</button>
          <button onClick={toggleTheme} className="theme-toggle-button">
            {theme === '☀️' ? '🌙' : '☀️'}
          </button>
        </div>
      </header>

      <div className="tree-controls">
        <label htmlFor="family-search">Search Family:</label>
        <div className="search-container">
          <input
            id="family-search"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onBlur={(e) => handleSearchSelect(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.currentTarget.blur();
              }
            }}
            placeholder="Type family ID..."
            list="family-suggestions"
            className="family-search-input"
            autoComplete="off"
          />
          <datalist id="family-suggestions">
            {searchResults.map((id) => (
              <option key={id} value={id} />
            ))}
          </datalist>
        </div>
      </div>

      <FamilyTree people={peopleToDisplay} onPersonClick={handlePersonClick} familyColors={familyColors} />

      <div className='origin'>
        Made with ❤️ by{' '}
        <a href='https://dhawal-pandya.github.io/'>Dhawal Pandya</a>
      </div>

      <AddPersonPanel
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
        onAdd={onAddPerson}
        people={allPeopleData}
        familyIds={uniqueFamilyIds}
      />
    </div>
  );
};

const App: React.FC = () => {
  const [allPeopleData, setAllPeopleData] = useState<Person[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(null);
  const [uniqueFamilyIds, setUniqueFamilyIds] = useState<string[]>([]);
  const [familyColors, setFamilyColors] = useState<{ [familyId: string]: string }>({});
  const [familiesData, setFamiliesData] = useState<{ [id: string]: FamilyEntry }>({});
  const [nextUnknownId, setNextUnknownId] = useState<number>(1);

  useEffect(() => {
    fetch('/family-data.json')
      .then(response => {
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return response.json() as Promise<FamilyData>;
      })
      .then((data: FamilyData) => {
        const rawFamilies = data.families ?? {};
        setFamiliesData(rawFamilies);

        const colors: { [familyId: string]: string } = {};
        Object.entries(rawFamilies).forEach(([id, entry]) => {
          colors[id] = entry.color;
        });
        setFamilyColors(colors);

        setNextUnknownId(data.nextUnknownId ?? 1);

        const people = data.people.filter(p => !p.id.startsWith('unknown_'));
        setAllPeopleData(people);
        setLoading(false);

        const familyIds = new Set<string>();
        people.forEach(p => {
          familyIds.add(p.birth_family_id);
          if (p.current_family_id) familyIds.add(p.current_family_id);
        });
        const sortedFamilyIds = Array.from(familyIds).filter(id => id !== 'familyUnknown').sort();
        setUniqueFamilyIds(sortedFamilyIds);

        const DEFAULT_FAMILY = 'familyPandya';
        const defaultFamily = sortedFamilyIds.includes(DEFAULT_FAMILY)
          ? DEFAULT_FAMILY
          : sortedFamilyIds[0] ?? null;
        setSelectedFamilyId(defaultFamily);
      })
      .catch(e => {
        console.error('Failed to load family data:', e);
        setError('Failed to load family data. Please check the JSON file.');
        setLoading(false);
      });
  }, []);

  const addPerson = useCallback((formData: NewPersonData) => {
    let counter = nextUnknownId;

    const resolveSlot = (slot: { type: string; personId?: string }): string | null => {
      if (slot.type === 'none') return null;
      if (slot.type === 'unknown') return `unknown_${counter++}`;
      return slot.personId ?? null;
    };

    const parent1Id = resolveSlot(formData.parent1);
    const parent2Id = resolveSlot(formData.parent2);
    const spouseIds = formData.spouses
      .map(s => resolveSlot(s))
      .filter((id): id is string => id !== null);

    // Generate a collision-free person ID from first name
    const existingIds = new Set(allPeopleData.map(p => p.id));
    let personId = formData.firstName;
    let suffix = 2;
    while (existingIds.has(personId)) personId = `${formData.firstName}${suffix++}`;

    const newPerson: Person = {
      id: personId,
      first_name: formData.firstName,
      last_name: formData.lastName,
      gender: formData.gender,
      alive: formData.alive,
      birth_family_id: formData.birthFamilyId,
      current_family_id: formData.currentFamilyId,
      parents: [parent1Id, parent2Id].filter((id): id is string => id !== null),
      spouses: spouseIds,
      children: [],
    };

    setAllPeopleData(prev => {
      const updated = prev.map(p => {
        const changes: Partial<Person> = {};
        if (parent1Id === p.id || parent2Id === p.id) {
          changes.children = [...(p.children ?? []), personId];
        }
        if (spouseIds.includes(p.id)) {
          changes.spouses = [...(p.spouses ?? []), personId];
        }
        return Object.keys(changes).length > 0 ? { ...p, ...changes } : p;
      });
      return [...updated, newPerson];
    });

    // If the new person belongs to a family not yet in the list, add it
    setUniqueFamilyIds(prev => {
      const next = new Set(prev);
      if (formData.birthFamilyId !== 'familyUnknown') next.add(formData.birthFamilyId);
      if (formData.currentFamilyId !== 'familyUnknown') next.add(formData.currentFamilyId);
      return Array.from(next).sort();
    });

    setNextUnknownId(counter);
  }, [nextUnknownId, allPeopleData]);

  const exportJSON = useCallback(() => {
    const payload = {
      families: familiesData,
      nextUnknownId,
      people: allPeopleData,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'family-data.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [familiesData, nextUnknownId, allPeopleData]);

  if (loading) return <div className="loading-state">Loading family data...</div>;
  if (error) return <div className="error-state">Error: {error}</div>;
  if (allPeopleData.length === 0 && !loading && !error) return <div className="no-data-state">No family data found.</div>;

  return (
    <ThemeProvider>
      <AppContent
        allPeopleData={allPeopleData}
        selectedFamilyId={selectedFamilyId}
        setSelectedFamilyId={setSelectedFamilyId}
        uniqueFamilyIds={uniqueFamilyIds}
        familyColors={familyColors}
        onAddPerson={addPerson}
        onExport={exportJSON}
      />
    </ThemeProvider>
  );
};

export default App;