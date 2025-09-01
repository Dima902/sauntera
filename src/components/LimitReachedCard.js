// LimitReachedCard.js
import React, { useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../styles/theme';
import { limitReachedCardStyles } from '../styles/HomeScreenStyles';

const LimitReachedCard = ({ isGuest, onLogin, onUpgrade }) => {
  const theme = useTheme();
  const styles = useMemo(() => limitReachedCardStyles(theme), [theme?.mode]);
  const navigation = useNavigation();

  const handlePrimaryPress = useCallback(() => {
    if (isGuest) {
      if (typeof onLogin === 'function') {
        onLogin();
      } else {
        // Fallback: go to your auth screen/stack
        navigation.navigate('LoginScreen'); // or 'AuthStack' / 'Welcome' etc.
      }
    } else {
      if (typeof onUpgrade === 'function') {
        onUpgrade();
      } else {
        // Fallback: go straight to the subscription screen
        navigation.navigate('SubscriptionScreen');
      }
    }
  }, [isGuest, onLogin, onUpgrade, navigation]);

  return (
    <Pressable
      style={styles.card}
      onPress={handlePrimaryPress}
      android_ripple={{ borderless: false }}
      accessibilityRole="button"
      accessibilityLabel={isGuest ? 'Login or Register' : 'Upgrade Now'}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>
          🎉 You've reached today's free swipe limit!
        </Text>

        <Text style={styles.subtitle}>
          {isGuest
            ? 'Create an account to continue exploring.'
            : 'Upgrade to Premium for unlimited swipes and hidden gems.'}
        </Text>

        <View style={styles.actions}>
          <TouchableOpacity
            onPress={handlePrimaryPress}
            style={styles.button}
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>
              {isGuest ? 'Login or Register' : 'Upgrade Now'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Pressable>
  );
};

export default React.memo(LimitReachedCard);
