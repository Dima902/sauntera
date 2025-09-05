// src/context/AuthContext.js
import React, { createContext, useEffect, useState, useCallback } from 'react';
import {
  onAuthStateChanged as onWebAuthStateChanged,
  signOut as webSignOut,
  GoogleAuthProvider,
  FacebookAuthProvider,
  signInWithCredential as webSignInWithCredential,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  fetchSignInMethodsForEmail,
  linkWithCredential,
  EmailAuthProvider,
  reload,
  updateProfile,
  getAuth as getWebAuth
} from 'firebase/auth';
import { getAuthInstance, db } from '../config/firebaseConfig';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as Facebook from 'expo-auth-session/providers/facebook';
import { makeRedirectUri, exchangeCodeAsync } from 'expo-auth-session';
// Web Firestore helpers (used only when db is Web Firestore)
import { doc, setDoc, getDoc } from 'firebase/firestore';
import Constants from 'expo-constants';

WebBrowser.maybeCompleteAuthSession();

// Try to load native Firebase Auth (@react-native-firebase/auth)
let rnfbAuth = null;
try {
  rnfbAuth = require('@react-native-firebase/auth').default; // function -> auth()
} catch {
  rnfbAuth = null;
}

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);        // single source of truth
  const [authLoading, setAuthLoading] = useState(true);
  const [webAuth, setWebAuth] = useState(null);  // used for Google/Email/Facebook web flows

  const isExpoGo = Constants.appOwnership === 'expo';
  const hasNativeAuth = !!rnfbAuth;
  const canUseWebAuth = !hasNativeAuth; // only use web flows on Expo Go / Web

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
    canUseWebAuth
      ? {
          expoClientId,
          androidClientId,
          iosClientId,
          webClientId,
          scopes: ['openid', 'profile', 'email'],
          responseType: isExpoGo ? 'id_token' : 'code',
          redirectUri: googleRedirectUri,
          selectAccount: true,
          usePKCE: !isExpoGo
        }
      : null,
    { useProxy: isExpoGo }
  );

  // ---------- FACEBOOK ----------
  const [fbRequest, fbResponse, fbPromptAsync] = Facebook.useAuthRequest(
    canUseWebAuth
      ? {
          clientId: '524476964015639',
          scopes: ['public_profile', 'email'],
          responseType: 'token',
          redirectUri: makeRedirectUri({ useProxy: true })
        }
      : null,
    { useProxy: true }
  );

  // ----- ActionCodeSettings -----
  const actionCodeSettings = {
    url: 'https://sauntera.com/verified',
    handleCodeInApp: false
  };

  // ---- helper: upsert Firestore profile for any FirebaseUser (web or native) ----
  const upsertUserDoc = useCallback(
    async (firebaseUser) => {
      if (!firebaseUser || !db) return;

      // Detect which Firestore SDK we are on: RNFirebase vs Web modular
      const isRNFirestore = typeof db?.collection === 'function';

      const payload = {
        name: firebaseUser.displayName || '',
        email: firebaseUser.email || '',
        phone: firebaseUser.phoneNumber || '',
        photoURL: firebaseUser.photoURL || '',
        accountType: 'free',
        createdAt: new Date().toISOString(),
        providerIds: firebaseUser.providerData?.map((p) => p.providerId) || []
      };

      try {
        if (isRNFirestore) {
          // RNFirebase Firestore
          const userRef = db.collection('users').doc(firebaseUser.uid);
          const snap = await userRef.get();
          if (!snap.exists) {
            await userRef.set(payload);
          }
        } else {
          // Web Firestore modular
          const userRef = doc(db, 'users', firebaseUser.uid);
          const snap = await getDoc(userRef);
          if (!snap.exists()) {
            await setDoc(userRef, payload);
          }
        }
      } catch (e) {
        console.error('Failed to upsert Firestore user:', e);
      }
    },
    [db]
  );

  // ----- INIT AUTH: prefer native; fallback to web -----
  useEffect(() => {
    let unsub = () => {};
    let mounted = true;

    (async () => {
      const auth = await getAuthInstance(); // native auth() or web auth()
      if (!mounted) return;

      if (hasNativeAuth) {
        // ✅ Native listener only (avoids web/native race conditions)
        unsub = rnfbAuth().onAuthStateChanged(async (nativeUser) => {
          setUser(nativeUser || null);
          if (nativeUser) await upsertUserDoc(nativeUser);
          setAuthLoading(false);
        });
      } else {
        // 🌐 Web listener only (Expo Go / Web)
        setWebAuth(auth);
        unsub = onWebAuthStateChanged(auth, async (webUser) => {
          setUser(webUser || null);
          if (webUser) await upsertUserDoc(webUser);
          setAuthLoading(false);
        });
      }
    })();

    return () => {
      mounted = false;
      try {
        unsub && unsub();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasNativeAuth, upsertUserDoc]);

  // ----- GOOGLE → FIREBASE (web only) -----
  useEffect(() => {
    if (!canUseWebAuth || !webAuth) return;
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
              extraParams: { code_verifier: googleRequest?.codeVerifier || '' }
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
        await webSignInWithCredential(webAuth, credential);
      } catch (err) {
        console.error('Google sign-in error:', err);
      }
    })();
  }, [
    canUseWebAuth,
    webAuth,
    googleResponse,
    isExpoGo,
    googleAndroidNativeRedirect,
    googleRedirectUri,
    googleRequest,
    androidClientId,
    expoClientId
  ]);

  // ----- FACEBOOK → FIREBASE (web only) -----
  useEffect(() => {
    if (!canUseWebAuth || !webAuth) return;
    if (fbResponse?.type === 'success') {
      const accessToken =
        fbResponse.authentication?.accessToken || fbResponse.params?.access_token;
      if (!accessToken) {
        console.error('Facebook response missing access_token');
        return;
      }
      const credential = FacebookAuthProvider.credential(accessToken);
      webSignInWithCredential(webAuth, credential).catch((err) =>
        console.error('Facebook sign-in error:', err)
      );
    }
  }, [canUseWebAuth, fbResponse, webAuth]);

  // ----- PUBLIC API -----
  const signInWithGoogle = useCallback(() => {
    if (!canUseWebAuth || !googleRequest) return;
    googlePromptAsync({ useProxy: isExpoGo });
  }, [canUseWebAuth, googleRequest, googlePromptAsync, isExpoGo]);

  const signInWithFacebook = useCallback(() => {
    if (!canUseWebAuth || !fbRequest) return;
    fbPromptAsync({ useProxy: true, preferEphemeralSession: true });
  }, [canUseWebAuth, fbRequest, fbPromptAsync]);

  // ----- EMAIL/PASSWORD (web only) -----
  const signUpWithEmail = useCallback(
    async ({ email, password, displayName }) => {
      if (!canUseWebAuth) throw new Error('Email auth is not enabled on native builds.');
      const auth = webAuth || getWebAuth();
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
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
    [canUseWebAuth, webAuth]
  );

  const signInWithEmail = useCallback(
    async (email, password) => {
      if (!canUseWebAuth) throw new Error('Email auth is not enabled on native builds.');
      const auth = webAuth || getWebAuth();
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      return cred.user;
    },
    [canUseWebAuth, webAuth]
  );

  const resendEmailVerification = useCallback(async () => {
    if (!canUseWebAuth) throw new Error('Email verification is not enabled on native builds.');
    const auth = webAuth || getWebAuth();
    if (!auth.currentUser) throw new Error('Not signed in');
    await sendEmailVerification(auth.currentUser, actionCodeSettings);
  }, [canUseWebAuth, webAuth]);

  const checkEmailVerified = useCallback(async () => {
    if (!canUseWebAuth) return false;
    const auth = webAuth || getWebAuth();
    if (!auth.currentUser) return false;
    await reload(auth.currentUser);
    return !!auth.currentUser.emailVerified;
  }, [canUseWebAuth, webAuth]);

  const sendPasswordReset = useCallback(
    async (email) => {
      if (!canUseWebAuth) throw new Error('Password reset is not enabled on native builds.');
      const auth = webAuth || getWebAuth();
      await sendPasswordResetEmail(auth, email.trim(), actionCodeSettings);
    },
    [canUseWebAuth, webAuth]
  );

  const getProvidersForEmail = useCallback(
    async (email) => {
      if (!canUseWebAuth) throw new Error('Provider lookup is not enabled on native builds.');
      const auth = webAuth || getWebAuth();
      return fetchSignInMethodsForEmail(auth, email.trim());
    },
    [canUseWebAuth, webAuth]
  );

  const linkEmailToCurrent = useCallback(
    async (email, password) => {
      if (!canUseWebAuth) throw new Error('Email linking is not enabled on native builds.');
      const auth = webAuth || getWebAuth();
      if (!auth.currentUser) throw new Error('Not signed in');
      const credential = EmailAuthProvider.credential(email.trim(), password);
      const result = await linkWithCredential(auth.currentUser, credential);
      return result.user;
    },
    [canUseWebAuth, webAuth]
  );

  // ----- PHONE AUTH (native-first; unavailable in Expo Go) -----
  const signInWithPhone = useCallback(async (phoneNumber) => {
    if (rnfbAuth) {
      // Returns a confirmation object (native)
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
      // Signs in natively; the native listener updates context
      return confirmation.confirm(code);
    }
    throw new Error('Invalid confirmation object for phone auth.');
  }, []);

  // ----- LOG OUT (sign out of BOTH web and native) -----
  const logout = useCallback(async () => {
    try {
      if (webAuth) await webSignOut(webAuth);
    } catch (e) {
      console.error('Web logout error:', e);
    }
    try {
      if (rnfbAuth) await rnfbAuth().signOut();
    } catch (e) {
      console.error('Native logout error:', e);
    }
    await new Promise((r) => setTimeout(r, 50));
  }, [webAuth]);

  return (
    <AuthContext.Provider
      value={{
        user,
        authLoading,
        // Web-only sign-in methods will no-op on native builds
        signInWithGoogle,
        signInWithFacebook,
        signUpWithEmail,
        signInWithEmail,
        resendEmailVerification,
        checkEmailVerified,
        sendPasswordReset,
        getProvidersForEmail,
        linkEmailToCurrent,
        // Native phone auth
        logout,
        signInWithPhone,
        confirmPhoneCode
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
