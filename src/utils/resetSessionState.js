// utils/resetSessionState.js

import AsyncStorage from '@react-native-async-storage/async-storage';

export const resetSessionState = async () => {
  try {
    await AsyncStorage.removeItem('persistedGemIds');
    await AsyncStorage.removeItem('seenIdeaIds');
    await AsyncStorage.setItem('swipeCount', '0');
    console.log('🔁 Session state reset for new day');
  } catch (err) {
    console.error('❌ Failed to reset session state:', err);
  }
};
