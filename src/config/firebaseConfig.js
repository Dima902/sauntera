// src/config/firebaseConfig.js
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Try native Firebase (RNFirebase)
let rnfbApp = null;
let rnfbAuth = null;
let rnfbFirestore = null;
let rnfbStorage = null;
try {
  rnfbApp = require('@react-native-firebase/app').default;        // app accessor
  rnfbAuth = require('@react-native-firebase/auth').default;      // function -> auth()
  rnfbFirestore = require('@react-native-firebase/firestore').default; // function -> firestore()
  rnfbStorage = require('@react-native-firebase/storage').default; // function -> storage()
} catch (_) {
  // Not available in Expo Go or if not installed
}

// Web SDK fallback (used in Expo Go / Web)
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore as getWebFirestore } from 'firebase/firestore';
import { getStorage as getWebStorage } from 'firebase/storage';
import {
  getAuth as getWebAuth,
  initializeAuth as initializeWebAuth,
  getReactNativePersistence,
} from 'firebase/auth';

// Your Web config (same project as native)
const webFirebaseConfig = {
  apiKey: 'AIzaSyA-BuWXUPJgZ_ku0Y08Uy_Hse12jsUQNsE',
  authDomain: 'happoria.firebaseapp.com',
  projectId: 'happoria',
  storageBucket: 'happoria.firebasestorage.app',
  messagingSenderId: '450911057083',
  appId: '1:450911057083:web:836cf8365620ebc05c659e',
  measurementId: 'G-BZN9DB7P8R',
};

// ---- Exported singletons ----

// Auth
let webApp; // cached web app
let webAuth; // cached web auth

export const getAuthInstance = async () => {
  // ✅ Prefer native auth when available (dev/prod builds)
  if (rnfbAuth) {
    return rnfbAuth(); // uses android/app/google-services.json or iOS plist
  }

  // 🌐 Fallback to Web SDK (Expo Go / Web)
  if (!webApp) webApp = getApps().length ? getApp() : initializeApp(webFirebaseConfig);

  if (!webAuth) {
    try {
      // RN environment needs AsyncStorage persistence
      webAuth = initializeWebAuth(webApp, {
        persistence: getReactNativePersistence(AsyncStorage),
      });
      console.log('✅ Web Auth initialized with AsyncStorage');
    } catch (e) {
      // Already initialized (Fast Refresh, etc.)
      webAuth = getWebAuth(webApp);
      console.log('⚠️ Using existing Web Auth');
    }
  }
  return webAuth;
};

// Firestore
export const db = rnfbFirestore ? rnfbFirestore() : getWebFirestore(webApp ?? (getApps().length ? getApp() : initializeApp(webFirebaseConfig)));

// Storage
export const storage = rnfbStorage ? rnfbStorage() : getWebStorage(webApp ?? (getApps().length ? getApp() : initializeApp(webFirebaseConfig)));

// App (optional export)
export const app = rnfbApp ? rnfbApp() : (webApp ?? (getApps().length ? getApp() : initializeApp(webFirebaseConfig)));
