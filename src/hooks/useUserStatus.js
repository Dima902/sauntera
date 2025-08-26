// useUserStatus.js (fully patched, smooth transitions)
// - Returns stable { user, userId, isGuest, isFreeUser, isPremium, accountType, devOverridePremium, isLoading }
// - Respects modular Firebase Auth (onAuthStateChanged(auth, cb))
// - Reads Firestore user doc for accountType (defaults to 'free')
// - Supports dev override flag via AsyncStorage key 'devOverridePremium' (string 'true' => premium)
// - Prevents flicker/false guest prompt by holding previous state until resolved
// - Defensive against errors and cleans up subscription properly

import { useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuthInstance, db } from '../config/firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

export const useUserStatus = () => {
  const [user, setUser] = useState(null);
  const [userId, setUserId] = useState('guest');
  const [isGuest, setIsGuest] = useState(true);
  const [isPremium, setIsPremium] = useState(false);
  const [accountType, setAccountType] = useState('free');
  const [devOverridePremium, setDevOverridePremium] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Keep previous state to prevent flashing guest UI
  const prevStateRef = useRef({
    user: null,
    userId: 'guest',
    isGuest: true,
    isPremium: false,
    accountType: 'free',
    devOverridePremium: false,
  });

  useEffect(() => {
    let unsubscribeAuth;

    (async () => {
      try {
        const auth = await getAuthInstance();

        unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
          setIsLoading(true); // lock UI until status resolved

          try {
            const signedIn = !!currentUser;
            const newState = { ...prevStateRef.current };

            newState.user = currentUser || null;
            newState.userId = currentUser?.uid ?? 'guest';
            newState.isGuest = !signedIn;

            // Default account type
            let acctType = 'free';
            let premium = false;

            if (signedIn) {
              try {
                const docRef = doc(db, 'users', currentUser.uid);
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                  const data = snap.data() || {};
                  acctType = (data.accountType || 'free').toLowerCase();
                }
              } catch (e) {
                console.warn('[useUserStatus] Failed to read user doc:', e?.message || e);
              }
            }

            premium = acctType === 'premium';

            // Check dev override
            try {
              const override = await AsyncStorage.getItem('devOverridePremium');
              const isOverride = override === 'true';
              newState.devOverridePremium = isOverride;
              if (isOverride) premium = true;
            } catch (e) {
              console.warn('[useUserStatus] Failed to read devOverridePremium:', e?.message || e);
              newState.devOverridePremium = false;
            }

            newState.accountType = acctType;
            newState.isPremium = premium;

            // Apply without UI flicker
            prevStateRef.current = newState;
            setUser(newState.user);
            setUserId(newState.userId);
            setIsGuest(newState.isGuest);
            setIsPremium(newState.isPremium);
            setAccountType(newState.accountType);
            setDevOverridePremium(newState.devOverridePremium);
          } finally {
            setIsLoading(false);
          }
        });
      } catch (err) {
        console.error('[useUserStatus] Failed to init auth:', err?.message || err);
        setIsLoading(false);
      }
    })();

    return () => {
      if (typeof unsubscribeAuth === 'function') {
        try {
          unsubscribeAuth();
        } catch {}
      }
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
