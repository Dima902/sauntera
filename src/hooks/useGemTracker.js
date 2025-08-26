// useGemTracker.js (patched)
// - Zero-padded YYYY-MM-DD + America/Toronto
// - Namespaced keys per (userId, deckType)
// - Configurable daily cap (default 1), supports premium/free differences
// - Helpers: remaining, hasReachedCap, resetToday
// - Safe JSON parse + tiny guards

import { useEffect, useMemo, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Build keys like: gem:<userId>:<deckType>:YYYY-MM-DD
const gemKey = ({ userId = 'guest', deckType = 'main', date }) =>
  `gem:${userId}:${deckType}:${date}:ids`;
const dateKey = ({ userId = 'guest', deckType = 'main' }) =>
  `gem:${userId}:${deckType}:date`;

function getTodayStringToronto() {
  // Keep this consistent with the rest of the app’s “daily” behavior
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  // en-CA gives YYYY-MM-DD
  return fmt.format(new Date());
}

/**
 * useGemTracker
 * @param {object} opts
 * @param {string} opts.userId - for namespacing
 * @param {string} opts.deckType - 'main' | 'restaurant'
 * @param {number} opts.dailyCap - how many gems can be unlocked per day (default 1)
 */
export const useGemTracker = ({
  userId = 'guest',
  deckType = 'main',
  dailyCap = 1,
} = {}) => {
  const today = useMemo(() => getTodayStringToronto(), []);
  const DATE_KEY = useMemo(() => dateKey({ userId, deckType }), [userId, deckType]);
  const IDS_KEY = useMemo(() => gemKey({ userId, deckType, date: today }), [userId, deckType, today]);

  const [unlockedIds, setUnlockedIds] = useState([]);

  // Boot/load + daily reset
  useEffect(() => {
    (async () => {
      try {
        const storedDate = await AsyncStorage.getItem(DATE_KEY);

        if (storedDate !== today) {
          // New day → write today + clear any previous day’s ids (for this user+deck)
          await AsyncStorage.setItem(DATE_KEY, today);
          await AsyncStorage.removeItem(IDS_KEY);
          setUnlockedIds([]);
          return;
        }

        const raw = await AsyncStorage.getItem(IDS_KEY);
        if (raw) {
          try {
            const arr = JSON.parse(raw);
            if (Array.isArray(arr)) setUnlockedIds(arr);
          } catch {
            // Corrupt cache; reset
            await AsyncStorage.removeItem(IDS_KEY);
            setUnlockedIds([]);
          }
        }
      } catch {
        // ignore storage errors
      }
    })();
  }, [DATE_KEY, IDS_KEY, today]);

  const hasUnlocked = useCallback((id) => unlockedIds.includes(id), [unlockedIds]);

  const canUnlock = useCallback(() => unlockedIds.length < dailyCap, [unlockedIds.length, dailyCap]);

  const remaining = useMemo(() => Math.max(dailyCap - unlockedIds.length, 0), [dailyCap, unlockedIds.length]);

  const hasReachedCap = useMemo(() => remaining === 0, [remaining]);

  const unlockGem = useCallback(async (id) => {
    if (!id) return;
    if (hasUnlocked(id)) return;
    if (!canUnlock()) return;

    const updated = [...unlockedIds, id];
    setUnlockedIds(updated);
    try {
      await AsyncStorage.setItem(IDS_KEY, JSON.stringify(updated));
    } catch {
      // ignore write errors
    }
  }, [IDS_KEY, unlockedIds, hasUnlocked, canUnlock]);

  // Optional helper to force a reset (useful for dev/testing)
  const resetToday = useCallback(async () => {
    try {
      await AsyncStorage.setItem(DATE_KEY, today);
      await AsyncStorage.removeItem(IDS_KEY);
      setUnlockedIds([]);
    } catch {}
  }, [DATE_KEY, IDS_KEY, today]);

  return {
    unlockedIds,
    unlockedCount: unlockedIds.length,
    unlockGem,
    hasUnlocked,
    canUnlock,
    remaining,
    hasReachedCap,
    resetToday,
    // exposers for consumers to read context
    dailyCap,
    userId,
    deckType,
    today,
  };
};
