// src/hooks/useUserStatus.js
// Unified auth listener: web + native (RNFirebase)
// - Ensures phone login via native auth updates app state
// - Stable flags: { user, userId, isGuest, isFreeUser, isPremium, accountType, devOverridePremium, isLoading }

import { useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuthInstance, db } from '../config/firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged as onWebAuthChanged } from 'firebase/auth';

// Try to load native Firebase Auth if present (dev/prod build, not Expo Go)
let rnfbAuth = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  rnfbAuth = require('@react-native-firebase/auth').default;
} catch {
  rnfbAuth = null;
}

export const useUserStatus = () => {
  const [user, setUser] = useState(null);
  const [userId, setUserId] = useState('guest');
  const [isGuest, setIsGuest] = useState(true);
  const [isPremium, setIsPremium] = useState(false);
  const [accountType, setAccountType] = useState('free');
  const [devOverridePremium, setDevOverridePremium] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Keep previous state to prevent UI flicker
  const prevRef = useRef({
    user: null,
    userId: 'guest',
    isGuest: true,
    isPremium: false,
    accountType: 'free',
    devOverridePremium: false,
  });

  useEffect(() => {
    let webUnsub;
    let nativeUnsub;

    // Helper to resolve and apply status (given a Firebase user from either SDK)
    const resolveStatus = async (fbUser) => {
      const newState = { ...prevRef.current };
      const signedIn = !!fbUser;

      newState.user = fbUser || null;
      newState.userId = fbUser?.uid ?? 'guest';
      newState.isGuest = !signedIn;

      // Default
      let acctType = 'free';
      if (signedIn) {
        try {
          const snap = await getDoc(doc(db, 'users', fbUser.uid));
          if (snap.exists()) {
            const data = snap.data() || {};
            acctType = String(data.accountType || 'free').toLowerCase();
          }
        } catch (e) {
          console.warn('[useUserStatus] Firestore user fetch failed:', e?.message || e);
        }
      }
      let premium = acctType === 'premium';

      // Dev override
      try {
        const override = await AsyncStorage.getItem('devOverridePremium');
        const isOverride = override === 'true';
        newState.devOverridePremium = isOverride;
        if (isOverride) premium = true;
      } catch (e) {
        console.warn('[useUserStatus] devOverridePremium read failed:', e?.message || e);
        newState.devOverridePremium = false;
      }

      newState.accountType = acctType;
      newState.isPremium = premium;

      prevRef.current = newState;
      setUser(newState.user);
      setUserId(newState.userId);
      setIsGuest(newState.isGuest);
      setIsPremium(newState.isPremium);
      setAccountType(newState.accountType);
      setDevOverridePremium(newState.devOverridePremium);
    };

    (async () => {
      try {
        setIsLoading(true);

        // Subscribe to BOTH auth sources
        const webAuth = await getAuthInstance();
        webUnsub = onWebAuthChanged(webAuth, async (webUser) => {
          // If native auth is present & signed in, prefer that (handled below)
          if (!rnfbAuth) {
            await resolveStatus(webUser);
            setIsLoading(false);
          }
        });

        if (rnfbAuth) {
          nativeUnsub = rnfbAuth().onAuthStateChanged(async (nativeUser) => {
            // Native takes precedence when available (phone sign-in path)
            await resolveStatus(nativeUser || null);
            setIsLoading(false);
          });

          // If native user already signed in at mount time, resolve immediately
          const maybeNative = rnfbAuth().currentUser;
          if (maybeNative) {
            await resolveStatus(maybeNative);
            setIsLoading(false);
          }
        } else {
          // No native module: rely solely on web listener
          const maybeWeb = webAuth.currentUser;
          await resolveStatus(maybeWeb || null);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('[useUserStatus] init failed:', err?.message || err);
        setIsLoading(false);
      }
    })();

    return () => {
      try { webUnsub && webUnsub(); } catch {}
      try { nativeUnsub && nativeUnsub(); } catch {}
    };
  }, []);

  return {
    user,
    userId,
    isGuest,
    isPremium,
    isFreeUser: !isGuest && !isPremium,
    accountType,
    devOverridePremium,
    isLoading,
  };
};
