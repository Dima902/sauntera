// MiniMapPreview.js – stable, no invisible state, simple fade-in
import React, { useContext, useEffect, useState, useRef, useMemo } from 'react';
import { View, Text, Animated, Easing } from 'react-native';
import { LocationContext } from '../context/LocationContext';
import { useTheme } from '../styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { md5 } from 'js-md5';

const ROUND = (n) => (typeof n === 'number' ? Number(n.toFixed(5)) : n);
const normalizeStep = (s) => {
  if (s?.lat != null && s?.lng != null) return `${ROUND(s.lat)},${ROUND(s.lng)}`;
  if (s?.address) return `addr:${s.address}`;
  return `title:${s?.title ?? ''}`;
};

export default function MiniMapPreview({ itinerary }) {
  const { coords } = useContext(LocationContext);
  const theme = useTheme();

  const [mapUrl, setMapUrl] = useState(null);
  const [loading, setLoading] = useState(false);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const pulseLoopRef = useRef(null);
  const cacheRef = useRef({});
  const reqIdRef = useRef(0); // request guard

  const mapKey = useMemo(() => {
    const base = coords ? `${ROUND(coords.latitude)},${ROUND(coords.longitude)}` : 'no-start';
    const steps = (itinerary || []).map(normalizeStep).join('|');
    return md5(`${base}::${steps}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    coords ? ROUND(coords.latitude) : null,
    coords ? ROUND(coords.longitude) : null,
    JSON.stringify((itinerary || []).map(normalizeStep)),
  ]);

  useEffect(() => {
    return () => {
      if (pulseLoopRef.current) pulseLoopRef.current.stop();
    };
  }, []);

  useEffect(() => {
    if (!coords || !itinerary || itinerary.length === 0) {
      // No route to render
      stopPulse();
      setLoading(false);
      setMapUrl(null);
      fadeAnim.setValue(1);
      return;
    }

    // Serve cache instantly
    if (cacheRef.current[mapKey]) {
      stopPulse();
      setLoading(false);
      setMapUrl(cacheRef.current[mapKey]);
      fadeAnim.setValue(1);
      return;
    }

    // Fetch (debounced a bit to avoid churn)
    const localReq = ++reqIdRef.current;
    setLoading(true);
    startPulse();

    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          'https://us-central1-happoria.cloudfunctions.net/getStaticMapUrl',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userCoords: coords, itinerary }),
          }
        );
        const data = await res.json().catch(() => ({}));

        if (reqIdRef.current !== localReq) return; // stale response ignored

        if (data?.mapUrl) {
          cacheRef.current[mapKey] = data.mapUrl;
          setMapUrl(data.mapUrl);
          setLoading(false);
          stopPulse();
          // Prepare for fade-in but never leave it stuck at 0
          fadeAnim.setValue(0.001);
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 350,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }).start();
        } else {
          setMapUrl(null);
          setLoading(false);
          stopPulse();
          fadeAnim.setValue(1);
        }
      } catch (e) {
        if (reqIdRef.current !== localReq) return;
        setMapUrl(null);
        setLoading(false);
        stopPulse();
        fadeAnim.setValue(1);
      }
    }, 150);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapKey]);

  const startPulse = () => {
    if (pulseLoopRef.current) pulseLoopRef.current.stop();
    pulseLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 0.35, duration: 600, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    pulseLoopRef.current.start();
  };

  const stopPulse = () => {
    if (pulseLoopRef.current) {
      pulseLoopRef.current.stop();
      pulseLoopRef.current = null;
    }
  };

  return (
    <View style={{ alignItems: 'center', marginVertical: 12 }}>
      {loading || !mapUrl ? (
        <View
          style={{
            width: 320,
            height: 160,
            borderRadius: 12,
            backgroundColor: theme.card,
            justifyContent: 'center',
            alignItems: 'center',
            overflow: 'hidden',
            borderColor: theme.border,
            borderWidth: 1,
          }}
        >
          {/* Pulsing overlay */}
          <Animated.View
            style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              backgroundColor: theme.border,
              opacity: fadeAnim,
            }}
          />
          <Ionicons name="map-outline" size={28} color={theme.text} />
          <Text style={{ marginTop: 6, fontSize: 12, color: theme.text }}>
            Preparing your route…
          </Text>
        </View>
      ) : (
        <>
          <Animated.Image
            source={{ uri: mapUrl }}
            // If the fade somehow got stuck, snap to 1 after load
            onLoad={() => fadeAnim.setValue(1)}
            onError={() => setMapUrl(null)}
            style={{
              width: 320,
              height: 160,
              borderRadius: 12,
              opacity: fadeAnim,
              // ensure non-transparent bg so a 0 opacity doesn’t look like “missing view”
              backgroundColor: theme.card,
            }}
            resizeMode="cover"
          />
          <Text style={{ color: theme.text, fontSize: 12, marginTop: 6 }}>
            Your starting point and steps
          </Text>
        </>
      )}
    </View>
  );
}
