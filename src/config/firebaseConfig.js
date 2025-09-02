// firebaseConfig.js - Finalized for Expo SDK 53 with AsyncStorage persistence
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: 'AIzaSyA-BuWXUPJgZ_ku0Y08Uy_Hse12jsUQNsE',
  authDomain: 'sauntera.com',
  projectId: 'happoria',
  storageBucket: 'happoria.firebasestorage.app',
  messagingSenderId: '450911057083',
  appId: '1:450911057083:web:836cf8365620ebc05c659e',
  measurementId: 'G-BZN9DB7P8R',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const storage = getStorage(app);

let auth = null;

export const getAuthInstance = async () => {
  if (!auth && Platform.OS !== 'web') {
    console.log('📦 Importing firebase/auth for getAuth fallback...');
    const { initializeAuth, getReactNativePersistence, getAuth } = await import('firebase/auth');
    try {
      auth = initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage),
      });
      console.log('✅ Firebase Auth initialized with AsyncStorage');
    } catch (e) {
      if (e.message.includes('has already been initialized')) {
        auth = getAuth(app);
        console.log('⚠️ Falling back to getAuth(app)');
      } else {
        throw e;
      }
    }
  }

  return auth;
};

export { app, db, storage };
