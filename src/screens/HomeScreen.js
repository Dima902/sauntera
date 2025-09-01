// HomeScreen.js (with premium-only LocationSelector + guest-blocked Filters button)
import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Keyboard,
  InteractionManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

import { LocationContext } from '../context/LocationContext';
import { DateIdeasContext } from '../context/DateIdeasContext';
import { useTheme } from '../styles/theme';
import { createHomeScreenStyles } from '../styles/HomeScreenStyles';

import BottomNav from '../components/BottomNav';
import ZoomToast from '../components/ZoomToast';
import MainDeckSection from '../components/MainDeckSection';
import RestaurantDeckSection from '../components/RestaurantDeckSection';
import PremiumUpsellSheet from '../components/PremiumUpsellSheet';
import { useUserStatus } from '../hooks/useUserStatus';

export default function HomeScreen() {
  const navigation = useNavigation();
  const theme = useTheme();
  const styles = useMemo(() => createHomeScreenStyles(theme), [theme]);

  const { location, locationCoords } = useContext(LocationContext);
  const { setFilters } = useContext(DateIdeasContext);

  const [toastMessage, setToastMessage] = useState(null);
  const [showUpsell, setShowUpsell] = useState(false);

  // Centralized user state
  const { isGuest, isPremium, isLoading: userStatusLoading } = useUserStatus();

  // Avoid infinite updates: clear filters ONCE when we confirm guest mode
  const guestFiltersClearedRef = useRef(false);
  useEffect(() => {
    if (userStatusLoading) return; // wait until status is known
    if (isGuest && !guestFiltersClearedRef.current) {
      setFilters({ 'Quick Filters': [], 'Advanced Filters': [] }, { skipPersist: true });
      guestFiltersClearedRef.current = true;
    }
    if (!isGuest) {
      guestFiltersClearedRef.current = false;
    }
  }, [isGuest, userStatusLoading, setFilters]);

  // Premium-only LocationSelector
  const handleLocationPress = () => {
    Keyboard.dismiss();
    if (userStatusLoading) return; // ignore taps until status known

    if (isGuest) {
      setToastMessage('Location selection is a premium feature.');
      return;
    }

    if (!isPremium) {
      // Free user → upsell
      setShowUpsell(true);
      return;
    }

    // Premium → proceed
    navigation.navigate('LocationSelectorScreen');
  };

  // Guest-blocked Filters button handler (used by MainDeckSection)
  const handleFilterPress = () => {
    Keyboard.dismiss();
    if (userStatusLoading) return;

    if (isGuest) {
      setToastMessage('Sign up to use filters');
      return;
    }

    // Free and Premium users can use Filters
    navigation.navigate('FiltersScreen');
  };

  // ---- Coordinated height lock across both sections ----
  const [mainLoading, setMainLoading] = useState(false);
  const [restaurantLoading, setRestaurantLoading] = useState(false);
  const forceLockHeight = mainLoading || restaurantLoading;
  // ------------------------------------------------------

  // ---- Render content only after interactions (prevents 0.1s snap) ----
  const [contentReady, setContentReady] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      Keyboard.dismiss();
      let isActive = true;
      const task = InteractionManager.runAfterInteractions(() => {
        if (isActive) setContentReady(true);
      });
      return () => {
        isActive = false;
        setContentReady(false);
        task.cancel?.();
      };
    }, [])
  );
  // ---------------------------------------------------------------------

  // Optional: pass auth actions down to deck sections (they can forward to SwipeDeck)
  const onLogin = () => navigation.navigate('LoginScreen'); // name per your navigator
  const onUpgrade = () => navigation.navigate('SubscriptionScreen');

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerWrapper}>
        <View style={styles.header}>
          <Text style={styles.logo}>Sauntera</Text>
          <TouchableOpacity style={styles.locationButton} onPress={handleLocationPress}>
            <Ionicons
              name="location-outline"
              size={16}
              color={theme.iconActive}
              style={styles.locationIcon}
            />
            <Text style={styles.locationButtonText} numberOfLines={1}>
              {location ? location.split(',')[0].trim() : 'Select Location'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Guest banner (only after user status is known) */}
      {!userStatusLoading && isGuest && (
        <View style={styles.guestBanner}>
          <Ionicons
            name="person-circle-outline"
            size={22}
            color="#FF9500"
            style={{ marginRight: 8 }}
          />
          <Text style={styles.guestBannerText}>
            You’re exploring as a guest.{' '}
            <Text
              style={styles.guestBannerLink}
              onPress={() => navigation.navigate('LoginScreen')}
            >
              Sign up for full access
            </Text>
          </Text>
        </View>
      )}

      {/* Content */}
      {contentReady && (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 80 }}
          keyboardShouldPersistTaps="always"
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View>
              <MainDeckSection
                location={location}
                coords={locationCoords}
                // report loading up + receive lock flag
                onLoadingChange={setMainLoading}
                forceLockHeight={forceLockHeight}
                // guests see toast instead of navigation
                onPressFilters={handleFilterPress}
                // OPTIONAL: also pass auth state & actions for sections that forward to SwipeDeck
                isGuest={isGuest}
                onLogin={onLogin}
                onUpgrade={onUpgrade}
              />

              <RestaurantDeckSection
                location={location}
                // report loading up + receive lock flag
                onLoadingChange={setRestaurantLoading}
                forceLockHeight={forceLockHeight}
                // OPTIONAL: forward auth props
                isGuest={isGuest}
                onLogin={onLogin}
                onUpgrade={onUpgrade}
              />

              <View style={styles.madeWithRow}>
                <Text style={styles.madeWithText}>made with </Text>
                <Ionicons
                  name="heart-outline"
                  size={15}
                  color={theme.textSecondary}
                  style={styles.heartIcon}
                />
              </View>
            </View>
          </TouchableWithoutFeedback>
        </ScrollView>
      )}

      <BottomNav navigation={navigation} />

      {/* Toast */}
      {toastMessage && (
        <ZoomToast
          visible={true}
          message={toastMessage}
          onPress={() => setToastMessage(null)}
          top={120}
        />
      )}

      {/* Upsell for free users — keep mounted, just toggle visible */}
      <PremiumUpsellSheet
        visible={showUpsell}
        onClose={() => setShowUpsell(false)}
      />
    </View>
  );
}
