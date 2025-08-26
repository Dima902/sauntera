// LoadingScreen.js — full-bleed (covers under system bars)
import React, { useEffect, useRef, useContext } from 'react';
import {
  View,
  StyleSheet,
  Animated,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAuthInstance } from '../config/firebaseConfig';
import { LocationContext } from '../context/LocationContext';
import * as SplashScreen from 'expo-splash-screen';

export default function LoadingScreen({ navigation }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const { location, loading } = useContext(LocationContext);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.08,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    const checkAndNavigate = async () => {
      const auth = await getAuthInstance();
      const user = auth?.currentUser;

      if (!user) {
        await SplashScreen.hideAsync();
        navigation.replace('LoginScreen');
        return;
      }

      if (!loading && location) {
        await SplashScreen.hideAsync();
        navigation.replace('HomeScreen');
      }
    };

    checkAndNavigate();
  }, [location, loading, navigation]);

  return (
    <View
      // Negate global SafeArea padding so this screen is truly fullscreen
      style={[
        styles.container,
        {
          marginTop: -insets.top,
          marginBottom: -insets.bottom,
        },
      ]}
    >
      {/* Transparent, translucent status bar so background shows edge-to-edge */}
      <StatusBar style="light" translucent backgroundColor="transparent" />

      <Animated.Image
        source={require('../../assets/images/splash-icon.png')}
        style={[styles.logo, { transform: [{ scale: scaleAnim }] }]}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // Full-bleed background
    backgroundColor: '#79BAEC',
    justifyContent: 'center',
    alignItems: 'center',
    // Ensure we cover the whole screen even with negative margins
    minHeight: '100%',
    width: '100%',
  },
  logo: {
    width: 100,
    height: 100,
  },
});
