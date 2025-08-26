import React, { useEffect, useState } from 'react';
import { getAuthInstance } from '../config/firebaseConfig';
import * as SplashScreen from 'expo-splash-screen';

export default function AuthInitGate({ children }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        await getAuthInstance();
      } finally {
        // keep native splash visible until App.js decides to hide it
        setReady(true);
      }
    })();
  }, []);

  // Return null to keep native splash instead of showing a separate ActivityIndicator view
  if (!ready) return null;

  return children;
}
