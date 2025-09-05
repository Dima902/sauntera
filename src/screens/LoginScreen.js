// LoginScreen.js – edge-to-edge background with overlaid system bars (SDK 53)
import React, { useEffect, useContext, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ImageBackground,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as NavigationBar from 'expo-navigation-bar';
import * as SystemUI from 'expo-system-ui';
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

  // Make the app root + system bars transparent & overlaid
  useEffect(() => {
    // Transparent root (prevents grey behind bars on Android skins)
    SystemUI.setBackgroundColorAsync('transparent').catch(() => {});

    // Android navigation bar: fully transparent + overlay content
    if (Platform.OS === 'android') {
      (async () => {
        try {
          // ARGB with alpha for true transparency across vendors
          await NavigationBar.setBackgroundColorAsync('#00000000');
          try {
            await NavigationBar.setBehaviorAsync('overlay-swipe-edge-to-edge');
          } catch {
            await NavigationBar.setBehaviorAsync('overlay-swipe');
          }
          // Pick what reads best over your image (light/dark)
          await NavigationBar.setButtonStyleAsync('light');
          await NavigationBar.setVisibilityAsync('visible');
        } catch {}
      })();
    }
  }, []);

  // Use AuthContext’s unified state to gate the screen
  useEffect(() => {
    if (authLoading) return; // wait for initial check
    if (user) {
      navigation.replace('HomeScreen');
    } else {
      setScreenBootLoading(false);
    }
  }, [authLoading, user, navigation]);

  // Ensure guest path is truly guest
  const handleGuestAccess = async () => {
    try {
      await logout(); // clears any lingering session
    } catch {}
    navigation.replace('HomeScreen');
  };

  return (
    <ImageBackground
      source={require('../../assets/login-background.jpg')}
      style={styles.container}
      resizeMode="cover"
    >
      {/* Top status bar: transparent & overlaid on the image */}
      <StatusBar translucent backgroundColor="transparent" style="light" />

      <View
        style={[
          styles.overlay,
          {
            // Only content gets safe-area padding; the image stays full-bleed
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
