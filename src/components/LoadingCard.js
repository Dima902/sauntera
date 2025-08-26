// LoadingCard.js — stable shimmer, no touch interception, no leaks
import React, { useEffect, useRef, useMemo } from 'react';
import {
  View,
  Animated,
  Text,
  ActivityIndicator,
  Dimensions,
  StyleSheet,
  Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { loadingCardStyles } from '../styles/HomeScreenStyles';
import { useTheme } from '../styles/theme';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = Math.round(SCREEN_WIDTH * 0.90);

const LoadingCard = () => {
  const theme = useTheme();
  // Only re-create when theme mode changes (avoids tiny flickers on theme-constant screens)
  const styles = useMemo(() => loadingCardStyles(theme), [theme?.mode]);

  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const loopRef = useRef(null);

  useEffect(() => {
    const timing = Animated.timing(shimmerAnim, {
      toValue: 1,
      duration: 1500,
      easing: Easing.linear,
      useNativeDriver: true,
      isInteraction: false,
    });

    loopRef.current = Animated.loop(timing);
    loopRef.current.start();

    return () => {
      // Stop the loop cleanly on unmount
      try {
        loopRef.current?.stop?.();
      } catch {}
      shimmerAnim.stopAnimation();
    };
  }, [shimmerAnim]);

  const translateX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-CARD_WIDTH, CARD_WIDTH],
  });

  const ShimmerLayer = ({ style }) => (
    <View
      style={[style, { overflow: 'hidden' }]}
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.line }]} />
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { transform: [{ translateX }] },
        ]}
      >
        <LinearGradient
          colors={['transparent', 'rgba(255,255,255,0.5)', 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );

  return (
    <View
      style={styles.card}
      accessibilityRole="progressbar"
      accessibilityLabel="Loading date ideas"
      testID="loading-card"
    >
      <ShimmerLayer style={styles.block} />
      <ShimmerLayer style={styles.line} />
      <ShimmerLayer style={styles.lineShort} />

      <View style={styles.overlay} pointerEvents="none">
        <ActivityIndicator size="small" color="#555" />
        <Text style={styles.loadingText}>Loading date ideas…</Text>
      </View>
    </View>
  );
};

export default React.memo(LoadingCard);
