// src/auth/useFacebookLogin.js
import { useEffect, useMemo, useState } from 'react';
import Constants from 'expo-constants';
import * as Facebook from 'expo-auth-session/providers/facebook';
import { makeRedirectUri, ResponseType } from 'expo-auth-session';

export function useFacebookLogin() {
  const isExpoGo = Constants.appOwnership === 'expo';
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [err, setErr] = useState(null);

  const redirectUri = useMemo(
    () => makeRedirectUri({
      native: 'myapp://auth',   // <-- matches your app.json "scheme": "myapp"
      useProxy: isExpoGo,        // Expo Go => proxy URL; APK => native scheme
    }),
    [isExpoGo]
  );

  const [request, response, promptAsync] = Facebook.useAuthRequest({
    clientId: '524476964015639',        // your FB App ID
    responseType: ResponseType.Token,   // implicit token flow on mobile
    redirectUri,
    useProxy: isExpoGo,
  });

  useEffect(() => {
    if (!response) return;
    if (response.type === 'success') {
      setStatus('success');
    } else if (response.type === 'error' || response.error) {
      setErr(response.error ?? new Error('Facebook login cancelled/failed'));
      setStatus('error');
    } else if (response.type === 'dismiss') {
      setStatus('idle');
    }
  }, [response]);

  const loginWithFacebook = async () => {
    try {
      setErr(null);
      setStatus('loading');
      const res = await promptAsync({ useProxy: isExpoGo });
      if (res?.type !== 'success') {
        setStatus('idle');
        return null;
      }
      // Access token is here:
      const accessToken = res.params?.access_token;
      return accessToken || null;
    } catch (e) {
      setErr(e);
      setStatus('error');
      return null;
    }
  };

  return { loginWithFacebook, status, error: err, redirectUri };
}
