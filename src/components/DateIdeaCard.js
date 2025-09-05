// src/components/DateIdeaCard.js
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  Alert,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { doc, setDoc, deleteDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import slugify from 'slugify';
import { getAuthInstance, db } from '../config/firebaseConfig';
import { useTheme } from '../styles/theme';
import { createHomeScreenStyles } from '../styles/HomeScreenStyles';
import { Image } from 'expo-image';
import PremiumUpsellSheet from './PremiumUpsellSheet';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useGemTracker } from '../hooks/useGemTracker';
import { useUserStatus } from '../hooks/useUserStatus';
import Toast from 'react-native-toast-message';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ───────────────────────────────────────────────────────────────────────────────
// Native Firebase (RNFirebase) modules — used when phone auth is active
let rnfbAuth = null;
let rnfbFirestore = null;
try {
  rnfbAuth = require('@react-native-firebase/auth').default;
  rnfbFirestore = require('@react-native-firebase/firestore').default;
} catch {
  rnfbAuth = null;
  rnfbFirestore = null;
}

// Unified current user (prefer native phone-auth, fallback to web)
const getUnifiedCurrentUser = (webAuthRef, hookUser) => {
  if (hookUser?.uid) return hookUser;
  const nativeUser = rnfbAuth?.()?.currentUser;
  if (nativeUser) return nativeUser;
  return webAuthRef?.current?.currentUser || null;
};

