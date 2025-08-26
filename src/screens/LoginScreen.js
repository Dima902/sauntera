// LoginScreen.js – SDK53 (updated for Google + Facebook)
import React, { useEffect, useContext, useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ImageBackground,
} from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { onAuthStateChanged } from 'firebase/auth';
import { getAuthInstance } from '../config/firebaseConfig';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import styles from '../styles/LoginScreenStyles';
import * as Linking from 'expo-linking';

export default function LoginScreen({ navigation }) {
  const {
    authLoading,          // from AuthContext
    signInWithGoogle,
    signInWithFacebook,
  } = useContext(AuthContext);

  const [screenBootLoading, setScreenBootLoading] = useState(true);

  const disableAll = useMemo(
    () => authLoading || screenBootLoading,
    [authLoading, screenBootLoading]
  );

  const handleGuestAccess = () => {
    navigation.replace('HomeScreen');
  };

  useEffect(() => {
    let unsubscribe;

    (async () => {
      try {
        const auth = await getAuthInstance();
        unsubscribe = onAuthStateChanged(auth, (user) => {
          if (user) {
            navigation.replace('HomeScreen');
          } else {
            setScreenBootLoading(false);
          }
        });
      } catch (err) {
        console.error('❌ Failed to get auth instance in LoginScreen:', err);
        setScreenBootLoading(false);
      }
    })();

    return () => unsubscribe && unsubscribe();
  }, [navigation]);

  return (
    <ImageBackground
      source={require('../../assets/login-background.jpg')}
      style={styles.container}
      resizeMode="cover"
    >
      <View style={styles.overlay}>
        <Text style={styles.logoText}>sauntera</Text>
        <Text style={styles.sloganText}>plan your perfect date</Text>

        <TouchableOpacity
          style={[styles.googleloginButton, disableAll && { opacity: 0.6 }]}
          onPress={signInWithGoogle}
          disabled={disableAll}
          accessibilityRole="button"
          accessibilityLabel="Continue with Google"
        >
          <Ionicons name="logo-google" size={20} style={styles.iconLeft} />
          <Text style={styles.googleloginButtonText}>Continue with Google</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.fbloginButton, disableAll && { opacity: 0.6 }]}
          onPress={signInWithFacebook}
          disabled={disableAll}
          accessibilityRole="button"
          accessibilityLabel="Continue with Facebook"
        >
          <FontAwesome5 name="facebook" size={20} color="#fff" style={styles.iconLeft} />
          <Text style={styles.fbloginButtonText}>Continue with Facebook</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.altLoginButton}
          onPress={() => navigation.navigate('EmailLoginScreen')}
          accessibilityRole="button"
          accessibilityLabel="Use your email"
        >
          <Text style={styles.altLoginText}>Use your email</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.altLoginButton}
          onPress={handleGuestAccess}
          accessibilityRole="button"
          accessibilityLabel="Continue as guest"
        >
          <Text style={styles.altLoginText}>Continue as guest</Text>
        </TouchableOpacity>

        <View style={styles.disclaimerWrapper}>
          <Text style={styles.disclaimerText}>
            By signing up, you agree to our{' '}
            <Text
              style={styles.linkText}
              onPress={() => Linking.openURL('https://sauntera.com/terms.html')}
            >
              Terms
            </Text>{' '}
            and our{' '}
            <Text
              style={styles.linkText}
              onPress={() => Linking.openURL('https://sauntera.com/privacy.html')}
            >
              Privacy Policy
            </Text>
            .
          </Text>
        </View>

        {(screenBootLoading || authLoading) && (
          <ActivityIndicator style={{ marginTop: 20 }} color="#fff" />
        )}
      </View>
    </ImageBackground>
  );
}
