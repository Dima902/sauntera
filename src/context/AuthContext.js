// src/context/AuthContext.js
import React, { createContext, useEffect, useState, useCallback } from 'react';
import {
  onAuthStateChanged,
  signOut,
  GoogleAuthProvider,
  FacebookAuthProvider,
  signInWithCredential,
} from 'firebase/auth';
import { getAuthInstance, db } from '../config/firebaseConfig';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as Facebook from 'expo-auth-session/providers/facebook';
import { makeRedirectUri } from 'expo-auth-session';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import Constants from 'expo-constants';

WebBrowser.maybeCompleteAuthSession();

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authRef, setAuthRef] = useState(null);

  // ---------- GOOGLE ----------
  // Client IDs
  const expoClientId =
    '450911057083-hjl3qhno1boii7d2qeg9shu7socv8fc7.apps.googleusercontent.com'; // Expo Go (proxy)
  const androidClientId =
    '450911057083-q7v91likrb17ofdvmruq83n160ht8js5.apps.googleusercontent.com'; // Native APK/AAB
  const iosClientId = 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com'; // (if you add iOS)
  const webClientId = 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com'; // (for Firebase verification)

  // Native redirect scheme for Android builds (reverse client ID)
  const googleAndroidNativeRedirect =
    'com.googleusercontent.apps.450911057083-q7v91likrb17ofdvmruq83n160ht8js5:/oauthredirect';

  // Detect if running inside Expo Go
  const isExpoGo = Constants.appOwnership === 'expo';

  // Build redirectUri
  const googleRedirectUri = makeRedirectUri(
    isExpoGo
      ? { useProxy: true } // Expo Go → proxy redirect (auth.expo.io)
      : { native: googleAndroidNativeRedirect } // Native builds → reverse client ID
  );

  const [googleRequest, googleResponse, googlePromptAsync] = Google.useAuthRequest(
    {
      expoClientId,
      androidClientId,
      iosClientId,
      webClientId,
      scopes: ['profile', 'email'],
      responseType: 'id_token', // ensures Firebase gets an ID token
      redirectUri: googleRedirectUri,
      selectAccount: true,
    },
    {
      useProxy: isExpoGo,
    }
  );

  // ---------- FACEBOOK ----------
  const [fbRequest, fbResponse, fbPromptAsync] = Facebook.useAuthRequest({
    clientId: '524476964015639',
    scopes: ['public_profile', 'email'],
  });

  // Init Firebase Auth + track session
  useEffect(() => {
    let unsubscribe;
    (async () => {
      const auth = await getAuthInstance();
      setAuthRef(auth);
      unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        setUser(firebaseUser);
        setAuthLoading(false);

        if (!firebaseUser) return;

        try {
          const userRef = doc(db, 'users', firebaseUser.uid);
          const snap = await getDoc(userRef);
          if (!snap.exists()) {
            await setDoc(userRef, {
              name: firebaseUser.displayName || '',
              email: firebaseUser.email || '',
              photoURL: firebaseUser.photoURL || '',
              accountType: 'free',
              createdAt: new Date().toISOString(),
              providerIds: firebaseUser.providerData?.map((p) => p.providerId) || [],
            });
          }
        } catch (e) {
          console.error('Failed to upsert Firestore user:', e);
        }
      });
    })();
    return () => unsubscribe && unsubscribe();
  }, []);

  // Google → Firebase
  useEffect(() => {
    if (!authRef) return;
    if (googleResponse?.type === 'success') {
      const idToken =
        googleResponse.authentication?.idToken || googleResponse.params?.id_token;
      if (!idToken) {
        console.error('Google response missing id_token');
        return;
      }
      const credential = GoogleAuthProvider.credential(idToken);
      signInWithCredential(authRef, credential).catch((err) =>
        console.error('Google sign-in error:', err)
      );
    }
  }, [googleResponse, authRef]);

  // Facebook → Firebase
  useEffect(() => {
    if (!authRef) return;
    if (fbResponse?.type === 'success') {
      const accessToken =
        fbResponse.authentication?.accessToken || fbResponse.params?.access_token;
      if (!accessToken) {
        console.error('Facebook response missing access_token');
        return;
      }
      const credential = FacebookAuthProvider.credential(accessToken);
      signInWithCredential(authRef, credential).catch((err) =>
        console.error('Facebook sign-in error:', err)
      );
    }
  }, [fbResponse, authRef]);

  // Public API
  const signInWithGoogle = useCallback(() => {
    if (!googleRequest) return;
    googlePromptAsync();
  }, [googleRequest, googlePromptAsync]);

  const signInWithFacebook = useCallback(() => {
    if (!fbRequest) return;
    fbPromptAsync();
  }, [fbRequest, fbPromptAsync]);

  const logout = useCallback(async () => {
    if (!authRef) return;
    try {
      await signOut(authRef);
    } catch (e) {
      console.error('Logout error:', e);
    }
  }, [authRef]);

  return (
    <AuthContext.Provider
      value={{
        user,
        authLoading,
        signInWithGoogle,
        signInWithFacebook,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
