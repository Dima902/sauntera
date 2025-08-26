// utils/guestUtils.js

import AsyncStorage from '@react-native-async-storage/async-storage';

export const MAX_GUEST_FILTER_USES = 2;
export const GUEST_FILTER_KEY = 'guestFilterUses';

export const getGuestFilterUses = async () => {
  const uses = await AsyncStorage.getItem(GUEST_FILTER_KEY);
  return parseInt(uses || '0');
};

export const incrementGuestFilterUses = async () => {
  const current = await getGuestFilterUses();
  const newCount = current + 1;
  await AsyncStorage.setItem(GUEST_FILTER_KEY, String(newCount));
  return newCount;
};

export const resetGuestFilterUses = async () => {
  await AsyncStorage.setItem(GUEST_FILTER_KEY, '0');
};
