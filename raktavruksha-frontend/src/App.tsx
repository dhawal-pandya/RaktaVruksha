// src/App.tsx
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import type { Person, FamilyData } from './types';
import FamilyTree from './components/FamilyTree';
import { ThemeProvider, useTheme } from './contexts/ThemeContext'; // Import ThemeProvider and useTheme
import './App.css'; // For basic styling

const AppContent: React.FC<{ peopleData: Person[] }> = ({ peopleData }) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="App">
      <header className="app-header">
        <h1>Raktavruksha</h1>
        <button onClick={toggleTheme} className="theme-toggle-button">
          {theme === '☀️' ? '🌙' : '🌙'}
        </button>
      </header>
      <Routes>
        <Route path="/" element={<FamilyTree people={peopleData} />} />
        <Route path="/person/:id" element={<FamilyTree people={peopleData} />} />
      </Routes>
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

  useEffect(() => {
    fetch('/family-data.json')
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then((data: FamilyData) => {
        setPeopleData(data.people);
        setLoading(false);
      })
      .catch(e => {
        console.error("Failed to load family data:", e);
        setError("Failed to load family data. Please check the JSON file.");
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="loading-state">Loading family data...</div>;
  if (error) return <div className="error-state">Error: {error}</div>;
  if (peopleData.length === 0) return <div className="no-data-state">No family data found.</div>;

  return (
    <Router>
      <ThemeProvider> 
        <AppContent peopleData={peopleData} />
      </ThemeProvider>
    </Router>
  );
};

export default App;