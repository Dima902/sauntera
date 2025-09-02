// src/screens/SavedScreen.js
// SavedScreen – graceful empty/error states + pull-to-refresh
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, Image, TouchableOpacity,
  TouchableNativeFeedback, Platform, RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAuthInstance, db } from '../config/firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import BottomNav from '../components/BottomNav';
import { BlurView } from 'expo-blur';
import { useTheme } from '../styles/theme';
import { createSavedScreenStyles } from '../styles/SavedScreenStyles';

const DELETE_DELAY_MS = 4000;

export default function SavedScreen({ navigation }) {
  const theme = useTheme();
  const styles = useMemo(() => createSavedScreenStyles(theme), [theme]);

  const [savedIdeas, setSavedIdeas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [undoItem, setUndoItem] = useState(null);
  const [undoRemainingMs, setUndoRemainingMs] = useState(0);
  const [isGuest, setIsGuest] = useState(true);
  const [loadError, setLoadError] = useState(null); // string | null

  const undoIntervalRef = useRef(null);
  const undoDeadlineRef = useRef(null);
  const mountedRef = useRef(true);

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
      if (!mountedRef.current) return;
      setUndoRemainingMs(remaining);
      if (remaining <= 0) clearUndoTimers();
    }, 100);
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearUndoTimers();
    };
  }, []);

  const fetchSavedIdeas = useCallback(async (user, { isRefresh = false } = {}) => {
    if (!user) {
      if (mountedRef.current) {
        setSavedIdeas([]);
        setLoading(false);
        setRefreshing(false);
        setLoadError(null);
      }
      return;
    }

    if (!isRefresh) setLoading(true);
    else setRefreshing(true);

    try {
      setLoadError(null);

      const userSavedIdeasRef = collection(db, `users/${user.uid}/savedIdeas`);
      const querySnapshot = await getDocs(userSavedIdeasRef);

      const rawIdeas = querySnapshot.docs.map(d => ({ id: d.id, ...d.data?.() }));

      // Dedup by website
      const seenWebsites = new Set();
      const uniqueIdeas = rawIdeas.filter(idea => {
        const site = idea?.website?.trim();
        if (!site) return true;
        if (seenWebsites.has(site)) return false;
        seenWebsites.add(site);
        return true;
      });

      // Sort newest first
      uniqueIdeas.sort((a, b) => {
        const aTs = a?.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const bTs = b?.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return bTs - aTs;
      });

      if (!mountedRef.current) return;
      setSavedIdeas(uniqueIdeas);
    } catch (err) {
      // Graceful handling: no alert, just a retry UI
      if (!mountedRef.current) return;
      setSavedIdeas([]); // ensures FlatList/empty state renders cleanly
      setLoadError('Couldn’t load your saved ideas. Please try again.');
      console.error('❌ Error fetching saved ideas:', err);
    } finally {
      if (!mountedRef.current) return;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Listen for auth changes
  useEffect(() => {
    let unsubscribe;
    (async () => {
      const auth = await getAuthInstance();
      unsubscribe = onAuthStateChanged(auth, (user) => {
        setIsGuest(!user);
        if (user) fetchSavedIdeas(user);
        else {
          setSavedIdeas([]);
          setLoading(false);
          setLoadError(null);
        }
      });
    })();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [fetchSavedIdeas]);

  // Reload on screen focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', async () => {
      const auth = await getAuthInstance();
      if (auth.currentUser) fetchSavedIdeas(auth.currentUser, { isRefresh: true });
    });
    return unsubscribe;
  }, [navigation, fetchSavedIdeas]);

  const onRefresh = useCallback(async () => {
    const auth = await getAuthInstance();
    if (auth.currentUser) fetchSavedIdeas(auth.currentUser, { isRefresh: true });
  }, [fetchSavedIdeas]);

  const handleRemoveIdea = (idea) => {
    const timeoutId = setTimeout(async () => {
      const auth = await getAuthInstance();
      const user = auth.currentUser;
      if (!user) return;

      try {
        await deleteDoc(doc(db, `users/${user.uid}/savedIdeas`, idea.id));
        if (!mountedRef.current) return;
        setSavedIdeas(prev => prev.filter(i => i.id !== idea.id));
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

  const EmptyState = ({ message, showRetry }) => (
    <View style={styles.emptyStateContainer}>
      <Ionicons name="sparkles-outline" size={80} color={theme.primary} />
      <Text style={styles.emptyText}>{message || 'No saved ideas yet'}</Text>

      {showRetry ? (
        <TouchableOpacity
          style={[styles.ctaButton, { marginTop: 10 }]}
          onPress={onRefresh}
        >
          <Text style={styles.ctaButtonText}>Retry</Text>
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity
        style={[styles.ctaButton, { marginTop: 10 }]}
        onPress={() => navigation.navigate('HomeScreen')}
      >
        <Text style={styles.ctaButtonText}>Explore Ideas</Text>
      </TouchableOpacity>
    </View>
  );

  if (isGuest) {
    return (
      <View style={styles.profilecontainer}>
        <View style={styles.guestProfileContainer}>
          <Ionicons name="person-circle-outline" size={80} color={theme.primary} />
          <Text style={styles.guestProfileText}>
            You’re exploring as a guest.{'\n'}
            <Text style={styles.guestProfileLink} onPress={() => navigation.navigate('LoginScreen')}>
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

  const renderItem = ({ item }) => (
    <Touchable
      onPress={() => navigation.navigate('DateIdeaDetails', { idea: item })}
      background={Platform.OS === 'android' ? TouchableNativeFeedback.Ripple('#ccc', false) : undefined}
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
              <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 13 }}>Undo</Text>
            </TouchableOpacity>
            <Text style={{ color: theme.primary, fontWeight: '600', fontSize: 12 }}>
              Deleting in {Math.ceil(undoRemainingMs / 1000)}s
            </Text>
          </BlurView>
        )}

        <Image
          style={styles.savedcardImage}
          source={{
            uri:
              item?.image?.trim?.() ||
              'https://via.placeholder.com/800x600?text=Saved+Idea',
          }}
        />
        <View style={styles.savedcardContent}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.savedcardTitle}>{item?.title || 'Untitled idea'}</Text>
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
          {item?.description ? (
            <Text style={styles.savedcardDescription}>{item.description}</Text>
          ) : null}
          <Text style={styles.savedcardPrice}>Price: {item?.price || 'Unknown'}</Text>
        </View>
      </View>
    </Touchable>
  );

  return (
    <View style={styles.profilecontainer}>
      <Text style={styles.savedtitle}>Saved Date Ideas</Text>

      {/* When loading, keep layout stable (no alerts). */}
      {loading ? (
        <FlatList
          data={[]}
          keyExtractor={() => 'skeleton'}
          ListEmptyComponent={<EmptyState message="Loading your saved list…" />}
          contentContainerStyle={styles.savedlistContainer}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={onRefresh} />
          }
        />
      ) : savedIdeas.length > 0 ? (
        <FlatList
          data={savedIdeas}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.savedlistContainer}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      ) : (
        <FlatList
          data={[]}
          keyExtractor={() => 'empty'}
          ListEmptyComponent={
            <EmptyState
              message={loadError || 'No saved ideas yet'}
              showRetry={!!loadError}
            />
          }
          contentContainerStyle={styles.savedlistContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}

      <View style={styles.bottomNavWrapper}>
        <BottomNav navigation={navigation} />
      </View>
    </View>
  );
}