// Native-first writer
async function writeSavedIdeaNativeFirst({ uid, ideaId, idea, webDb }) {
  if (rnfbAuth?.() && rnfbAuth().currentUser && rnfbFirestore) {
    await rnfbFirestore()
      .collection('users')
      .doc(uid)
      .collection('savedIdeas')
      .doc(ideaId)
      .set(
        {
          ...idea,
          id: ideaId,
          createdAt: rnfbFirestore.FieldValue.serverTimestamp(),
          savedAt: rnfbFirestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    return;
  }
  // Web fallback
  const ideaRef = doc(webDb, `users/${uid}/savedIdeas`, ideaId);
  await setDoc(
    ideaRef,
    {
      ...idea,
      id: ideaId,
      createdAt: serverTimestamp(),
      savedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

// Native-first existence check
async function isIdeaSavedNativeFirst({ uid, ideaId, webDb }) {
  if (rnfbAuth?.() && rnfbAuth().currentUser && rnfbFirestore) {
    const snap = await rnfbFirestore()
      .collection('users')
      .doc(uid)
      .collection('savedIdeas')
      .doc(ideaId)
      .get();
    return !!snap.exists;
  }
  const ideaRef = doc(webDb, `users/${uid}/savedIdeas`, ideaId);
  const snap = await getDoc(ideaRef);
  return snap.exists();
}

// Native-first delete
async function deleteSavedIdeaNativeFirst({ uid, ideaId, webDb }) {
  if (rnfbAuth?.() && rnfbAuth().currentUser && rnfbFirestore) {
    await rnfbFirestore()
      .collection('users')
      .doc(uid)
      .collection('savedIdeas')
      .doc(ideaId)
      .delete();
    return;
  }
  await deleteDoc(doc(webDb, `users/${uid}/savedIdeas`, ideaId));
}

const DateIdeaCard = ({ idea, navigation, isHiddenGem = false }) => {
  const theme = useTheme();
  const styles = useMemo(() => createHomeScreenStyles(theme), [theme?.mode]);

  const [scale] = useState(new Animated.Value(1));
  const [pulse] = useState(new Animated.Value(1));
  const [revealAnim] = useState(new Animated.Value(0));

  const [isSaved, setIsSaved] = useState(false);
  const [wasJustUnlocked, setWasJustUnlocked] = useState(false);

  const authRef = useRef(null);
  const bottomSheetRef = useRef(null);
  const ideaId =
    idea.id ||
    slugify(idea.title || 'untitled', { lower: true, strict: true });
  const imageUri = idea.image || 'https://via.placeholder.com/400x300';

  const { hasUnlocked, unlockGem } = useGemTracker();
  const gemUnlocked = hasUnlocked(ideaId);
  const locationBadge = idea.generatedFromNearbyCity
    ? idea.location?.split(',')[0]?.trim()
    : null;

  // ✅ Mirror ProfileScreen: use unified auth/tier from the hook
  const {
    user: hookUser,
    isGuest: userIsGuest,
    isFreeUser: userIsFree,
    isPremium: userIsPremium,
  } = useUserStatus(); // single source of truth for auth status  :contentReference[oaicite:3]{index=3}

  const isGuest = !!userIsGuest;

  // Init auth + pre-check saved
  useEffect(() => {
    let unsubNav;
    (async () => {
      const auth = await getAuthInstance(); // web auth instance
      authRef.current = auth;

      await checkIfSaved();
      unsubNav = navigation.addListener('focus', checkIfSaved);
    })();
    return () => unsubNav && unsubNav();
  }, [navigation]);

  const checkIfSaved = useCallback(async () => {
    const u = getUnifiedCurrentUser(authRef, hookUser);
    if (!u) {
      setIsSaved(false);
      return;
    }
    try {
      const exists = await isIdeaSavedNativeFirst({
        uid: u.uid,
        ideaId,
        webDb: db,
      });
      setIsSaved(!!exists);
    } catch (error) {
      console.error('❌ Error checking saved status:', error);
    }
  }, [ideaId, hookUser]);

  const handleSaveIdea = useCallback(async () => {
    const u = getUnifiedCurrentUser(authRef, hookUser);
    if (!u) {
      Alert.alert('Login Required', 'You need to log in to save ideas.');
      return;
    }

    // Optimistic UI
    setIsSaved(true);

    try {
      await writeSavedIdeaNativeFirst({
        uid: u.uid,
        ideaId,
        idea,
        webDb: db,
      });
      Toast.show({ type: 'success', text1: 'Saved to Favorites' });
    } catch (error) {
      console.error('❌ Error saving idea:', error);
      setIsSaved(false); // revert on failure
      Toast.show({ type: 'error', text1: 'Could not save. Try again.' });
    }
  }, [idea, ideaId, hookUser]);

  const handleDeleteSaved = useCallback(async () => {
    const u = getUnifiedCurrentUser(authRef, hookUser);
    if (!u) return;

    // Optimistic UI
    setIsSaved(false);

    try {
      await deleteSavedIdeaNativeFirst({
        uid: u.uid,
        ideaId,
        webDb: db,
      });
      Toast.show({ type: 'info', text1: 'Removed from Saved' });
    } catch (error) {
      console.error('❌ Error deleting saved idea:', error);
      setIsSaved(true); // revert on failure
      Toast.show({ type: 'error', text1: 'Could not remove. Try again.' });
    }
  }, [ideaId, hookUser]);

  const toggleSaveIdea = useCallback(() => {
    isSaved ? handleDeleteSaved() : handleSaveIdea();
  }, [isSaved, handleDeleteSaved, handleSaveIdea]);

  const shareIdea = useCallback(async () => {
    try {
      await Share.share({
        message: `Check out this date idea: ${idea.title}\n${idea.description}\nFound on Sauntera!`,
      });
    } catch (error) {
      console.error('❌ Error sharing idea:', error);
    }
  }, [idea]);

  const triggerPulse = () => {
    Animated.sequence([
      Animated.timing(pulse, { toValue: 1.05, duration: 100, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
  };

  const handlePress = useCallback(async () => {
    const alreadyUnlocked = gemUnlocked || wasJustUnlocked;

    if (isHiddenGem && !alreadyUnlocked) {
      triggerPulse();

      if (isGuest) {
        navigation.navigate('LoginScreen');
        return;
      }

      try {
        const raw = await AsyncStorage.getItem('persistedGemIds');
        const unlockedIds = raw ? JSON.parse(raw) : [];
        const gemLimit = userIsPremium ? 2 : (userIsFree ? 1 : 0);
        const hasReachedLimit = unlockedIds.length >= gemLimit;

        if (!hasReachedLimit) {
          await unlockGem(ideaId);
          setWasJustUnlocked(true);

          Animated.timing(revealAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }).start();

          Toast.show({
            type: 'success',
            text1: 'Gem Unlocked!',
            text2: `You've unlocked ${unlockedIds.length + 1} of ${gemLimit} gems today.`,
            visibilityTime: 2000,
          });
          return;
        }
        if (userIsFree) {
          navigation.navigate('SubscriptionScreen');
          return;
        } else {
          return;
        }
      } catch (err) {
        console.error('❌ Error checking gem unlock state:', err);
      }
    }

    navigation.navigate('DateIdeaDetails', { idea });
  }, [idea, isHiddenGem, gemUnlocked, wasJustUnlocked, ideaId, unlockGem, navigation, isGuest, userIsPremium, userIsFree]);

  let ctaText = '';
  if (isGuest) ctaText = 'Login to See More';
  else if (gemUnlocked || wasJustUnlocked) ctaText = '';
  else ctaText = 'Tap to Unlock';

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPressIn={() => Animated.timing(scale, { toValue: 0.97, duration: 100, useNativeDriver: true }).start()}
      onPressOut={() => Animated.timing(scale, { toValue: 1, duration: 100, useNativeDriver: true }).start()}
      onPress={handlePress}
    >
      <Animated.View style={[styles.card, { transform: [{ scale }, { scale: pulse }] }]}>
        <Image
          style={styles.cardImage}
          source={imageUri}
          contentFit="cover"
          transition={300}
          priority="low"
          blurRadius={isHiddenGem && !gemUnlocked && !wasJustUnlocked ? 20 : 0}
        />

        {locationBadge && !isHiddenGem && (
          <View style={styles.badgeContainer}>
            <Text style={styles.badgeText}>Nearby: {locationBadge}</Text>
          </View>
        )}

        <Animated.View
          style={[
            styles.cardContent,
            wasJustUnlocked && {
              transform: [
                {
                  scale: revealAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.95, 1],
                  }),
                },
              ],
            },
          ]}
        >
          {(!isHiddenGem || gemUnlocked || wasJustUnlocked) && (
            <>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{idea.title || 'No Title'}</Text>
                <TouchableOpacity onPress={toggleSaveIdea} style={styles.saveButton}>
                  <Ionicons
                    name={isSaved ? 'bookmark' : 'bookmark-outline'}
                    size={24}
                    color={theme.iconActive}
                  />
                </TouchableOpacity>
              </View>
              <Text style={styles.cardDescription}>
                {idea.description || 'No description available.'}
              </Text>
              <Text style={styles.cardPrice}>Price: {idea.price || 'Unknown'}</Text>
            </>
          )}
        </Animated.View>

        {isHiddenGem && !gemUnlocked && !wasJustUnlocked && !!ctaText && (
          <View style={styles.gemOverlayAbsolute}>
            <Text style={styles.gemTitle}>🌟 Hidden Gem</Text>
            <Text style={styles.gemSubtitle}>Unlock this and more with Premium</Text>
            <TouchableOpacity onPress={handlePress} style={styles.gemButton}>
              <Text style={styles.gemButtonText}>{ctaText}</Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>

      <PremiumUpsellSheet
        bottomSheetRef={bottomSheetRef}
        onUpgradePress={() => navigation.navigate('SubscriptionScreen')}
      />
    </TouchableOpacity>
  );
};

export default React.memo(DateIdeaCard);
