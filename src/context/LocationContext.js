// LocationContext.js – normalized location handling (fixes norm.parts.city -> norm.city)

import React, {
  createContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import * as Location from 'expo-location';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import debounce from 'lodash.debounce';
import { normalizeLocationString } from '../utils/locationNormalize';

export const LocationContext = createContext();

const BASE_URL = 'https://us-central1-happoria.cloudfunctions.net';

const useFallbackLocation = async (setters, preferCanada = false) => {
  const fallback = preferCanada
    ? { name: 'Toronto, Ontario, Canada', short: 'Toronto', lat: 43.6532, lon: -79.3832, code: 'CA' }
    : { name: 'San Diego, CA, USA', short: 'San Diego', lat: 32.715736, lon: -117.161087, code: 'US' };

  const { setLocation, setShortLocation, setDetectedLocation, setCountryCode, setLocationCoords } = setters;
  setLocation(fallback.name);
  setShortLocation(fallback.short);
  setDetectedLocation(fallback.name);
  setCountryCode(fallback.code);
  setLocationCoords({ lat: fallback.lat, lon: fallback.lon });
};

export const LocationProvider = ({ children }) => {
  const [location, setLocationState] = useState(null);
  const [locationCoords, setLocationCoords] = useState(null);
  const [shortLocation, setShortLocation] = useState(null);
  const [detectedLocation, setDetectedLocation] = useState(null);
  const [coords, setCoords] = useState(null);
  const [countryCode, setCountryCode] = useState(null);
  const [expandRadius, setExpandRadius] = useState(false);
  const [recentLocations, setRecentLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [locationUpdatedAt, setLocationUpdatedAt] = useState(Date.now());
  const [locationPermissionDenied, setLocationPermissionDenied] = useState(false);
  const refetchLocation = useRef(() => {});

  const debouncedSetUpdatedAt = useCallback(
    debounce(() => setLocationUpdatedAt(Date.now()), 300),
    []
  );

  useEffect(() => {
    AsyncStorage.getItem('expandRadius').then(value => {
      if (value !== null) setExpandRadius(value === 'true');
    });
  }, []);

  useEffect(() => {
    AsyncStorage.setItem('expandRadius', expandRadius.toString());
  }, [expandRadius]);

  useEffect(() => {
    const detectLocation = async () => {
      setLoading(true);

      try {
        const cached = await AsyncStorage.getItem('lastLocation');
        if (cached) {
          const { formattedLocation, shortLocation, coords } = JSON.parse(cached);
          setLocationState(formattedLocation);
          setShortLocation(shortLocation);
          setDetectedLocation(formattedLocation);
          setLocationCoords(coords);
        }
      } catch (err) {
        console.warn('⚠️ Failed to load cached location:', err);
      }

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationPermissionDenied(true);
          return await useFallbackLocation({
            setLocation: setLocationState,
            setShortLocation,
            setDetectedLocation,
            setCountryCode,
            setLocationCoords
          }, true);
        }

        const { coords: deviceCoords } = await Location.getCurrentPositionAsync({});
        setCoords(deviceCoords);

        const { data } = await axios.post(`${BASE_URL}/reverseGeocodeFn`, {
          latitude: deviceCoords.latitude,
          longitude: deviceCoords.longitude,
        });

        const { formattedLocation, shortLocation: shortFromAPI, countryCode } = data || {};
        if (formattedLocation && (shortFromAPI || typeof shortFromAPI === 'string')) {
          const norm = normalizeLocationString(formattedLocation);
          setLocationState(norm.string);
          setShortLocation(norm.city); // <- FIX
          setDetectedLocation(norm.string);
          setCountryCode(countryCode || null);
          setLocationCoords({ lat: deviceCoords.latitude, lon: deviceCoords.longitude });

          await AsyncStorage.setItem(
            'lastLocation',
            JSON.stringify({
              formattedLocation: norm.string,
              shortLocation: norm.city, // <- FIX
              coords: { lat: deviceCoords.latitude, lon: deviceCoords.longitude }
            })
          );
        } else {
          await useFallbackLocation({
            setLocation: setLocationState,
            setShortLocation,
            setDetectedLocation,
            setCountryCode,
            setLocationCoords
          }, true);
        }
      } catch (error) {
        console.error('❌ Location detection failed:', error);
        await useFallbackLocation({
          setLocation: setLocationState,
          setShortLocation,
          setDetectedLocation,
          setCountryCode,
          setLocationCoords
        }, true);
      } finally {
        setLoading(false);
      }
    };

    detectLocation();
    refetchLocation.current = detectLocation;
  }, []);

  const setLocationAndCoords = useCallback(async (cityString) => {
    setLoading(true);
    try {
      const response = await axios.post(`${BASE_URL}/geocodeFn`, { location: cityString });
      const geo = response.data;
      const norm = normalizeLocationString(cityString);
      if (geo && geo.lat && geo.lon) {
        setLocationState(norm.string);
        setShortLocation(norm.city); // <- FIX
        setLocationCoords({ lat: geo.lat, lon: geo.lon });

        await AsyncStorage.setItem(
          'lastLocation',
          JSON.stringify({
            formattedLocation: norm.string,
            shortLocation: norm.city, // <- FIX
            coords: { lat: geo.lat, lon: geo.lon }
          })
        );
      } else {
        setLocationState(norm.string);
        setShortLocation(norm.city); // <- FIX
        setLocationCoords(null);
        console.warn('❌ Geocoding failed for', cityString);
      }
    } catch (e) {
      const norm = normalizeLocationString(cityString);
      setLocationState(norm.string);
      setShortLocation(norm.city); // <- FIX
      setLocationCoords(null);
      console.error('❌ Error in setLocationAndCoords:', e);
    } finally {
      debouncedSetUpdatedAt();
      setLoading(false);
    }
  }, [debouncedSetUpdatedAt]);

  useEffect(() => {
    if (!location) return;
    if (location === detectedLocation && coords) {
      setLocationCoords({ lat: coords.latitude, lon: coords.longitude });
    }
  }, [location, detectedLocation, coords]);

  return (
    <LocationContext.Provider value={{
      location,
      setLocation: setLocationAndCoords,
      shortLocation,
      setShortLocation,
      detectedLocation,
      coords,
      locationCoords,
      countryCode,
      recentLocations,
      setRecentLocations,
      loading,
      expandRadius,
      setExpandRadius,
      locationUpdatedAt,
      locationPermissionDenied,
      refetchLocation,
    }}>
      {children}
    </LocationContext.Provider>
  );
};
