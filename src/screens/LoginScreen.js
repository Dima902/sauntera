// LoginScreen.js – SDK53 (Google + Facebook + Phone)
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
  const { authLoading, signInWithGoogle, signInWithFacebook, logout } = useContext(AuthContext);

  const [screenBootLoading, setScreenBootLoading] = useState(true);

  const disableAll = useMemo(
    () => authLoading || screenBootLoading,
    [authLoading, screenBootLoading]
  );

  // Ensure guest path is truly guest: clear ANY lingering auth before navigating
  const handleGuestAccess = async () => {
    try {
      await logout(); // clears both web + native sessions
    } catch {}
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
        >
          <Ionicons name="logo-google" size={20} style={styles.iconLeft} />
          <Text style={styles.googleloginButtonText}>Continue with Google</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.fbloginButton, disableAll && { opacity: 0.6 }]}
          onPress={signInWithFacebook}
          disabled={disableAll}
        >
          <FontAwesome5 name="facebook" size={20} color="#fff" style={styles.iconLeft} />
          <Text style={styles.fbloginButtonText}>Continue with Facebook</Text>
        </TouchableOpacity>

        {/* PHONE LOGIN */}
        <TouchableOpacity
          style={styles.altLoginButton}
          onPress={() => navigation.navigate('PhoneLoginScreen')}
          disabled={disableAll}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="call" size={20} style={{ marginRight: 8, color: '#000000ff' }} />
            <Text style={styles.altLoginText}>Use your phone</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.altLoginButton} onPress={handleGuestAccess}>
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
