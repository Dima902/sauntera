// LoginScreen.js – SDK53 (Phone + Guest only, edge-to-edge bg)
// FULL FILE PATCH
import React, { useEffect, useContext, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ImageBackground,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as NavigationBar from 'expo-navigation-bar';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';

import { AuthContext } from '../context/AuthContext';
import styles from '../styles/LoginScreenStyles';

export default function LoginScreen({ navigation }) {
  const { authLoading, user, logout } = useContext(AuthContext);
  const [screenBootLoading, setScreenBootLoading] = useState(true);
  const insets = useSafeAreaInsets();

  const disableAll = useMemo(
    () => authLoading || screenBootLoading,
    [authLoading, screenBootLoading]
  );

  // Make Android nav bar transparent & overlay the content
  useEffect(() => {
    (async () => {
      try {
        await NavigationBar.setBackgroundColorAsync('transparent');
        try {
          await NavigationBar.setBehaviorAsync('overlay-swipe-edge-to-edge');
        } catch {
          await NavigationBar.setBehaviorAsync('overlay-swipe');
        }
        await NavigationBar.setButtonStyleAsync('light');
      } catch {}
    })();
  }, []);

  // Gate the screen off the unified auth state from AuthContext
  useEffect(() => {
    // Wait until AuthContext has finished its initial check
    if (authLoading) return;

    if (user) {
      // Already signed in (native or web) — go straight to Home
      navigation.replace('HomeScreen');
    } else {
      // Not signed in — show the login UI
      setScreenBootLoading(false);
    }
  }, [authLoading, user, navigation]);

  // Ensure guest path is truly guest: clear ANY lingering auth before navigating
  const handleGuestAccess = async () => {
    try {
      await logout(); // clears both web + native sessions
    } catch {}
    navigation.replace('HomeScreen');
  };

  return (
    <ImageBackground
      source={require('../../assets/login-background.jpg')}
      style={styles.container}
      resizeMode="cover"
    >
      <StatusBar style="light" translucent backgroundColor="transparent" />

      <View
        style={[
          styles.overlay,
          {
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 16,
          },
        ]}
      >
        <View style={styles.contentWrapper}>
          <Text style={styles.logoText}>sauntera</Text>
          <Text style={styles.sloganText}>plan your perfect date</Text>

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

          {/* GUEST LOGIN */}
          <TouchableOpacity style={styles.altLoginButton} onPress={handleGuestAccess}>
            <Text style={styles.altLoginText}>Continue as guest</Text>
          </TouchableOpacity>

          {(screenBootLoading || authLoading) && (
            <ActivityIndicator style={{ marginTop: 20 }} color="#fff" />
          )}
        </View>

        {/* DISCLAIMER AT BOTTOM */}
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
      </View>
    </ImageBackground>
  );
}
