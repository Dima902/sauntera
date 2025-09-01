// src/screens/EmailLoginScreen.js
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { getAuthInstance } from '../config/firebaseConfig';
import { useTheme } from '../styles/theme';
import { createEmailLoginStyles } from '../styles/EmailLoginScreenStyles';

const isValidEmail = (s = '') =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s).trim());

export default function EmailLoginScreen({ navigation }) {
  const theme = useTheme();
  const styles = useMemo(() => createEmailLoginStyles(theme), [theme]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [isReset, setIsReset] = useState(false); // reset mode
  const [auth, setAuth] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const instance = await getAuthInstance();
      setAuth(instance);
    })();
  }, []);

  const handleEmailAuth = async () => {
    if (!auth) {
      Alert.alert('Error', 'Auth is not ready yet. Please try again.');
      return;
    }

    // RESET MODE: validate email + send reset link
    if (isReset) {
      if (!isValidEmail(email)) {
        Alert.alert('Incorrect email format', 'Please try again.');
        return;
      }
      setBusy(true);
      try {
        await sendPasswordResetEmail(auth, email.trim(), {
          url: 'https://sauntera.com/verified',
          handleCodeInApp: false,
        });
        Alert.alert('Check your email', 'We sent a password reset link.');
      } catch (e) {
        console.error(e);
        Alert.alert('Error', e?.message || 'Could not send reset email.');
      } finally {
        setBusy(false);
      }
      return;
    }

    // SIGNUP / SIGN-IN FLOW
    if (!email || !password) {
      Alert.alert('Missing info', 'Please enter email and password.');
      return;
    }

    setBusy(true);
    try {
      if (isSignup) {
        // Create user
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        // Try to send verification (silent – no alerts)
        try {
          await sendEmailVerification(cred.user, {
            url: 'https://sauntera.com/verified',
            handleCodeInApp: false,
          });
        } catch (e) {
          console.error('sendEmailVerification failed:', e);
        }
        // Go to in-app Verify Email screen
        navigation.replace('HomeScreen');
      } else {
        // Sign in
        const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
        if (cred?.user?.emailVerified) {
          navigation.replace('HomeScreen');
        } else {
          // Unverified -> in-app Verify Email screen (no alerts)
          navigation.replace('HomeScreen');
        }
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Error', err?.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const primaryCta = isReset
    ? 'Send verification email' // label per your request; this sends a password reset email
    : isSignup
    ? 'Sign Up'
    : 'Next';

  const disabled = !auth || busy || (isReset ? !email : !email || !password);

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
        <Text style={styles.mainTitle}>
          {isReset
            ? 'Reset your password'
            : isSignup
            ? 'Create your account'
            : "What's your email?"}
        </Text>

        {/* Email */}
        <TextInput
          style={styles.input}
          placeholder="Enter email"
          placeholderTextColor={theme.textSecondary}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          editable={!busy}
          returnKeyType={isReset ? 'done' : 'next'}
          onSubmitEditing={isReset ? handleEmailAuth : undefined}
        />

        {/* Password (hidden in reset mode) */}
        {!isReset && (
          <TextInput
            style={styles.input}
            placeholder="Enter password"
            placeholderTextColor={theme.textSecondary}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            editable={!busy}
            returnKeyType="done"
            onSubmitEditing={!disabled ? handleEmailAuth : undefined}
          />
        )}

        {/* Helper text */}
        {isReset ? (
          <Text style={styles.disclaimer}>
            Enter your account email and we’ll send instructions to reset your password.
          </Text>
        ) : (
          <Text style={styles.disclaimer}>
            We’ll use your email to verify your account and send updates.
          </Text>
        )}

        {/* Primary CTA */}
        <TouchableOpacity
          style={[styles.button, disabled && styles.buttonDisabled]}
          onPress={handleEmailAuth}
          disabled={disabled}
        >
          <Text style={styles.buttonText}>{primaryCta}</Text>
        </TouchableOpacity>

        {/* Links */}
        {!isReset && (
          <>
            <TouchableOpacity
              onPress={() => {
                setIsReset(true);
              }}
              disabled={busy}
              style={{ marginTop: 10 }}
            >
              <Text style={styles.linkText}>Forgot password?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setIsSignup(!isSignup);
              }}
              disabled={busy}
            >
              <Text style={styles.linkText}>
                {isSignup ? 'Already have an account? Log in' : 'Don’t have an account? Sign up'}
              </Text>
            </TouchableOpacity>
          </>
        )}

        {isReset && (
          <TouchableOpacity
            onPress={() => {
              setIsReset(false);
            }}
            disabled={busy}
            style={{ marginTop: 12 }}
          >
            <Text style={styles.linkText}>Back to sign in</Text>
          </TouchableOpacity>
        )}

        {busy && <ActivityIndicator style={{ marginTop: 16 }} color={theme.icon} />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
