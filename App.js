// App.js – Faster first paint: gate only on auth, keep native splash up; defer non‑critical work
import 'react-native-gesture-handler';
import 'react-native-reanimated';
import React, { useEffect, useContext, useMemo } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';
import { LocationProvider } from './src/context/LocationContext';
import { ItineraryProvider } from './src/context/ItineraryContext';
import { AuthProvider, AuthContext } from './src/context/AuthContext';
import { DateIdeasProvider } from './src/context/DateIdeasContext';
import { CopilotProvider } from 'react-native-copilot';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LogBox, AppState, View, Text, InteractionManager } from 'react-native';
import { ThemeProvider, ThemeContext } from './src/context/ThemeContext';
import { ActionSheetProvider } from '@expo/react-native-action-sheet';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import AuthInitGate from './src/components/AuthInitGate';
import { StatusBar } from 'expo-status-bar';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';

// Silence noisy logs in dev
console.warn = ((originalWarn) => (...args) => {
  if (args[0]?.includes?.('useInsertionEffect')) return;
  originalWarn(...args);
})(console.warn);

LogBox.ignoreLogs([
  'RNCMaterialDatePicker',
  'NativeModules.RNCMaterialDatePicker',
]);

// Keep native splash until we say so
if (!global.__SPLASH_PREVENTED__) {
  global.__SPLASH_PREVENTED__ = true;
  SplashScreen.preventAutoHideAsync().catch(() => {});
}

function ToastView({ isDark, type, text1, text2 }) {
  const bgColor =
    type === 'success'
      ? (isDark ? '#1e1e1e' : '#f0f0f0')
      : (isDark ? '#330000' : '#ffe6e6');
  const iconColor =
    type === 'success'
      ? (isDark ? '#4BB543' : '#2e7d32')
      : (isDark ? '#FF4C4C' : '#b00020');

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: bgColor,
        borderRadius: 12,
        padding: 14,
        marginHorizontal: 20,
        marginTop: 60,
        elevation: 4,
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
      }}
    >
      <Ionicons
        name={type === 'success' ? 'checkmark-circle' : 'close-circle'}
        size={24}
        color={iconColor}
        style={{ marginRight: 10 }}
      />
      <View>
        <Text style={{ color: isDark ? '#fff' : '#111', fontSize: 15, fontWeight: '600' }}>
          {text1}
        </Text>
        {text2 ? (
          <Text style={{ color: isDark ? '#aaa' : '#333', fontSize: 13 }}>{text2}</Text>
        ) : null}
      </View>
    </View>
  );
}

function MainApp() {
  const { theme } = useContext(ThemeContext);
  const isDark = theme.mode === 'dark';
  const bgColor = isDark ? '#000000' : '#ffffff';

  const { user, authLoading } = useContext(AuthContext);

  // 🚀 App is ready to render as soon as auth is resolved.
  // (Location loads in background; your navigator/screens handle that flow.)
  const appReady = useMemo(() => !authLoading, [authLoading]);

  useEffect(() => {
    if (appReady) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [appReady]);

  // Defer non-critical storage work so it never blocks first frame
  useEffect(() => {
    const sub = InteractionManager.runAfterInteractions(async () => {
      try {
        const flag = await AsyncStorage.getItem('filtersCleared');
        if (!flag) {
          await AsyncStorage.removeItem('selectedFilters');
          await AsyncStorage.setItem('filtersCleared', 'true');
        }
      } catch {}
    });
    return () => sub?.cancel?.();
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextState) => {
      if (nextState === 'background' || nextState === 'inactive') {
        await AsyncStorage.removeItem('filtersCleared');
      }
    });
    return () => subscription.remove();
  }, []);

  if (!appReady) return null; // keep native splash

  return (
    <View style={{ flex: 1, backgroundColor: bgColor }}>
      <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={bgColor} translucent />
      <BottomSheetModalProvider>
        <NavigationContainer theme={isDark ? DarkTheme : DefaultTheme}>
          <AppNavigator />
        </NavigationContainer>
      </BottomSheetModalProvider>
      <Toast
        position="top"
        config={{
          success: ({ text1, text2 }) => (
            <ToastView isDark={isDark} type="success" text1={text1} text2={text2} />
          ),
          error: ({ text1, text2 }) => (
            <ToastView isDark={isDark} type="error" text1={text1} text2={text2} />
          ),
        }}
      />
    </View>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthInitGate>
            <AuthProvider>
              <CopilotProvider>
                {/* Location can initialize in parallel; UI no longer blocked on it */}
                <LocationProvider>
                  <ItineraryProvider>
                    <DateIdeasProvider>
                      <ActionSheetProvider>
                        <MainApp />
                      </ActionSheetProvider>
                    </DateIdeasProvider>
                  </ItineraryProvider>
                </LocationProvider>
              </CopilotProvider>
            </AuthProvider>
          </AuthInitGate>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
