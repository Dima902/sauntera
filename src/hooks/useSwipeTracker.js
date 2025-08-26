// hooks/useSwipeTracker.js – Tracks swipes and visible cards with daily resets

import { useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTodayDateString } from '../utils/dateUtils';
import {
  getSeenIdeaIds,
  addSeenIdeaId,
  clearSeenIdeaIds,
} from '../utils/swipeStorage';
import { resetSessionState } from '../utils/resetSessionState';

const SWIPE_COUNT_KEY = 'swipeCount';
const SWIPE_DATE_KEY = 'swipeDate';
const VISIBLE_COUNT_KEY = 'visibleCount';

export const useSwipeTracker = () => {
  // ✅ Reset swipe and visible counts daily
  const checkAndResetIfNeeded = useCallback(async () => {
    const today = getTodayDateString();
    const storedDate = await AsyncStorage.getItem(SWIPE_DATE_KEY);
    if (storedDate !== today) {
      await AsyncStorage.setItem(SWIPE_DATE_KEY, today);
      await AsyncStorage.setItem(SWIPE_COUNT_KEY, '0');
      await AsyncStorage.setItem(VISIBLE_COUNT_KEY, '0');
      await resetSessionState();

      console.log('🔁 Swipe and visible counts reset for new day');
    }
  }, []);

  const getSwipeCount = useCallback(async () => {
    const count = await AsyncStorage.getItem(SWIPE_COUNT_KEY);
    const parsed = parseInt(count, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }, []);

  const incrementSwipeCount = useCallback(async () => {
    const count = await getSwipeCount();
    const newCount = count + 1;
    await AsyncStorage.setItem(SWIPE_COUNT_KEY, newCount.toString());
    return newCount;
  }, [getSwipeCount]);

  const getVisibleCount = useCallback(async () => {
    const count = await AsyncStorage.getItem(VISIBLE_COUNT_KEY);
    const parsed = parseInt(count, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }, []);

  const incrementVisibleCount = useCallback(async () => {
    const count = await getVisibleCount();
    const newCount = count + 1;
    await AsyncStorage.setItem(VISIBLE_COUNT_KEY, newCount.toString());
    return newCount;
  }, [getVisibleCount]);

  const hasSeenIdea = useCallback(async (ideaId) => {
    if (!ideaId) return false;
    const seenIds = await getSeenIdeaIds();
    return seenIds.includes(ideaId);
  }, []);

  const trackSwipe = useCallback(
    async (ideaId) => {
      if (!ideaId) return;
      const seen = await hasSeenIdea(ideaId);
      if (!seen) {
        await addSeenIdeaId(ideaId);
        const count = await incrementSwipeCount();
        console.log(`👆 Swipe tracked. New count: ${count}`);
        return count;
      } else {
        const current = await getSwipeCount();
        return current;
      }
    },
    [hasSeenIdea, incrementSwipeCount, getSwipeCount]
  );

  const getDailyLimit = useCallback((isGuest, isFreeUser) => {
    if (isGuest) return 15;
    if (isFreeUser) return 30;
    return Infinity;
  }, []);

  return {
    checkAndResetIfNeeded,
    getSwipeCount,
    incrementSwipeCount,
    getVisibleCount,
    incrementVisibleCount,
    trackSwipe,
    hasSeenIdea,
    getDailyLimit,
  };
};
