// context/DateIdeasContext.js — resets filters between app sessions
import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FILTERS_STORAGE_KEY = 'filters';

export const DateIdeasContext = createContext({
  cachedIdeas: null,
  setCachedIdeas: () => {},
  regenerateCount: 0,
  setRegenerateCount: () => {},
  filters: {},
  setFilters: () => {},
  wasFilteredOnLoad: false,
  setWasFilteredOnLoad: () => {},
});

export const DateIdeasProvider = ({ children }) => {
  const [cachedIdeas, setCachedIdeas] = useState(null);
  const [regenerateCount, setRegenerateCount] = useState(0);
  const [filters, setFiltersState] = useState({ 'Quick Filters': [], 'Advanced Filters': [] });
  const [wasFilteredOnLoad, setWasFilteredOnLoad] = useState(false);

  // Reset filters on cold start (new app session)
  useEffect(() => {
    (async () => {
      try {
        // Force-clear any previously saved filters for a clean session
        await AsyncStorage.setItem(
          FILTERS_STORAGE_KEY,
          JSON.stringify({ 'Quick Filters': [], 'Advanced Filters': [] })
        );
        setFiltersState({ 'Quick Filters': [], 'Advanced Filters': [] });
        setWasFilteredOnLoad(false);
        console.log('🧼 Session start: filters reset to empty.');
      } catch (err) {
        console.warn('⚠️ Failed to reset filters on session start:', err);
      }
    })();
  }, []);

  /**
   * Set filters and optionally skip persisting to AsyncStorage.
   * This helps prevent flicker when temporarily clearing filters for guests on HomeScreen.
   *
   * @param {Object} newFilters - The new filter object to apply.
   *   Expected shape: { 'Quick Filters': string[], 'Advanced Filters': string[] }
   * @param {Object} [options]
   * @param {boolean} [options.skipPersist=false] - If true, will not save to AsyncStorage.
   */
  const setFilters = async (newFilters, { skipPersist = false } = {}) => {
    // Normalize to expected shape to avoid downstream undefined checks
    const normalized =
      newFilters && typeof newFilters === 'object'
        ? {
            'Quick Filters': Array.isArray(newFilters['Quick Filters'])
              ? newFilters['Quick Filters']
              : [],
            'Advanced Filters': Array.isArray(newFilters['Advanced Filters'])
              ? newFilters['Advanced Filters']
              : [],
          }
        : { 'Quick Filters': [], 'Advanced Filters': [] };

    setFiltersState(normalized);

    if (skipPersist) {
      console.log('⚡ Skipped persisting filters to AsyncStorage:', normalized);
      return;
    }
    try {
      await AsyncStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(normalized));
      console.log('💾 Saved filters to AsyncStorage:', normalized);
    } catch (err) {
      console.warn('⚠️ Failed to persist filters:', err);
    }
  };

  return (
    <DateIdeasContext.Provider
      value={{
        cachedIdeas,
        setCachedIdeas,
        regenerateCount,
        setRegenerateCount,
        filters,
        setFilters,
        wasFilteredOnLoad,
        setWasFilteredOnLoad,
      }}
    >
      {children}
    </DateIdeasContext.Provider>
  );
};
