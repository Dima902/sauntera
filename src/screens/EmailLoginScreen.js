import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { getAuthInstance } from '../config/firebaseConfig';
import { useTheme } from '../styles/theme';
import { createEmailLoginStyles } from '../styles/EmailLoginScreenStyles';

export default function EmailLoginScreen({ navigation }) {
  const theme = useTheme();
  const styles = useMemo(() => createEmailLoginStyles(theme), [theme]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [auth, setAuth] = useState(null);

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

    try {
      if (isSignup) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      navigation.replace('HomeScreen');
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={28} color={theme.icon} />
      </TouchableOpacity>

      <Text style={styles.mainTitle}>What's your email?</Text>

      <TextInput
        style={styles.input}
        placeholder="Enter email"
        placeholderTextColor={theme.textSecondary}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <TextInput
        style={styles.input}
        placeholder="Enter password"
        placeholderTextColor={theme.textSecondary}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <Text style={styles.disclaimer}>
        We’ll use your email to verify your account and send updates. You can adjust preferences in profile settings after signing up.{' '}
        <Text
          style={styles.helpLink}
          onPress={() => Alert.alert('Help', 'Learn what happens if your email changes.')}
        >
          What happens if your email changes?
        </Text>
      </Text>

      <TouchableOpacity
        style={[
          styles.button,
          (!email || !password || !auth) && styles.buttonDisabled,
        ]}
        onPress={handleEmailAuth}
        disabled={!email || !password || !auth}
      >
        <Text style={styles.buttonText}>{isSignup ? 'Sign Up' : 'Next'}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setIsSignup(!isSignup)}>
        <Text style={styles.linkText}>
          {isSignup ? 'Already have an account? Log in' : "Don't have an account? Sign up"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
