import React, { createContext, useContext, useState } from 'react';
import { setSetting } from '../database/db';

interface ThemeContextType {
  themeMode: 'light' | 'dark';
  setTheme: (mode: 'light' | 'dark') => Promise<void>;
  toggleTheme: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeModeProvider({ 
  children, 
  initialTheme 
}: { 
  children: React.ReactNode; 
  initialTheme: 'light' | 'dark';
}) {
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>(initialTheme);

  const setTheme = async (mode: 'light' | 'dark') => {
    setThemeMode(mode);
    await setSetting('theme_mode', mode);
  };

  const toggleTheme = async () => {
    const nextTheme = themeMode === 'light' ? 'dark' : 'light';
    await setTheme(nextTheme);
  };

  return (
    <ThemeContext.Provider value={{ themeMode, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeMode() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeMode must be used within a ThemeModeProvider');
  }
  return context;
}
