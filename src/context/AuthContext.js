// src/context/AuthContext.js
import React, { createContext, useEffect, useState, useCallback } from 'react';
import {
  onAuthStateChanged,
  signOut,
  GoogleAuthProvider,
  FacebookAuthProvider,
  signInWithCredential,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  fetchSignInMethodsForEmail,
  linkWithCredential,
  EmailAuthProvider,
  reload,
  updateProfile,
} from 'firebase/auth';
import { getAuthInstance, db } from '../config/firebaseConfig';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as Facebook from 'expo-auth-session/providers/facebook';
import { makeRedirectUri, exchangeCodeAsync } from 'expo-auth-session';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import Constants from 'expo-constants';

// Try to load native Firebase Auth at runtime (available in dev/prod builds, not Expo Go)
let rnfbAuth = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  rnfbAuth = require('@react-native-firebase/auth').default;
} catch {
  rnfbAuth = null;
}

WebBrowser.maybeCompleteAuthSession();

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authRef, setAuthRef] = useState(null);

  const isExpoGo = Constants.appOwnership === 'expo';

  // ---------- GOOGLE ----------
  const expoClientId =
    '450911057083-hjl3qhno1boii7d2qeg9shu7socv8fc7.apps.googleusercontent.com';
  const androidClientId =
    '450911057083-q7v91likrb17ofdvmruq83n160ht8js5.apps.googleusercontent.com';
  const iosClientId = 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com';
  const webClientId = 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com';

  const googleAndroidNativeRedirect =
    'com.googleusercontent.apps.450911057083-q7v91likrb17ofdvmruq83n160ht8js5:/oauthredirect';

  const googleRedirectUri = makeRedirectUri(
    isExpoGo ? { useProxy: true } : { native: googleAndroidNativeRedirect }
  );

  const [googleRequest, googleResponse, googlePromptAsync] = Google.useAuthRequest(
    {
      expoClientId,
      androidClientId,
      iosClientId,
      webClientId,
      scopes: ['openid', 'profile', 'email'],
      responseType: isExpoGo ? 'id_token' : 'code',
      redirectUri: googleRedirectUri,
      selectAccount: true,
      usePKCE: !isExpoGo,
    },
    { useProxy: isExpoGo }
  );

  // ---------- FACEBOOK ----------
  const [fbRequest, fbResponse, fbPromptAsync] = Facebook.useAuthRequest(
    {
      clientId: '524476964015639',
      scopes: ['public_profile', 'email'],
      responseType: 'token',
      redirectUri: makeRedirectUri({ useProxy: true }),
    },
    { useProxy: true }
  );

  // ----- ActionCodeSettings -----
  const actionCodeSettings = {
    url: 'https://sauntera.com/verified',
    handleCodeInApp: false,
  };

  // ----- INIT AUTH -----
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
              phone: firebaseUser.phoneNumber || '',
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

  // ----- GOOGLE → FIREBASE -----
  useEffect(() => {
    if (!authRef) return;
    (async () => {
      if (googleResponse?.type !== 'success') return;
      try {
        let idToken =
          googleResponse.authentication?.idToken ||
          googleResponse.params?.id_token;

        if (!idToken && googleResponse.params?.code) {
          const tokenResult = await exchangeCodeAsync(
            {
              code: googleResponse.params.code,
              clientId: isExpoGo ? expoClientId : androidClientId,
              redirectUri: googleRedirectUri,
              extraParams: { code_verifier: googleRequest?.codeVerifier || '' },
            },
            { tokenEndpoint: 'https://oauth2.googleapis.com/token' }
          );
          idToken = tokenResult?.idToken || tokenResult?.id_token;
        }

        if (!idToken) {
          console.error('Google sign-in: missing id_token after auth.');
          return;
        }

        const credential = GoogleAuthProvider.credential(idToken);
        await signInWithCredential(authRef, credential);
      } catch (err) {
        console.error('Google sign-in error:', err);
      }
    })();
  }, [googleResponse, authRef]);

  // ----- FACEBOOK → FIREBASE -----
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

  // ----- PUBLIC API -----
  const signInWithGoogle = useCallback(() => {
    if (!googleRequest) return;
    googlePromptAsync({ useProxy: isExpoGo });
  }, [googleRequest, googlePromptAsync, isExpoGo]);

  const signInWithFacebook = useCallback(() => {
    if (!fbRequest) return;
    fbPromptAsync({ useProxy: true, preferEphemeralSession: true });
  }, [fbRequest, fbPromptAsync]);

  // ----- EMAIL/PASSWORD -----
  const signUpWithEmail = useCallback(
    async ({ email, password, displayName }) => {
      if (!authRef) throw new Error('Auth not ready');
      const cred = await createUserWithEmailAndPassword(authRef, email.trim(), password);
      if (displayName) {
        try {
          await updateProfile(cred.user, { displayName });
        } catch (e) {
          console.warn('updateProfile failed:', e);
        }
      }
      try {
        await sendEmailVerification(cred.user, actionCodeSettings);
      } catch (e) {
        console.error('Failed to send verification email:', e);
      }
      return cred.user;
    },
    [authRef]
  );

  const signInWithEmail = useCallback(
    async (email, password) => {
      if (!authRef) throw new Error('Auth not ready');
      const cred = await signInWithEmailAndPassword(authRef, email.trim(), password);
      return cred.user;
    },
    [authRef]
  );

  const resendEmailVerification = useCallback(async () => {
    if (!authRef || !authRef.currentUser) throw new Error('Not signed in');
    await sendEmailVerification(authRef.currentUser, actionCodeSettings);
  }, [authRef]);

  const checkEmailVerified = useCallback(async () => {
    if (!authRef || !authRef.currentUser) return false;
    await reload(authRef.currentUser);
    return !!authRef.currentUser.emailVerified;
  }, [authRef]);

  const sendPasswordReset = useCallback(
    async (email) => {
      if (!authRef) throw new Error('Auth not ready');
      await sendPasswordResetEmail(authRef, email.trim(), actionCodeSettings);
    },
    [authRef]
  );

  const getProvidersForEmail = useCallback(
    async (email) => {
      if (!authRef) throw new Error('Auth not ready');
      return fetchSignInMethodsForEmail(authRef, email.trim());
    },
    [authRef]
  );

  const linkEmailToCurrent = useCallback(
    async (email, password) => {
      if (!authRef || !authRef.currentUser) throw new Error('Not signed in');
      const credential = EmailAuthProvider.credential(email.trim(), password);
      const result = await linkWithCredential(authRef.currentUser, credential);
      return result.user;
    },
    [authRef]
  );

  // ----- PHONE AUTH (native-first; unavailable in Expo Go) -----
  const signInWithPhone = useCallback(async (phoneNumber) => {
    if (rnfbAuth) {
      return rnfbAuth().signInWithPhoneNumber(phoneNumber);
    }
    const err = new Error(
      'Phone auth requires a development or production build that includes @react-native-firebase/auth. It is not available in Expo Go.'
    );
    err.code = 'phone-auth-unavailable';
    throw err;
  }, []);

  const confirmPhoneCode = useCallback(async (confirmation, code) => {
    if (!confirmation) throw new Error('No confirmation object');
    if (confirmation && typeof confirmation.confirm === 'function') {
      return confirmation.confirm(code);
    }
    throw new Error('Invalid confirmation object for phone auth.');
  }, []);

  // ----- LOG OUT (sign out of BOTH web and native) -----
  const logout = useCallback(async () => {
    // Sign out web
    try {
      if (authRef) {
        await signOut(authRef);
      }
    } catch (e) {
      console.error('Web logout error:', e);
    }
    // Sign out native (if present)
    try {
      if (rnfbAuth) {
        await rnfbAuth().signOut();
      }
    } catch (e) {
      console.error('Native logout error:', e);
    }
    // small delay so onAuthStateChanged fires before UI navigation proceeds
    await new Promise((r) => setTimeout(r, 50));
  }, [authRef]);

  return (
    <AuthContext.Provider
      value={{
        user,
        authLoading,
        signInWithGoogle,
        signInWithFacebook,
        signUpWithEmail,
        signInWithEmail,
        resendEmailVerification,
        checkEmailVerified,
        sendPasswordReset,
        getProvidersForEmail,
        linkEmailToCurrent,
        logout,             // <-- updated
        signInWithPhone,
        confirmPhoneCode,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
