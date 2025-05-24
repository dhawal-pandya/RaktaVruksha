
import React, { createContext, useContext, useState, type ReactNode, useEffect } from 'react';

type Theme = '☀️' | '🌙';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    // Get theme from local storage or default to '☀️'
    const storedTheme = localStorage.getItem('theme');
    return storedTheme === '🌙' ? '🌙' : '☀️';
  });

  useEffect(() => {
    // Apply theme class to the body
    document.body.className = theme;
    // Store theme preference in local storage
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === '☀️' ? '🌙' : '☀️'));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};