import React, { createContext, useState, useEffect } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightTheme, darkTheme } from '../styles/theme';

export const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [mode, setMode] = useState(null); // 'light' | 'dark' | null (null = follow system)

  const systemColorScheme = Appearance.getColorScheme();

  // Resolve the actual mode to use (manual or system)
  const resolvedMode = mode || systemColorScheme;
  const theme = resolvedMode === 'dark' ? { ...darkTheme, mode: 'dark' } : { ...lightTheme, mode: 'light' };

  useEffect(() => {
    const loadThemePreference = async () => {
      const saved = await AsyncStorage.getItem('themePreference');
      if (saved === 'dark' || saved === 'light') {
        setMode(saved);
      } else {
        setMode(null); // follow system
      }
    };
    loadThemePreference();
  }, []);

  const toggleTheme = async () => {
    const newMode = resolvedMode === 'dark' ? 'light' : 'dark';
    setMode(newMode);
    await AsyncStorage.setItem('themePreference', newMode);
  };

  const useSystemTheme = async () => {
    setMode(null);
    await AsyncStorage.removeItem('themePreference');
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, useSystemTheme, mode }}>
      {children}
    </ThemeContext.Provider>
  );
};
