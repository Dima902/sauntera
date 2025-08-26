// 📄 components/GuestPrompt.js
import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../styles/theme';
import { createItineraryOverviewStyles } from '../styles/ItineraryOverviewStyles';

export default function GuestPrompt({ navigation }) {
  const theme = useTheme();
  const styles = useMemo(() => createItineraryOverviewStyles(theme), [theme]);

  return (
    <View style={styles.guestProfileContainer}>
      <Ionicons name="calendar-outline" size={80} color={theme.primary} />
      <Text style={styles.guestProfileText}>
        You’re exploring as a guest. {"\n"}
        <Text style={styles.guestProfileLink} onPress={() => navigation.navigate('LoginScreen')}>
          Sign up to save and organize your plans!
        </Text>
      </Text>
      <Text style={{ color: theme.text, fontSize: 14, textAlign: 'center', marginBottom: 10 }}>
        Create an account to build and revisit your perfect dates.
      </Text>
      <TouchableOpacity
        style={styles.signupButton}
        onPress={() => navigation.navigate('LoginScreen')}
      >
        <Text style={styles.signupButtonText}>Sign Up / Log In</Text>
      </TouchableOpacity>
    </View>
  );
}
