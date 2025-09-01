// src/context/AuthInitGate.js
import React, { useEffect, useState } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { onAuthStateChanged } from 'firebase/auth';
import { getAuthInstance } from '../config/firebaseConfig';

// Keep native splash visible until we decide to hide it
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function AuthInitGate({ children }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let unsub;
    (async () => {
      try {
        const auth = await getAuthInstance();
        unsub = onAuthStateChanged(auth, () => {
          setReady(true);
        });
      } catch (e) {
        console.error('Auth init failed:', e);
        setReady(true);
      }
    })();
    return () => unsub && unsub();
  }, []);

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [ready]);

  // While initializing, keep the native splash (render nothing)
  if (!ready) return null;

  // No gating here — render the app
  return children;
}
