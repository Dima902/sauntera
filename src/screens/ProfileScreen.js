// ProfileScreen.js — flicker-free focus + stable plan render
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, Image, Alert, InteractionManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BottomNav from '../components/BottomNav';
import { doc, getDoc } from 'firebase/firestore';
import { db, getAuthInstance } from '../config/firebaseConfig';
import { useNavigation, useRoute, useIsFocused } from '@react-navigation/native';
import { reload } from 'firebase/auth';
import { useTheme } from '../styles/theme';
import { createProfileScreenStyles } from '../styles/ProfileScreenStyles';
import Toast from 'react-native-toast-message';
import { useUserStatus } from '../hooks/useUserStatus';

export default function ProfileScreen({ navigation: navProp }) {
  const navigation = navProp || useNavigation();
  const route = useRoute();
  const isFocused = useIsFocused();

  const theme = useTheme();
  const styles = useMemo(() => createProfileScreenStyles(theme), [theme]);

  // ✅ Single source of truth for auth/tier (prevents plan flicker)
  const { user, isGuest, isPremium, isLoading: userStatusLoading } = useUserStatus();

  const [authInstance, setAuthInstance] = useState(null);
  const [localUser, setLocalUser] = useState(null);
  const [profile, setProfile] = useState({ age: '', interests: [] });

  // ——— Anti-flicker guards ———
  const inFlightRef = useRef(false);
  const lastLoadedUidRef = useRef(null);
  const photoHandledRef = useRef(false); // prevent setParams loop
  const unmountedRef = useRef(false);

  useEffect(() => {
    return () => { unmountedRef.current = true; };
  }, []);

  // Init auth once
  useEffect(() => {
    (async () => {
      const auth = await getAuthInstance();
      if (unmountedRef.current) return;
      setAuthInstance(auth);
      setLocalUser(auth?.currentUser || null);
    })();
  }, []);

  // Keep localUser synced with hook user, but don’t bounce on every render
  useEffect(() => {
    if (!authInstance) return;
    if (user && user.uid !== localUser?.uid) {
      setLocalUser(authInstance.currentUser || user);
    }
  }, [user, authInstance]);

  // Memoize static lists to reduce renders
  const premiumBenefits = useMemo(
    () => ([
      { label: 'Unlimited date saves', info: 'Save as many date ideas as you like — no limits!' },
      { label: 'Full itinerary builder', info: 'Plan full evenings with 3+ steps — like dinner, show, and dessert.' },
      { label: 'All categories + secret spots', info: 'Access exclusive ideas including hidden gems and premium-only activities.' },
      { label: 'Smart suggestions & reviews', info: 'Get GPT-powered recommendations, ratings, and user tips.' },
    ]),
    []
  );

  const freeIncluded = useMemo(
    () => ([
      { label: 'Save up to 5 date ideas', info: 'Free users can save 5 favorite ideas to revisit anytime.' },
      { label: '1 date night with up to 2 activities', info: 'You can build a short date with two steps — like coffee then a walk.' },
      { label: 'Limited filters', info: 'Free plan gives access to basic filters like Romantic Dinner, Outdoor Adventure, Budget-Friendly' },
    ]),
    []
  );

  const freeUpsell = useMemo(
    () => ([
      { label: 'Unlimited date saves', info: 'Save as many date ideas as you like — no limits!' },
      { label: 'Full itinerary builder', info: 'Plan full evenings with 3+ steps — like dinner, show, and dessert.' },
      { label: 'Advanced Filters', info: 'Access category-specific filters like mood, activity type, and indoor/outdoor preference.' },
      { label: 'All categories + secret spots', info: 'Explore exclusive ideas and hidden gems not available to free users.' },
      { label: 'Smart suggestions & reviews', info: 'Get AI-enhanced tips, user insights, and better matches.' },
    ]),
    []
  );

  // Load/refresh profile on focus — guarded to run once per focus + uid
  useEffect(() => {
    if (!isFocused) return;
    if (userStatusLoading) return;
    if (!authInstance?.currentUser || isGuest) return;

    const uid = authInstance.currentUser.uid;

    // Skip if same user and already loaded this focus
    if (inFlightRef.current) return;

    inFlightRef.current = true;

    const run = async () => {
      try {
        // Defer expensive work until after animations to avoid visible layout jumps
        await new Promise(resolve => InteractionManager.runAfterInteractions(resolve));

        // Refresh auth user (photo, displayName, etc.)
        await reload(authInstance.currentUser);
        const refreshedUser = authInstance.currentUser;

        // Handle updated photo param exactly once to avoid param->rerender loop
        const updatedPhoto = route?.params?.updatedPhotoURL;
        if (updatedPhoto && !photoHandledRef.current) {
          setLocalUser({ ...refreshedUser, photoURL: updatedPhoto });
          photoHandledRef.current = true;
          setTimeout(() => {
            // Clear param after commit — prevents immediate second focus tick
            if (!unmountedRef.current) {
              navigation.setParams({ updatedPhotoURL: undefined });
            }
          }, 0);
          Toast.show({
            type: 'success',
            text1: 'Profile updated',
            position: 'top',
            visibilityTime: 1500,
          });
        } else {
          setLocalUser(refreshedUser);
        }

        // Only refetch Firestore if the uid changed or we don’t have profile yet
        if (lastLoadedUidRef.current !== uid || !profile || (!profile.age && (!profile.interests || profile.interests.length === 0))) {
          const snap = await getDoc(doc(db, 'users', uid));
          if (snap.exists()) {
            const data = snap.data() || {};
            if (!unmountedRef.current) {
              setProfile({
                age: data.age || '',
                interests: Array.isArray(data.interests) ? data.interests : [],
              });
              if (__DEV__) console.log('📋 Profile loaded:', data);
            }
          }
          lastLoadedUidRef.current = uid;
        }
      } catch (err) {
        console.warn('Error refreshing user/profile:', err);
      } finally {
        inFlightRef.current = false;
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused, userStatusLoading, authInstance, isGuest]);

  // Minimal shell while we hydrate auth + tier
  if (userStatusLoading || !authInstance) {
    return (
      <View style={styles.profilecontainer}>
        <View style={styles.profileInnerContent}>
          <View style={styles.headerRow}>
            <Text style={styles.savedtitle}>Profile</Text>
            <Ionicons name="settings-outline" size={24} color={theme.text} />
          </View>
        </View>
        <View style={styles.bottomNavWrapper}>
          <BottomNav navigation={navigation} />
        </View>
      </View>
    );
  }

  // Guest view
  if (!user || isGuest) {
    return (
      <View style={styles.profilecontainer}>
        <View style={styles.guestProfileContainer}>
          <Ionicons name="person-circle-outline" size={80} color={theme.primary} />
          <Text style={styles.guestProfileText}>
            You’re exploring as a guest.{'\n'}
            <Text style={styles.guestProfileLink} onPress={() => navigation.navigate('LoginScreen')}>
              Sign up to create your profile!
            </Text>
          </Text>
          <TouchableOpacity
            style={styles.signupButton}
            onPress={() => navigation.navigate('LoginScreen')}
          >
            <Text style={styles.signupButtonText}>Sign Up / Log In</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.bottomNavWrapper}>
          <BottomNav navigation={navigation} />
        </View>
      </View>
    );
  }

  const { displayName, photoURL } = localUser || {};

  const showInfo = (message) => {
    Alert.alert('Feature Info', message, [{ text: 'OK' }]);
  };

  return (
    <View style={styles.profilecontainer}>
      <View style={styles.profileInnerContent}>
        <View style={styles.headerRow}>
          <Text style={styles.savedtitle}>Profile</Text>
          <TouchableOpacity onPress={() => navigation.navigate('SettingsScreen')}>
            <Ionicons name="settings-outline" size={24} color={theme.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.avatarRowLeftAligned}>
          <Image
            source={photoURL ? { uri: photoURL } : require('../../assets/default-avatar.png')}
            style={styles.smallAvatar}
          />
          <View style={styles.nameSection}>
            <Text style={styles.profilename}>
              {displayName || 'User'}
              {profile.age ? `, ${profile.age}` : ''}
            </Text>
            <TouchableOpacity
              style={styles.profilemodifyButtonMini}
              onPress={() => navigation.navigate('ProfileSetupScreen')}
            >
              <Text style={styles.profilebuttonText}>Edit Profile</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Plan header uses hook (stable) and only renders after userStatusLoading=false */}
        <View style={styles.subscriptionContainer}>
          <View style={styles.planHeader}>
            <Text style={styles.planLabel}>You're on the</Text>
            <View style={styles.planBadge}>
              <Text style={styles.planBadgeText}>{isPremium ? 'Premium Plan' : 'Free Plan'}</Text>
            </View>
          </View>

          {isPremium ? (
            <View style={styles.benefitList}>
              <Text style={styles.benefitTitle}>Your Benefits:</Text>
              {premiumBenefits.map(({ label, info }, i) => (
                <View key={i} style={styles.benefitItem}>
                  <Ionicons name="checkmark-circle" size={22} color={theme.primary} />
                  <Text style={styles.benefitText}>{label}</Text>
                  <TouchableOpacity onPress={() => showInfo(info)}>
                    <Ionicons
                      name="information-circle-outline"
                      size={18}
                      color={theme.textSecondary || '#999'}
                      style={{ marginLeft: 6 }}
                    />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : (
            <>
              <View style={styles.benefitList}>
                <Text style={styles.benefitTitle}>What's included:</Text>
                {freeIncluded.map(({ label, info }, i) => (
                  <View key={i} style={styles.benefitItem}>
                    <Ionicons name="checkmark-circle" size={20} color={theme.text} />
                    <Text style={styles.benefitText}>{label}</Text>
                    <TouchableOpacity onPress={() => showInfo(info)}>
                      <Ionicons name="information-circle-outline" size={18} color={theme.textSecondary || '#999'} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              <View style={styles.divider} />
              <Text style={styles.benefitTitle}>Go Premium to unlock:</Text>
              {freeUpsell.map(({ label, info }, i) => (
                <View key={i} style={styles.benefitItem}>
                  <Ionicons name="checkmark-circle" size={22} color={theme.primary} />
                  <Text style={styles.benefitText}>{label}</Text>
                  <TouchableOpacity onPress={() => showInfo(info)}>
                    <Ionicons name="information-circle-outline" size={18} color={theme.textSecondary || '#999'} />
                  </TouchableOpacity>
                </View>
              ))}

              <TouchableOpacity style={styles.premiumButton} onPress={() => navigation.navigate('SubscriptionScreen')}>
                <Text style={styles.premiumButtonText}>Try Premium Free for 2 Weeks</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      <View style={styles.bottomNavWrapper}>
        <BottomNav navigation={navigation} />
      </View>
    </View>
  );
}
