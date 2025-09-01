// AppNavigator.js (fast initial route, no extra gating)
import React from 'react';
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';
import { SafeAreaView } from 'react-native-safe-area-context';

import LoadingScreen from '../screens/LoadingScreen';
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import SignupScreen from '../screens/SignupScreen';
import ProfileSetupScreen from '../screens/ProfileSetupScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SavedScreen from '../screens/SavedScreen';
import FiltersScreen from '../screens/FiltersScreen';
import LocationSelectorScreen from '../screens/LocationSelectorScreen';
import DateIdeaDetails from '../screens/DateIdeaDetails';
import ItineraryOverviewScreen from '../screens/ItineraryOverviewScreen';
import SubscriptionScreen from '../screens/SubscriptionScreen';
import SettingsScreen from '../screens/SettingsScreen';
import EmailLoginScreen from '../screens/EmailLoginScreen';
import HistoryScreen from '../screens/HistoryScreen';
import LegalScreen from '../screens/LegalScreen';
import VerifyEmailScreen from '../screens/VerifyEmailScreen';
import PhoneLoginScreen from '../screens/PhoneLoginScreen';;

const Stack = createStackNavigator();

function withSafeArea(Component) {
  return (props) => (
    <SafeAreaView style={{ flex: 1 }}>
      <Component {...props} />
    </SafeAreaView>
  );
}

export default function AppNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="LoadingScreen"
      detachInactiveScreens={true}
      screenOptions={{
        headerShown: false,
        // Disable stack gestures so horizontal swipes in decks aren't intercepted
        gestureEnabled: false,
        cardStyleInterpolator: CardStyleInterpolators.forFadeFromBottomAndroid,
      }}
    >
      <Stack.Screen name="LoadingScreen" component={withSafeArea(LoadingScreen)} />
      <Stack.Screen name="LoginScreen" component={withSafeArea(LoginScreen)} />
      <Stack.Screen name="SignupScreen" component={withSafeArea(SignupScreen)} />
      <Stack.Screen name="HomeScreen" component={withSafeArea(HomeScreen)} />
      <Stack.Screen name="ProfileSetupScreen" component={withSafeArea(ProfileSetupScreen)} />
      <Stack.Screen name="ProfileScreen" component={withSafeArea(ProfileScreen)} />
      <Stack.Screen name="SavedScreen" component={withSafeArea(SavedScreen)} />
      <Stack.Screen name="FiltersScreen" component={withSafeArea(FiltersScreen)} />
      <Stack.Screen name="LocationSelectorScreen" component={withSafeArea(LocationSelectorScreen)} />
      <Stack.Screen name="DateIdeaDetails" component={withSafeArea(DateIdeaDetails)} />
      <Stack.Screen name="ItineraryOverviewScreen" component={withSafeArea(ItineraryOverviewScreen)} />
      <Stack.Screen name="SubscriptionScreen" component={withSafeArea(SubscriptionScreen)} />
      <Stack.Screen name="SettingsScreen" component={withSafeArea(SettingsScreen)} />
      <Stack.Screen name="EmailLoginScreen" component={withSafeArea(EmailLoginScreen)} />
      <Stack.Screen name="HistoryScreen" component={withSafeArea(HistoryScreen)} />
      <Stack.Screen name="LegalScreen" component={withSafeArea(LegalScreen)} />
      <Stack.Screen name="PhoneLoginScreen" component={withSafeArea(PhoneLoginScreen)} />
      <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}
