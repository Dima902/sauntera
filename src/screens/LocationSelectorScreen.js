// LocationSelectorScreen.js – final version with one-tap fix and animated clear button
import React, { useState, useEffect, useContext, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LocationContext } from '../context/LocationContext';
import styles from '../styles/LocationSelectorStyles';
import { clearExpiredCaches } from '../utils/cacheUtils';
import { fetchNearbyCitiesFromOffsets } from '../utils/locationUtils';

const BASE_URL = 'https://us-central1-happoria.cloudfunctions.net';

const fetchCitySuggestions = async (query) => {
  if (!query) return [];
  try {
    const response = await fetch(`${BASE_URL}/fetchCitySuggestions?q=${encodeURIComponent(query)}`);
    const data = await response.json();
    return (data.suggestions || []).map(item => ({
      name: item.name,
      fullName: item.fullName
    }));
  } catch (error) {
    console.error("❌ Error fetching city suggestions:", error);
    return [];
  }
};

const LocationSelectorScreen = () => {
  const navigation = useNavigation();
  const {
    location,
    setLocation,
    detectedLocation,
    recentLocations,
    setRecentLocations,
    coords,
    locationCoords
  } = useContext(LocationContext);

  const [searchText, setSearchText] = useState('');
  const [suggestedLocations, setSuggestedLocations] = useState([]);
  const clearOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    clearExpiredCaches('nearby_');
  }, []);

  useEffect(() => {
    const fetchNearby = async () => {
      if (searchText.length > 1) {
        const results = await fetchCitySuggestions(searchText);
        setSuggestedLocations(results);
      } else if (locationCoords) {
        const results = await fetchNearbyCitiesFromOffsets(locationCoords.lat, locationCoords.lon);
        setSuggestedLocations(results.map(c => ({ name: c, fullName: c })));
      } else if (coords) {
        const results = await fetchNearbyCitiesFromOffsets(coords.latitude, coords.longitude);
        setSuggestedLocations(results.map(c => ({ name: c, fullName: c })));
      }
    };
    fetchNearby();
  }, [searchText, locationCoords, coords]);

  useEffect(() => {
    Animated.timing(clearOpacity, {
      toValue: searchText.length > 0 ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [searchText]);

  const handleLocationSelect = (selected) => {
    Keyboard.dismiss();
    requestAnimationFrame(() => {
      const fullName = typeof selected === 'string' ? selected : selected.fullName;
      setLocation(fullName).then(() => {
        setRecentLocations((prev) =>
          [fullName, ...prev.filter(loc => loc !== fullName)].slice(0, 5)
        );
        navigation.goBack();
      });
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={{ flex: 1 }}>
            {/* Header */}
            <View style={[styles.headerRow, { backgroundColor: 'white', paddingHorizontal: 16, paddingBottom: 8 }]}>
              <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                <Ionicons name="arrow-back" size={28} color="black" />
              </TouchableOpacity>

              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                <TextInput
                  style={[
                    styles.searchBar
                  ]}
                  placeholder="Location"
                  value={searchText}
                  onChangeText={setSearchText}
                />
                <Animated.View style={{ opacity: clearOpacity }}>
                  <TouchableOpacity onPress={() => setSearchText('')} style={{ paddingHorizontal: 8 }}>
                    <Ionicons name="close-circle" size={22} color="#555" />
                  </TouchableOpacity>
                </Animated.View>
              </View>
            </View>

            {/* Content */}
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 120, paddingLeft: 20, backgroundColor: 'white' }}
            >
              <View style={styles.groupedSection}>
                {suggestedLocations.length > 0 && (
                  <>
                    <Text style={styles.sectionTitle}>
                      {searchText.length > 1 ? 'Search Results' : 'Nearby Areas'}
                    </Text>
                    {suggestedLocations.map((item, index) => {
                      const label = item.fullName || item.name || item;
                      return (
                        <TouchableOpacity
                          key={label + index}
                          style={styles.listItem}
                          onPress={() => handleLocationSelect(item)}
                        >
                          <Text style={styles.listItemText}>{label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </>
                )}

                <Text style={styles.sectionTitle}>Current Location</Text>
                <TouchableOpacity
                  style={styles.listItem}
                  onPress={() => handleLocationSelect(detectedLocation || location)}
                >
                  <Text style={styles.listItemText}>{detectedLocation || location || 'Not available'}</Text>
                </TouchableOpacity>

                {recentLocations && recentLocations.length > 0 && (
                  <>
                    <Text style={styles.sectionTitle}>Recent Locations</Text>
                    {recentLocations.map((item, index) => (
                      <TouchableOpacity
                        key={item + index}
                        style={styles.listItem}
                        onPress={() => handleLocationSelect(item)}
                      >
                        <Text style={styles.listItemText}>{item}</Text>
                      </TouchableOpacity>
                    ))}
                  </>
                )}
              </View>
            </ScrollView>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default LocationSelectorScreen;
