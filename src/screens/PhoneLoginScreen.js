// src/screens/PhoneLoginScreen.js
import React, { useState, useContext, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';
import { useTheme } from '../styles/theme';
import { createEmailLoginStyles } from '../styles/EmailLoginScreenStyles';

// E.164 validation
const isValidE164 = (value = '') => /^\+[1-9]\d{7,14}$/.test(value);

// Build full number
const buildFullNumber = (prefix = '', local = '') => {
  const p = String(prefix || '').trim();
  const digits = String(local || '').replace(/[^\d]/g, '');
  if (!p.startsWith('+')) return null;
  return `${p}${digits}`;
};

// Friendly error messages
const friendlyPhoneError = (err) => {
  const code = err?.code || '';
  if (code === 'phone-auth-unavailable') {
    return (
      "SMS sign-in isn't available in Expo Go. Install a dev build that includes @react-native-firebase/auth and try again."
    );
  }
  if (code.includes('invalid-phone-number')) {
    return "That phone number doesn’t look right. Please include your country code, e.g., +1 416 555 1234.";
  }
  if (code.includes('too-many-requests')) {
    return "Too many attempts. Please wait a bit and try again.";
  }
  if (code.includes('quota-exceeded')) {
    return "We’re getting a lot of requests right now. Please try again later.";
  }
  if (code.includes('network-request-failed')) {
    return "No internet connection. Please check your network and try again.";
  }
  return err?.message || 'Something went wrong. Please try again.';
};

export default function PhoneLoginScreen({ navigation }) {
  const { signInWithPhone, confirmPhoneCode, authLoading } = useContext(AuthContext);

  const theme = useTheme();
  const styles = useMemo(() => createEmailLoginStyles(theme), [theme]);

  const [prefix, setPrefix] = useState('+1');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [confirmation, setConfirmation] = useState(null);
  const [busy, setBusy] = useState(false);

  const handleSendCode = async () => {
    const fullNumber = buildFullNumber(prefix, phone);
    if (!fullNumber || !isValidE164(fullNumber)) {
      Alert.alert(
        'Check your phone number',
        "That doesn’t look right. Please enter it like: +1 416 555 1234 (country code + number)."
      );
      return;
    }
    try {
      setBusy(true);
      const confirmationResult = await signInWithPhone(fullNumber);
      setConfirmation(confirmationResult);
    } catch (err) {
      console.error('Phone sign-in error:', err);
      Alert.alert('Couldn’t send code', friendlyPhoneError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmCode = async () => {
    if (!code) {
      Alert.alert('Enter the code', 'Please type the 6-digit code from the SMS.');
      return;
    }
    try {
      setBusy(true);
      await confirmPhoneCode(confirmation, code.trim());
      navigation.replace('HomeScreen');
    } catch (err) {
      console.error('Invalid code:', err);
      Alert.alert('Invalid code', 'That code didn’t work. Double-check and try again.');
    } finally {
      setBusy(false);
    }
  };

  const disabledSend = busy || authLoading || !phone;
  const disabledConfirm = busy || authLoading || !code;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Back button */}
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={28} color={theme.icon} />
        </TouchableOpacity>

        {!confirmation ? (
          <>
            <Text style={styles.mainTitle}>What’s your phone number?</Text>
            <View style={{ flexDirection: 'row', marginBottom: 8 }}>
              <TextInput
                style={[styles.input, { flex: 0.35, marginRight: 8 }]}
                placeholder="+1"
                value={prefix}
                onChangeText={setPrefix}
                keyboardType="phone-pad"
                autoCapitalize="none"
              />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="416 555 1234"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                autoComplete="tel"
              />
            </View>

            <Text style={styles.disclaimer}>
              We’ll text you a 6-digit code to verify your number.
            </Text>

            <TouchableOpacity
              style={[styles.button, disabledSend && styles.buttonDisabled]}
              onPress={handleSendCode}
              disabled={disabledSend}
            >
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send Code</Text>}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.mainTitle}>Enter verification code</Text>
            <TextInput
              style={styles.input}
              placeholder="123456"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              autoComplete="sms-otp"
              returnKeyType="done"
              onSubmitEditing={!disabledConfirm ? handleConfirmCode : undefined}
            />
            <TouchableOpacity
              style={[styles.button, disabledConfirm && styles.buttonDisabled]}
              onPress={handleConfirmCode}
              disabled={disabledConfirm}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Confirm Code</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
