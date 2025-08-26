// swipeStorage.js – persists seen card IDs and reshuffle logic

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'seenIdeaIds';

export const getSeenIdeaIds = async () => {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (err) {
    console.error('Error reading seenIdeaIds:', err);
    return [];
  }
};

export const addSeenIdeaId = async (id) => {
  try {
    const seen = await getSeenIdeaIds();
    if (!seen.includes(id)) {
      const updated = [...seen, id];
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    }
  } catch (err) {
    console.error('Error saving seenIdeaId:', err);
  }
};

export const clearSeenIdeaIds = async () => {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error('Error clearing seenIdeaIds:', err);
  }
};

export const shuffleArray = (array) => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};
