import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  Alert,
  Share,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { doc, setDoc, deleteDoc, getDoc } from 'firebase/firestore';
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

const DateIdeaCard = ({ idea, navigation, isHiddenGem = false }) => {
  const theme = useTheme();
  const styles = useMemo(() => createHomeScreenStyles(theme), [theme?.mode]);

  const [scale] = useState(new Animated.Value(1));
  const [pulse] = useState(new Animated.Value(1));
  const [revealAnim] = useState(new Animated.Value(0));

  const [isSaved, setIsSaved] = useState(false);
  const [user, setUser] = useState(null);
  const [wasJustUnlocked, setWasJustUnlocked] = useState(false);

  const authRef = useRef(null);
  const bottomSheetRef = useRef(null);
  const ideaId = idea.id || slugify(idea.title || 'untitled', { lower: true, strict: true });
  const imageUri = idea.image || 'https://via.placeholder.com/400x300';

  const { hasUnlocked, unlockGem } = useGemTracker();
  const gemUnlocked = hasUnlocked(ideaId);
  const locationBadge = idea.generatedFromNearbyCity ? idea.location?.split(',')[0]?.trim() : null;

  // Determine user status. useUserStatus exposes whether the user is a
  // guest, free user, or premium. We use this to control gem unlocking
  // limits and actions. Note that isFreeUser means logged-in but not
  // premium; isPremium implies both isGuest and isFreeUser are false.
  const { isGuest: userIsGuest, isFreeUser: userIsFree, isPremium: userIsPremium } = useUserStatus();

  // Fallback to current auth user when hook has not yet resolved. The
  // previous logic used local user state to derive guest status. We'll
  // maintain the original behaviour when hook values are undefined.
  const isGuest = userIsGuest !== undefined ? userIsGuest : !user;

  useEffect(() => {
    let unsubscribe;
    (async () => {
      const auth = await getAuthInstance();
      authRef.current = auth;
      setUser(auth.currentUser);
      checkIfSaved(auth);
      unsubscribe = navigation.addListener('focus', () => checkIfSaved(auth));
    })();
    return () => unsubscribe && unsubscribe();
  }, [navigation]);

  const checkIfSaved = useCallback(async (auth) => {
    const user = auth?.currentUser;
    if (!user) return;
    try {
      const ideaRef = doc(db, `users/${user.uid}/savedIdeas`, ideaId);
      const docSnap = await getDoc(ideaRef);
      setIsSaved(docSnap.exists());
    } catch (error) {
      console.error("❌ Error checking saved status:", error);
    }
  }, [ideaId]);

  const handleSaveIdea = useCallback(async () => {
    const user = authRef.current?.currentUser;
    if (!user) {
      Alert.alert("Login Required", "You need to log in to save ideas.");
      return;
    }
    try {
      const ideaRef = doc(db, `users/${user.uid}/savedIdeas`, ideaId);
      await setDoc(ideaRef, idea, { merge: true });
      setIsSaved(true);
      Toast.show({ type: 'success', text1: 'Saved to Favorites' });
    } catch (error) {
      console.error("❌ Error saving idea:", error);
    }
  }, [idea, ideaId]);

  const deleteSavedIdea = useCallback(async () => {
    const user = authRef.current?.currentUser;
    if (!user) return;
    try {
      const ideaRef = doc(db, `users/${user.uid}/savedIdeas`, ideaId);
      await deleteDoc(ideaRef);
      setIsSaved(false);
      Toast.show({ type: 'info', text1: 'Removed from Saved' });
    } catch (error) {
      console.error("❌ Error deleting saved idea:", error);
    }
  }, [ideaId]);

  const toggleSaveIdea = useCallback(() => {
    isSaved ? deleteSavedIdea() : handleSaveIdea();
  }, [isSaved, handleSaveIdea, deleteSavedIdea]);

  const shareIdea = useCallback(async () => {
    try {
      await Share.share({
        message: `Check out this date idea: ${idea.title}\n${idea.description}\nFound on Sauntera!`,
      });
    } catch (error) {
      console.error("❌ Error sharing idea:", error);
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

      // Guests cannot unlock gems; redirect them to login.
      if (isGuest) {
        navigation.navigate('LoginScreen');
        return;
      }

      try {
        const raw = await AsyncStorage.getItem('persistedGemIds');
        const unlockedIds = raw ? JSON.parse(raw) : [];

        // Determine the maximum number of gems a user can unlock per day.
        // Premium users may unlock two gems, free users one, guests zero.
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
        // If the user has reached their daily limit: free users are
        // encouraged to upgrade; premium users silently ignore; guests
        // should never hit this branch (handled above).
        if (userIsFree) {
          navigation.navigate('SubscriptionScreen');
          return;
        } else {
          // For premium users who somehow exceed their limit, just return.
          return;
        }
      } catch (err) {
        console.error('❌ Error checking gem unlock state:', err);
      }
    }

    navigation.navigate('DateIdeaDetails', { idea });
  }, [idea, isHiddenGem, gemUnlocked, wasJustUnlocked, ideaId, unlockGem, navigation, isGuest]);

  let ctaText = '';
  if (isGuest) {
    ctaText = 'Login to See More';
  } else if (gemUnlocked || wasJustUnlocked) {
    ctaText = '';
  } else {
    ctaText = 'Tap to Unlock';
  }

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

        <Animated.View style={[styles.cardContent, wasJustUnlocked && {
          transform: [{
            scale: revealAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0.95, 1],
            })
          }],
        }]}>
          {(!isHiddenGem || gemUnlocked || wasJustUnlocked) && (
            <>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{idea.title || 'No Title'}</Text>
                <TouchableOpacity onPress={toggleSaveIdea} style={styles.saveButton}>
                  <Ionicons
                    name={isSaved ? "bookmark" : "bookmark-outline"}
                    size={24}
                    color={theme.iconActive}
                  />
                </TouchableOpacity>
              </View>
              <Text style={styles.cardDescription}>{idea.description || 'No description available.'}</Text>
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
