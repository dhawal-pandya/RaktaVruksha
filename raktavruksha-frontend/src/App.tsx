import React, { useState, useEffect } from 'react';
import type { Person, FamilyData } from './types';
import FamilyTree from './components/FamilyTree';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import './App.css';

const AppContent: React.FC<{ peopleData: Person[] }> = ({ peopleData }) => {
  const { theme, toggleTheme } = useTheme();
  console.log('AppContent component rendered/re-rendered. Current theme:', theme);
  console.log('AppContent received peopleData count:', peopleData.length);

  return (
    <div className="App">
      <header className="app-header">
        <h1>Raktavruksha</h1>
        <button onClick={toggleTheme} className="theme-toggle-button">
          {theme === '☀️' ? '🌙' : '☀️'}
        </button>
      </header>
      <FamilyTree people={peopleData} />
       <div className='origin'>
              Made with ❤️ by{' '}
              <a href='https://dhawal-pandya.github.io/'>Dhawal Pandya</a>
            </div>
    </div>
  );
};

const App: React.FC = () => {
  const [peopleData, setPeopleData] = useState<Person[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  console.log('App component rendered/re-rendered.');

  useEffect(() => {
    console.log('App useEffect: Fetching family data...');
    fetch('/family-data.json')
      .then(response => {
        console.log('App useEffect: Received response from family-data.json', response);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json().then((data: FamilyData) => data.people);
      })
      .then((data: Person[]) => {
        console.log('App useEffect: Family data parsed successfully. Number of people:', data.length);
        setPeopleData(data);
        setLoading(false);
      })
      .catch(e => {
        console.error("App useEffect: Failed to load family data:", e);
        setError("Failed to load family data. Please check the JSON file.");
        setLoading(false);
      });
  }, []);

  console.log('App render state - loading:', loading, 'error:', error, 'peopleData count:', peopleData.length);
  if (loading) return <div className="loading-state">Loading family data...</div>;
  if (error) return <div className="error-state">Error: {error}</div>;
  if (peopleData.length === 0) return <div className="no-data-state">No family data found.</div>;

  return (
      <ThemeProvider>
        <AppContent peopleData={peopleData} />
      </ThemeProvider>
  );
};

export default App;