// src/screens/SavedScreen.js
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View, Text, FlatList, Image, TouchableOpacity,
  TouchableNativeFeedback, Platform, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAuthInstance, db } from '../config/firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import BottomNav from '../components/BottomNav';
import { BlurView } from 'expo-blur';
import { useTheme } from '../styles/theme';
import { createSavedScreenStyles } from '../styles/SavedScreenStyles';

// Try to load native Firebase Auth (phone auth path)
let rnfbAuth = null;
try {
  rnfbAuth = require('@react-native-firebase/auth').default;
} catch {
  rnfbAuth = null;
}

const DELETE_DELAY_MS = 4000;

export default function SavedScreen({ navigation }) {
  const theme = useTheme();
  const styles = useMemo(() => createSavedScreenStyles(theme), [theme]);

  const [savedIdeas, setSavedIdeas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState(null);
  const [undoItem, setUndoItem] = useState(null);
  const [undoRemainingMs, setUndoRemainingMs] = useState(0);
  const undoIntervalRef = useRef(null);
  const undoDeadlineRef = useRef(null);
  const [isGuest, setIsGuest] = useState(true);
  const [userId, setUserId] = useState('guest');

  const clearUndoTimers = () => {
    if (undoIntervalRef.current) {
      clearInterval(undoIntervalRef.current);
      undoIntervalRef.current = null;
    }
    undoDeadlineRef.current = null;
  };

  const startUndoCountdown = () => {
    undoDeadlineRef.current = Date.now() + DELETE_DELAY_MS;
    setUndoRemainingMs(DELETE_DELAY_MS);
    if (undoIntervalRef.current) clearInterval(undoIntervalRef.current);
    undoIntervalRef.current = setInterval(() => {
      const remaining = Math.max(0, (undoDeadlineRef.current ?? 0) - Date.now());
      setUndoRemainingMs(remaining);
      if (remaining <= 0) {
        clearUndoTimers();
      }
    }, 100);
  };

  useEffect(() => () => clearUndoTimers(), []);

  // Unified auth subscription: prefer native (phone), fall back to web
  useEffect(() => {
    let unsubWeb;
    let unsubNative;

    (async () => {
      const webAuth = await getAuthInstance();

      // Web listener (email/google, or Expo Go fallback)
      unsubWeb = onAuthStateChanged(webAuth, (webUser) => {
        // If native is present and signed in, native handler will set state
        if (!rnfbAuth) {
          const signedIn = !!webUser;
          setIsGuest(!signedIn);
          setUserId(webUser?.uid || 'guest');
          if (signedIn) fetchSavedIdeas(webUser.uid);
          else {
            setSavedIdeas([]);
            setLoading(false);
          }
        }
      });

      // Native listener (phone auth path)
      if (rnfbAuth) {
        unsubNative = rnfbAuth().onAuthStateChanged((nativeUser) => {
          const signedIn = !!nativeUser;
          setIsGuest(!signedIn);
          setUserId(nativeUser?.uid || 'guest');
          if (signedIn) fetchSavedIdeas(nativeUser.uid);
          else {
            setSavedIdeas([]);
            setLoading(false);
          }
        });

        // If already signed in natively on mount
        const maybeNative = rnfbAuth().currentUser;
        if (maybeNative) {
          setIsGuest(false);
          setUserId(maybeNative.uid);
          fetchSavedIdeas(maybeNative.uid);
        } else {
          // else use current web (if any)
          const maybeWeb = webAuth.currentUser;
          const signedIn = !!maybeWeb;
          setIsGuest(!signedIn);
          setUserId(maybeWeb?.uid || 'guest');
          if (signedIn) fetchSavedIdeas(maybeWeb.uid);
          else setLoading(false);
        }
      } else {
        // No native module: rely on web only
        const maybeWeb = webAuth.currentUser;
        const signedIn = !!maybeWeb;
        setIsGuest(!signedIn);
        setUserId(maybeWeb?.uid || 'guest');
        if (signedIn) fetchSavedIdeas(maybeWeb.uid);
        else setLoading(false);
      }
    })();

    return () => {
      try { unsubWeb && unsubWeb(); } catch {}
      try { unsubNative && unsubNative(); } catch {}
    };
  }, []);

  // Refresh when screen regains focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', async () => {
      if (!isGuest && userId && userId !== 'guest') {
        fetchSavedIdeas(userId);
      }
    });
    return unsubscribe;
  }, [navigation, isGuest, userId]);

  const fetchSavedIdeas = async (uid) => {
    setLoading(true);
    try {
      const userSavedIdeasRef = collection(db, `users/${uid}/savedIdeas`);
      const querySnapshot = await getDocs(userSavedIdeasRef);
      const rawIdeas = querySnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

      const seenWebsites = new Set();
      const uniqueIdeas = rawIdeas.filter((idea) => {
        if (idea.website && seenWebsites.has(idea.website)) return false;
        if (idea.website) seenWebsites.add(idea.website);
        return true;
      });

      // Sort by createdAt (Timestamp) if present
      uniqueIdeas.sort((a, b) => {
        const dateA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const dateB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return dateB - dateA;
      });

      setSavedIdeas(uniqueIdeas);
    } catch (error) {
      console.error('❌ Error fetching saved ideas:', error);
      Alert.alert('Error', 'Failed to load saved ideas.');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveIdea = (idea) => {
    const timeoutId = setTimeout(async () => {
      const uid = userId;
      if (!uid) return;

      try {
        await deleteDoc(doc(db, `users/${uid}/savedIdeas`, idea.id));
        setSavedIdeas((prev) => prev.filter((i) => i.id !== idea.id));
        setUndoItem(null);
        setRemovingId(null);
      } catch (error) {
        console.error('❌ Error deleting saved idea:', error);
      }
      clearUndoTimers();
    }, DELETE_DELAY_MS);

    setUndoItem({ ...idea, timeoutId });
    setRemovingId(idea.id);
    startUndoCountdown();
  };

  const handleUndo = () => {
    if (undoItem) {
      clearTimeout(undoItem.timeoutId);
      setUndoItem(null);
      setRemovingId(null);
      clearUndoTimers();
    }
  };

  const Touchable = Platform.OS === 'android' ? TouchableNativeFeedback : TouchableOpacity;

  const renderEmptyState = () => (
    <View style={styles.emptyStateContainer}>
      <Ionicons name="sparkles-outline" size={80} color={theme.primary} />
      <Text style={styles.emptyText}>No saved ideas yet</Text>
      <TouchableOpacity
        style={styles.ctaButton}
        onPress={() => navigation.navigate('HomeScreen')}
      >
        <Text style={styles.ctaButtonText}>Explore Ideas</Text>
      </TouchableOpacity>
    </View>
  );

  if (isGuest) {
    return (
      <View style={styles.profilecontainer}>
        <View className="guestProfileContainer" style={styles.guestProfileContainer}>
          <Ionicons name="person-circle-outline" size={80} color={theme.primary} />
          <Text style={styles.guestProfileText}>
            You’re exploring as a guest.{'\n'}
            <Text
              style={styles.guestProfileLink}
              onPress={() => navigation.navigate('LoginScreen')}
            >
              Sign up to save your favorite ideas!
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

  return (
    <View style={styles.profilecontainer}>
      <Text style={styles.savedtitle}>Saved Date Ideas</Text>

      {loading ? (
        <View style={{ flex: 1 }} />
      ) : savedIdeas.length > 0 ? (
        <FlatList
          data={savedIdeas}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.savedlistContainer}
          renderItem={({ item }) => (
            <Touchable
              onPress={() => navigation.navigate('DateIdeaDetails', { idea: item })}
              background={
                Platform.OS === 'android'
                  ? TouchableNativeFeedback.Ripple('#ccc', false)
                  : undefined
              }
            >
              <View style={styles.savedcard}>
                {removingId === item.id && (
                  <BlurView
                    intensity={90}
                    tint="light"
                    style={{
                      position: 'absolute',
                      top: 0, left: 0, right: 0, bottom: 0,
                      borderRadius: 10, overflow: 'hidden', zIndex: 2,
                      justifyContent: 'center', alignItems: 'center',
                    }}
                  >
                    <TouchableOpacity
                      onPress={handleUndo}
                      style={{
                        backgroundColor: theme.primary,
                        paddingVertical: 6,
                        paddingHorizontal: 14,
                        borderRadius: 20,
                        marginBottom: 6,
                      }}
                    >
                      <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 13 }}>
                        Undo
                      </Text>
                    </TouchableOpacity>
                    <Text style={{ color: theme.primary, fontWeight: '600', fontSize: 12 }}>
                      Deleting in {Math.ceil(undoRemainingMs / 1000)}s
                    </Text>
                  </BlurView>
                )}

                <Image
                  style={styles.savedcardImage}
                  source={{ uri: item.image || 'https://via.placeholder.com/400x300' }}
                />
                <View style={styles.savedcardContent}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={styles.savedcardTitle}>{item.title}</Text>
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation?.();
                        handleRemoveIdea(item);
                      }}
                      style={styles.saveddeleteButton}
                    >
                      <Ionicons name="trash-outline" size={20} color="red" />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.savedcardDescription}>{item.description}</Text>
                  <Text style={styles.savedcardPrice}>Price: {item.price || 'Unknown'}</Text>
                </View>
              </View>
            </Touchable>
          )}
        />
      ) : (
        renderEmptyState()
      )}

      <View style={styles.bottomNavWrapper}>
        <BottomNav navigation={navigation} />
      </View>
    </View>
  );
}
