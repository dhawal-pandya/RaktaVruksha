// src/contexts/ThemeContext.tsx
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
    const storedTheme = localStorage.getItem('theme');
    const initialTheme = storedTheme === '🌙' ? '🌙' : '☀️';
    console.log('ThemeProvider: Initializing theme to', initialTheme, '(from localStorage:', storedTheme, ')');
    return initialTheme;
  });

  useEffect(() => {
    console.log('ThemeProvider useEffect: Applying theme to body and storing in localStorage. Current theme:', theme);
    document.body.className = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => {
      const newTheme = prevTheme === '☀️' ? '🌙' : '☀️';
      console.log('ThemeProvider: Toggling theme from', prevTheme, 'to', newTheme);
      return newTheme;
    });
  };

  console.log('ThemeProvider rendered/re-rendered.');

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