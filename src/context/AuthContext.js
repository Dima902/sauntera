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
} from 'firebase/auth';
import { getAuthInstance, db } from '../config/firebaseConfig';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as Facebook from 'expo-auth-session/providers/facebook';
import { makeRedirectUri, exchangeCodeAsync } from 'expo-auth-session';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import Constants from 'expo-constants';

// Try to load native Firebase Auth (@react-native-firebase/auth)
let rnfbAuth = null;
try {
  rnfbAuth = require('@react-native-firebase/auth').default;
} catch {
  rnfbAuth = null;
}

WebBrowser.maybeCompleteAuthSession();

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);        // <-- single source of truth
  const [authLoading, setAuthLoading] = useState(true);
  const [webAuth, setWebAuth] = useState(null);  // keep a ref for Google/Email flows

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

  // ---- helper: upsert Firestore profile for any FirebaseUser (web or native) ----
  const upsertUserDoc = useCallback(async (firebaseUser) => {
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
  }, []);

  // ----- INIT AUTH: subscribe to both and prefer native when present -----
  useEffect(() => {
    let unsubWeb, unsubNative, mounted = true;

    (async () => {
      const auth = await getAuthInstance();       // web auth (uses AsyncStorage persistence)
      if (!mounted) return;
      setWebAuth(auth);

      // web listener (for Google/Email flows)
      unsubWeb = onWebAuthStateChanged(auth, async (webUser) => {
        // If native is not signed in, use the web user
        if (rnfbAuth) {
          const nativeCurr = rnfbAuth().currentUser;
          if (nativeCurr) {
            // native takes precedence, ignore web in this case
            setUser(nativeCurr);
            upsertUserDoc(nativeCurr);
            setAuthLoading(false);
            return;
          }
        }
        // Else fall back to web
        setUser(webUser || null);
        if (webUser) upsertUserDoc(webUser);
        setAuthLoading(false);
      });

      // native listener (for Phone auth in dev/prod builds)
      if (rnfbAuth) {
        unsubNative = rnfbAuth().onAuthStateChanged(async (nativeUser) => {
          if (nativeUser) {
            setUser(nativeUser);
            upsertUserDoc(nativeUser);
          } else {
            // Only clear to null if web is also null; otherwise web user stays
            if (!auth.currentUser) setUser(null);
          }
          setAuthLoading(false);
        });
      } else {
        // No native module available (e.g., Expo Go) – rely on web only
        setAuthLoading(false);
      }
    })();

    return () => {
      mounted = false;
      unsubWeb && unsubWeb();
      unsubNative && unsubNative();
    };
  }, [upsertUserDoc]);

  // ----- GOOGLE → FIREBASE (web) -----
  useEffect(() => {
    if (!webAuth) return;
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
        await webSignInWithCredential(webAuth, credential);
      } catch (err) {
        console.error('Google sign-in error:', err);
      }
    })();
  }, [googleResponse, webAuth, isExpoGo, googleAndroidNativeRedirect, googleRedirectUri, googleRequest, androidClientId, expoClientId]);

  // ----- FACEBOOK → FIREBASE (web) -----
  useEffect(() => {
    if (!webAuth) return;
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
  }, [fbResponse, webAuth]);

  // ----- PUBLIC API -----
  const signInWithGoogle = useCallback(() => {
    if (!googleRequest) return;
    googlePromptAsync({ useProxy: isExpoGo });
  }, [googleRequest, googlePromptAsync, isExpoGo]);

  const signInWithFacebook = useCallback(() => {
    if (!fbRequest) return;
    fbPromptAsync({ useProxy: true, preferEphemeralSession: true });
  }, [fbRequest, fbPromptAsync]);

  // ----- EMAIL/PASSWORD (web) -----
  const signUpWithEmail = useCallback(
    async ({ email, password, displayName }) => {
      if (!webAuth) throw new Error('Auth not ready');
      const cred = await createUserWithEmailAndPassword(webAuth, email.trim(), password);
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
    [webAuth]
  );

  const signInWithEmail = useCallback(
    async (email, password) => {
      if (!webAuth) throw new Error('Auth not ready');
      const cred = await signInWithEmailAndPassword(webAuth, email.trim(), password);
      return cred.user;
    },
    [webAuth]
  );

  const resendEmailVerification = useCallback(async () => {
    if (!webAuth || !webAuth.currentUser) throw new Error('Not signed in');
    await sendEmailVerification(webAuth.currentUser, actionCodeSettings);
  }, [webAuth]);

  const checkEmailVerified = useCallback(async () => {
    if (!webAuth || !webAuth.currentUser) return false;
    await reload(webAuth.currentUser);
    return !!webAuth.currentUser.emailVerified;
  }, [webAuth]);

  const sendPasswordReset = useCallback(
    async (email) => {
      if (!webAuth) throw new Error('Auth not ready');
      await sendPasswordResetEmail(webAuth, email.trim(), actionCodeSettings);
    },
    [webAuth]
  );

  const getProvidersForEmail = useCallback(
    async (email) => {
      if (!webAuth) throw new Error('Auth not ready');
      return fetchSignInMethodsForEmail(webAuth, email.trim());
    },
    [webAuth]
  );

  const linkEmailToCurrent = useCallback(
    async (email, password) => {
      if (!webAuth || !webAuth.currentUser) throw new Error('Not signed in');
      const credential = EmailAuthProvider.credential(email.trim(), password);
      const result = await linkWithCredential(webAuth.currentUser, credential);
      return result.user;
    },
    [webAuth]
  );

  // ----- PHONE AUTH (native-first; unavailable in Expo Go) -----
  const signInWithPhone = useCallback(async (phoneNumber) => {
    if (rnfbAuth) {
      return rnfbAuth().signInWithPhoneNumber(phoneNumber); // returns a confirmation object
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
      return confirmation.confirm(code); // signs in native; our unified listener will pick it up
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
        signInWithGoogle,
        signInWithFacebook,
        signUpWithEmail,
        signInWithEmail,
        resendEmailVerification,
        checkEmailVerified,
        sendPasswordReset,
        getProvidersForEmail,
        linkEmailToCurrent,
        logout,
        signInWithPhone,
        confirmPhoneCode,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
