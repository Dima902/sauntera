import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { reload, sendEmailVerification } from 'firebase/auth';
import { getAuthInstance } from '../config/firebaseConfig';
import { useTheme } from '../styles/theme';
import { createEmailLoginStyles } from '../styles/EmailLoginScreenStyles';

export default function VerifyEmailScreen({ navigation }) {
  const theme = useTheme();
  const styles = useMemo(() => createEmailLoginStyles(theme), [theme]);

  const [auth, setAuth] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const instance = await getAuthInstance();
      setAuth(instance);
    })();
  }, []);

  // Poll for verification and auto-forward to Home
  useEffect(() => {
    if (!auth) return;
    let timer = null;

    const tick = async () => {
      const user = auth.currentUser;
      if (!user) return; // user signed out
      try {
        await reload(user);
        if (user.emailVerified) {
          navigation.replace('HomeScreen');
        }
      } catch (_) {
        // ignore network hiccups
      }
    };

    // Initial tick and interval
    tick();
    timer = setInterval(tick, 3000);

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [auth, navigation]);

  const handleResend = async () => {
    if (!auth?.currentUser) {
      navigation.goBack(); // no user — bounce back
      return;
    }
    setBusy(true);
    try {
      await sendEmailVerification(auth.currentUser, {
        url: 'https://sauntera.com/verified',
        handleCodeInApp: false,
      });
      // No alert per request — silent success
    } catch (_) {
      // silent failure; optionally log
    } finally {
      setBusy(false);
    }
  };

  const userEmail = auth?.currentUser?.email || '';

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Back arrow (no circle) */}
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={28} color={theme.icon} />
        </TouchableOpacity>

        {/* Title */}
        <Text style={styles.mainTitle}>Verify your email</Text>

        {/* Flat message (no alerts) */}
        <Text style={styles.disclaimer}>
          We’ve sent a verification link to {userEmail || 'your email'}. Please open the link to verify.
          This screen will automatically continue once your email is verified.
        </Text>

        {/* Resend */}
        <TouchableOpacity
          style={[styles.button, busy && styles.buttonDisabled]}
          onPress={handleResend}
          disabled={busy}
        >
          <Text style={styles.buttonText}>{busy ? 'Sending…' : 'Resend'}</Text>
        </TouchableOpacity>

        {busy && <ActivityIndicator style={{ marginTop: 16 }} color={theme.icon} />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
