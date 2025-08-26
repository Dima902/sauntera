// PremiumUpsellSheet.js — zero flicker via custom backdrop
import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, Dimensions, StyleSheet } from 'react-native';
import Modal from 'react-native-modal';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../styles/theme';
import { createSubscriptionModalStyles } from '../styles/SubscriptionModalStyles';

const { width: deviceWidth, height: deviceHeight } = Dimensions.get('window');

export default function PremiumUpsellSheet({ visible, onClose }) {
  const theme = useTheme();
  const styles = useMemo(() => createSubscriptionModalStyles(theme), [theme]);
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  // Single, owned backdrop opacity (prevents “brightness pop”)
  const backdrop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(backdrop, {
      toValue: visible ? 0.6 : 0,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [visible, backdrop]);

  const handleUpgradePress = () => {
    onClose?.();
    setTimeout(() => navigation.navigate('SubscriptionScreen'), 260);
  };

  return (
    <Modal
      isVisible={visible}
      onBackdropPress={onClose}
      onBackButtonPress={onClose}
      // Keep slide anims, but disable RNM backdrop to avoid double-dim
      hasBackdrop={false}
      backdropOpacity={0}
      customBackdrop={(
        <Animated.View
          pointerEvents={visible ? 'auto' : 'none'}
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: '#000', opacity: backdrop, zIndex: 1 },
          ]}
        />
      )}
      animationIn="slideInUp"
      animationOut="slideOutDown"
      animationInTiming={280}
      animationOutTiming={280}
      // Robust overlay settings
      coverScreen
      presentationStyle="overFullScreen"
      statusBarTranslucent
      hardwareAccelerated
      avoidKeyboard={false}
      deviceWidth={deviceWidth}
      deviceHeight={deviceHeight}
      hideModalContentWhileAnimating={false}
      useNativeDriver
      useNativeDriverForBackdrop
      propagateSwipe
      style={{ margin: 0, justifyContent: 'flex-end' }}
    >
      <View
        style={[
          styles.modalContainer,
          {
            backgroundColor: theme.background,
            paddingBottom: (styles.modalContainer?.paddingBottom ?? 24) + insets.bottom,
            zIndex: 2, // above custom backdrop
          },
        ]}
      >
        <TouchableOpacity
          style={styles.closeButton}
          onPress={onClose}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={24} color={theme.textSecondary} />
        </TouchableOpacity>

        <Text style={styles.title}>Unlock Premium</Text>
        <Text style={styles.subtitle}>Get the most out of Sauntera with premium features</Text>

        <View style={styles.benefitsList}>
          <View style={styles.benefitItem}>
            <Ionicons name="diamond-outline" size={20} color={theme.primary} style={styles.benefitIcon} />
            <Text style={styles.benefitText}>Access hidden gem ideas</Text>
          </View>
          <View style={styles.benefitItem}>
            <Ionicons name="filter-outline" size={20} color={theme.primary} style={styles.benefitIcon} />
            <Text style={styles.benefitText}>Use advanced filters</Text>
          </View>
          <View style={styles.benefitItem}>
            <Ionicons name="calendar-outline" size={20} color={theme.primary} style={styles.benefitIcon} />
            <Text style={styles.benefitText}>Plan unlimited dates</Text>
          </View>
          <View style={styles.benefitItem}>
            <Ionicons name="location-outline" size={20} color={theme.primary} style={styles.benefitIcon} />
            <Text style={styles.benefitText}>Choose any location</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.upgradeButton} onPress={handleUpgradePress}>
          <Text style={styles.upgradeButtonText}>Upgrade Now</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}
