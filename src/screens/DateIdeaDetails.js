// DateIdeaDetailsScreen.js
import React, { useState, useEffect, useContext, useMemo, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Linking,
  Share,
  ScrollView,
  Platform,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAuthInstance, db } from '../config/firebaseConfig';
import { doc, setDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { ItineraryContext } from '../context/ItineraryContext';
import { useTheme } from '../styles/theme';
import { createDateIdeaDetailsStyles } from '../styles/DateIdeaDetailsStyles';
import Toast from 'react-native-toast-message';
import { useUserStatus } from '../hooks/useUserStatus';
import PremiumUpsellSheet from '../components/PremiumUpsellSheet';

const MAX_FREE_STEPS = 2;

const DateIdeaDetailsScreen = ({ route, navigation }) => {
  const { itinerary, addToItinerary } = useContext(ItineraryContext);
  const { isPremium } = useUserStatus();
  const theme = useTheme();
  const styles = useMemo(() => createDateIdeaDetailsStyles(theme), [theme]);

  const [authRef, setAuthRef] = useState(null);
  const [isSaved, setIsSaved] = useState(false);
  const [isAddedToItinerary, setIsAddedToItinerary] = useState(false);
  const [showUpsell, setShowUpsell] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const idea = route?.params?.idea;

  useEffect(() => {
    (async () => {
      const auth = await getAuthInstance();
      setAuthRef(auth);
    })();
  }, []);

  // Sync "added" badge immediately when itinerary changes
  useEffect(() => {
    if (!idea) return;
    const currentId = idea.id || idea.title;
    const inItinerary = itinerary?.some((s) => (s.id || s.title) === currentId);
    setIsAddedToItinerary(Boolean(inItinerary));
  }, [itinerary, idea]);

  useEffect(() => {
    if (authRef?.currentUser && idea) {
      checkIfSaved();
      checkIfInItineraryFirestore();
    }
  }, [authRef, idea]);

  useEffect(() => {
    if (isAddedToItinerary) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      fadeAnim.setValue(0);
    }
  }, [isAddedToItinerary, fadeAnim]);

  if (!idea) {
    return (
      <View style={styles.fallbackContainer}>
        <Text style={styles.fallbackText}>
          No idea details provided. Please go back and select a date idea.
        </Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.fallbackButton}>
          <Text style={styles.fallbackButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const checkIfSaved = async () => {
    const user = authRef?.currentUser;
    if (!user) return;
    const ideaRef = doc(db, `users/${user.uid}/savedIdeas`, idea.title);
    const docSnap = await getDoc(ideaRef);
    setIsSaved(docSnap.exists());
  };

  // Optional Firestore check (keeps parity with cloud state)
  const checkIfInItineraryFirestore = async () => {
    const user = authRef?.currentUser;
    if (!user) return;
    const itineraryRef = doc(db, `users/${user.uid}/savedSteps`, idea.id || idea.title);
    const snap = await getDoc(itineraryRef);
    if (snap.exists()) setIsAddedToItinerary(true);
  };

  const toggleSaveIdea = async () => {
    const user = authRef?.currentUser;
    if (!user) {
      Toast.show({
        type: 'error',
        text1: 'Login required',
        text2: 'You need to log in to save ideas.',
      });
      return;
    }

    const ideaRef = doc(db, `users/${user.uid}/savedIdeas`, idea.title);
    if (isSaved) {
      await deleteDoc(ideaRef);
      setIsSaved(false);
      Toast.show({ type: 'success', text1: 'Removed from saved ideas' });
    } else {
      await setDoc(ideaRef, idea);
      setIsSaved(true);
      Toast.show({ type: 'success', text1: 'Idea saved successfully' });
    }
  };

  const handleAddToItinerary = () => {
    // If already added, just open the plan
    if (isAddedToItinerary) {
      navigation.navigate('ItineraryOverviewScreen');
      return;
    }

    // Enforce free-user limit — show only upsell sheet
    if (!isPremium && (itinerary?.length || 0) >= MAX_FREE_STEPS) {
      setShowUpsell(true);
      return;
    }

    // Add (dedup safeguard)
    const payload = {
      ...idea,
      id: idea.id || idea.title,
      time: '',
      type: idea.type || 'Custom',
    };
    addToItinerary(payload);
    setIsAddedToItinerary(true);
  };

  const handleOpenWebsite = () => {
    if (idea.website) {
      Linking.openURL(idea.website);
    } else {
      Toast.show({ type: 'error', text1: 'No website available for this idea.' });
    }
  };

  const handleOpenInMaps = () => {
    if (!idea.address) {
      Toast.show({ type: 'error', text1: 'No address available for this idea.' });
      return;
    }

    const query = encodeURIComponent(idea.address);
    const url =
      Platform.OS === 'ios'
        ? `http://maps.apple.com/?q=${query}`
        : `geo:0,0?q=${query}`;

    Linking.openURL(url).catch(() => {
      const fallbackUrl = `https://www.google.com/maps/search/?api=1&query=${query}`;
      Linking.openURL(fallbackUrl);
    });
  };

  const handleShare = async () => {
    await Share.share({
      message: `Check out this date idea: ${idea.title}\n\n${idea.description}\n\nWebsite: ${idea.website || 'N/A'}`,
    });
  };

  return (
    <>
      <ScrollView style={styles.container}>
        <TouchableOpacity
          style={{
            position: 'absolute',
            top: 10,
            left: 16,
            zIndex: 10,
            backgroundColor: theme.card,
            padding: 10,
            borderRadius: 20,
            elevation: 3,
          }}
          onPress={() => navigation.navigate('HomeScreen')}
        >
          <Ionicons name="home-outline" size={24} color={theme.text} />
        </TouchableOpacity>

        <Image source={{ uri: idea.image }} style={styles.image} />

        {isAddedToItinerary && (
          <Animated.View style={[styles.itineraryBadge, { opacity: fadeAnim }]}>
            <TouchableOpacity
              onPress={() => navigation.navigate('ItineraryOverviewScreen')}
              activeOpacity={0.8}
            >
              <Text style={styles.itineraryBadgeText}>✓ Added to your date plan</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        <View style={styles.detailscontent}>
          <Text style={styles.detailstitle}>{idea.title}</Text>
          <Text style={styles.detailsdescription}>{idea.description}</Text>
          <Text style={styles.detailsprice}>💰 Price: {idea.price || 'Unknown'}</Text>

          {(idea.website || idea.address) && (
            <View style={[styles.detailsButtonRow, { marginTop: 10 }]}>
              {idea.website && idea.address ? (
                <>
                  <TouchableOpacity onPress={handleOpenWebsite} style={styles.detailswebsiteButton}>
                    <Ionicons name="globe-outline" size={20} color="white" />
                    <Text style={styles.detailswebsiteButtonText}>Website</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleOpenInMaps} style={styles.detailsmapButton}>
                    <Ionicons name="location-outline" size={20} color="white" />
                    <Text style={styles.detailswebsiteButtonText}>Map</Text>
                  </TouchableOpacity>
                </>
              ) : idea.website ? (
                <TouchableOpacity onPress={handleOpenWebsite} style={styles.detailswebsiteFullWidthButton}>
                  <Ionicons name="globe-outline" size={20} color="white" />
                  <Text style={styles.detailswebsiteButtonText}>Website</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={handleOpenInMaps} style={styles.detailsmapFullWidthButton}>
                  <Ionicons name="location-outline" size={20} color="white" />
                  <Text style={styles.detailswebsiteButtonText}>Map</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <View style={styles.detailsButtonRow}>
            <TouchableOpacity onPress={handleShare} style={styles.detailsshareButton}>
              <Ionicons name="share-social-outline" size={20} color={theme.text} />
              <Text style={styles.detailsactionText}>Share</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={toggleSaveIdea} style={styles.detailssaveButtonInline}>
              <Ionicons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={20} color={theme.text} />
              <Text style={styles.detailsactionText}>{isSaved ? 'Saved' : 'Save'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.detailsButtonRow}>
            {idea.reserve_url ? (
              <TouchableOpacity onPress={() => Linking.openURL(idea.reserve_url)} style={styles.detailsbookButton}>
                <Ionicons name="calendar-outline" size={20} color="white" />
                <Text style={styles.detailsbookText}>Book</Text>
              </TouchableOpacity>
            ) : null}

            {isAddedToItinerary ? (
              <TouchableOpacity
                onPress={() => navigation.navigate('ItineraryOverviewScreen')}
                style={styles.detailsitineraryButton}
              >
                <Ionicons name="map-outline" size={20} color="white" />
                <Text style={styles.detailsitineraryButtonText}>Your Date Plan</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={handleAddToItinerary}
                style={idea.reserve_url ? styles.detailsitineraryButton : styles.detailsitineraryFullWidthButton}
              >
                <Ionicons name="add-circle-outline" size={20} color="white" />
                <Text style={styles.detailsitineraryButtonText}>Add to Date Night</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>

      <PremiumUpsellSheet visible={showUpsell} onClose={() => setShowUpsell(false)} />
    </>
  );
};

export default DateIdeaDetailsScreen;
