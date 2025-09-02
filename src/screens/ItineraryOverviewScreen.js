// src/screens/ItineraryOverviewScreen.js
import React, { useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View, Text, TouchableOpacity, Linking, Animated,
  RefreshControl, Platform, FlatList, Alert, LayoutAnimation, UIManager
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ItineraryContext } from '../context/ItineraryContext';
import BottomNav from '../components/BottomNav';
import MiniMapPreview from '../components/MiniMapPreview';
import GuestPrompt from '../components/GuestPrompt';
import MoveStepButtons from '../components/MoveStepButtons';
import { useTheme } from '../styles/theme';
import { createItineraryOverviewStyles } from '../styles/ItineraryOverviewStyles';
import { db } from '../config/firebaseConfig';
import { LocationContext } from '../context/LocationContext';
import { doc, getDoc, getDocs, collection } from 'firebase/firestore';
import { TouchableOpacity as Touchable, TouchableNativeFeedback } from 'react-native';
import { BlurView } from 'expo-blur';
import PremiumUpsellSheet from '../components/PremiumUpsellSheet';
import { useUserStatus } from '../hooks/useUserStatus';
import { AuthContext } from '../context/AuthContext';

const FREE_LIMIT = 2;
const PREMIUM_LIMIT = 5;
const DELETE_DELAY_MS = 2000;

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function ItineraryOverviewScreen({ navigation }) {
  const theme = useTheme();
  const styles = useMemo(() => createItineraryOverviewStyles(theme), [theme]);

  const { itinerary, setItinerary, removeFromItinerary, updateItineraryOrder, markStepCompleted } =
    useContext(ItineraryContext);

  const { isPremium, isGuest } = useUserStatus();
  const { user } = useContext(AuthContext);
  const { coords } = useContext(LocationContext);

  const [refreshing, setRefreshing] = useState(false);
  const [showUpsell, setShowUpsell] = useState(false);

  const [removingId, setRemovingId] = useState(null);
  const [undoStep, setUndoStep] = useState(null);
  const [undoRemainingMs, setUndoRemainingMs] = useState(0);
  const undoIntervalRef = useRef(null);
  const undoDeadlineRef = useRef(null);

  const fadeRefs = useRef({}); // id -> Animated.Value
  const maxSteps = isPremium ? PREMIUM_LIMIT : FREE_LIMIT;

  const loadSavedSteps = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const ref = collection(db, `users/${user.uid}/savedSteps`);
      const snapshot = await getDocs(ref);
      const fetched = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setItinerary(fetched);
    } catch (err) {
      console.error('❌ Failed to load saved steps:', err);
    }
  }, [user?.uid, setItinerary]);

  useEffect(() => {
    if (!isGuest && user?.uid) {
      loadSavedSteps();
    }
  }, [isGuest, user?.uid, loadSavedSteps]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadSavedSteps().finally(() => setRefreshing(false));
  }, [loadSavedSteps]);

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
      if (remaining <= 0) clearUndoTimers();
    }, 100);
  };

  useEffect(() => () => clearUndoTimers(), []);

  const animateLayout = () => {
    LayoutAnimation.configureNext({
      duration: 220,
      create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
      update: { type: LayoutAnimation.Types.easeInEaseOut },
      delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
    });
  };

  const handleRemoveStep = (item) => {
    const timeoutId = setTimeout(() => {
      const fade = fadeRefs.current[item.id];
      if (fade) {
        Animated.timing(fade, { toValue: 0, duration: 160, useNativeDriver: true }).start(() => {
          animateLayout();
          removeFromItinerary(item.id);
          setRemovingId(null);
          setUndoStep(null);
        });
      } else {
        animateLayout();
        removeFromItinerary(item.id);
        setRemovingId(null);
        setUndoStep(null);
      }
      clearUndoTimers();
    }, DELETE_DELAY_MS);

    setRemovingId(item.id);
    setUndoStep({ ...item, timeoutId });
    startUndoCountdown();
  };

  const handleUndo = () => {
    if (undoStep) {
      clearTimeout(undoStep.timeoutId);
      setUndoStep(null);
      setRemovingId(null);
      clearUndoTimers();
      const fade = fadeRefs.current[undoStep.id];
      if (fade) {
        Animated.timing(fade, { toValue: 1, duration: 140, useNativeDriver: true }).start();
      }
    }
  };

  const moveStepUp = (index) => {
    if (index === 0) return;
    const newItinerary = [...itinerary];
    [newItinerary[index - 1], newItinerary[index]] = [newItinerary[index], newItinerary[index - 1]];
    animateLayout();
    updateItineraryOrder(newItinerary);
  };

  const moveStepDown = (index) => {
    if (index === itinerary.length - 1) return;
    const newItinerary = [...itinerary];
    [newItinerary[index + 1], newItinerary[index]] = [newItinerary[index], newItinerary[index + 1]];
    animateLayout();
    updateItineraryOrder(newItinerary);
  };

  const openInGoogleMaps = () => {
    if (!itinerary.length) return;
    const steps = itinerary.map(step =>
      step.lat && step.lng
        ? `${step.lat},${step.lng}`
        : encodeURIComponent(step.address || step.title)
    );
    const start = coords ? `${coords.latitude},${coords.longitude}` : '';
    const query = [start, ...steps].filter(Boolean).join('/');
    Linking.openURL(`https://www.google.com/maps/dir/${query}`);
  };

  const renderHeader = () => (
    <View style={styles.headerWrapper}>
      <Text style={styles.savedtitle}>Your Date Night Plan</Text>
      <Text style={styles.subtitle}>Reorder, remove, or explore your route!</Text>
      <Text style={styles.progressText}>{`${itinerary.length}/${maxSteps} steps added`}</Text>
    </View>
  );

  if (isGuest) {
    return (
      <View style={styles.profilecontainer}>
        <GuestPrompt navigation={navigation} />
        <BottomNav navigation={navigation} />
      </View>
    );
  }

  return (
    <View style={styles.profilecontainer}>
      {renderHeader()}

      <MiniMapPreview itinerary={itinerary} />

      {itinerary.length > 0 && (
        <TouchableOpacity
          style={[styles.mapButton, { marginTop: 4, marginBottom: 16 }]}
          onPress={openInGoogleMaps}
        >
          <Ionicons name="map-outline" size={20} color="white" />
          <Text style={styles.mapButtonText}>View in Google Maps</Text>
        </TouchableOpacity>
      )}

      <FlatList
        data={itinerary}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        ListEmptyComponent={(
          <View style={[styles.emptyStateContainer, { marginTop: -5 }]}>
            <Ionicons name="sparkles-outline" size={80} color={theme.primary} />
            <Text style={styles.emptyText}>No steps added</Text>
            <TouchableOpacity style={styles.ctaButton} onPress={() => navigation.navigate('HomeScreen')}>
              <Text style={styles.ctaButtonText}>Start Planning</Text>
            </TouchableOpacity>
          </View>
        )}
        ListHeaderComponent={<View style={{ height: itinerary.length < 2 ? 16 : 0 }} />}
        contentContainerStyle={{ paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item, index }) => {
          if (!fadeRefs.current[item.id]) fadeRefs.current[item.id] = new Animated.Value(1);
          const isPendingRemoval = removingId === item.id;

          return (
            <Touchable
              onPress={async () => {
                if (!user?.uid) return;
                try {
                  const ref = doc(db, `users/${user.uid}/savedSteps`, item.id.toString());
                  const snap = await getDoc(ref);
                  if (snap.exists()) {
                    const fullIdea = { id: snap.id, ...snap.data() };
                    navigation.navigate('DateIdeaDetails', { idea: fullIdea });
                  } else {
                    Alert.alert('Not Found', 'This idea could not be loaded.');
                  }
                } catch (err) {
                  console.error('❌ Failed to fetch idea:', err);
                  Alert.alert('Error', 'Failed to load idea details.');
                }
              }}
              background={Platform.OS === 'android' ? TouchableNativeFeedback.Ripple('#ccc', false) : undefined}
            >
              <Animated.View
                style={[
                  styles.stepCard,
                  {
                    opacity: fadeRefs.current[item.id],
                    transform: [
                      {
                        scale: isPendingRemoval
                          ? fadeRefs.current[item.id].interpolate({
                              inputRange: [0, 1],
                              outputRange: [0.98, 1],
                            })
                          : 1,
                      },
                    ],
                  },
                ]}
              >
                {isPendingRemoval && (
                  <BlurView
                    intensity={110}
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

                <MoveStepButtons
                  index={index}
                  length={itinerary.length}
                  moveStepUp={() => moveStepUp(index)}
                  moveStepDown={() => moveStepDown(index)}
                />
                <View style={{ flex: 1 }}>
                  <View style={styles.stepCardHeader}>
                    <Ionicons name="star-outline" size={22} color={theme.primary} style={{ marginRight: 6 }} />
                    <Text style={styles.stepNumber}>Step {index + 1}</Text>
                  </View>
                  <Text style={styles.stepTitle}>{item.title}</Text>
                </View>
                <TouchableOpacity onPress={() => handleRemoveStep(item)} style={styles.trashButton}>
                  <Ionicons name="trash-outline" size={24} color="red" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => markStepCompleted(item)} style={[styles.trashButton, { marginLeft: 4 }]}>
                  <Ionicons name="checkmark-done-outline" size={24} color="green" />
                </TouchableOpacity>
              </Animated.View>
            </Touchable>
          );
        }}
        scrollEnabled={itinerary.length >= 2}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          if (isPremium) {
            navigation.navigate('HomeScreen');
          } else if (itinerary.length < FREE_LIMIT) {
            navigation.navigate('HomeScreen');
          } else {
            setShowUpsell(true);
          }
        }}
        activeOpacity={0.9}
      >
        <Ionicons name="add-circle" size={48} color="white" />
      </TouchableOpacity>

      <PremiumUpsellSheet
        visible={showUpsell}
        onClose={() => setShowUpsell(false)}
        onUpgrade={() => {
          setShowUpsell(false);
          navigation.navigate('SubscriptionScreen');
        }}
      />

      <BottomNav navigation={navigation} />
    </View>
  );
}
