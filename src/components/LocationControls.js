// LocationControls.js – Simplified for infinite swipe strategy
import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../styles/theme';
import { createHomeScreenStyles } from '../styles/HomeScreenStyles';

const LocationControls = ({ navigation, location, loading }) => {
  const theme = useTheme();
  const styles = useMemo(() => createHomeScreenStyles(theme), [theme]);

  return (
    <View style={[styles.topRow, { alignItems: 'center', flexDirection: 'row' }]}>
      <View style={{ flex: 1.2, alignItems: 'flex-start', minWidth: 70, maxWidth: 120 }}>
        <TouchableOpacity
          style={styles.locationButton}
          onPress={() => navigation.navigate('LocationSelectorScreen')}
          accessibilityLabel="Change location"
        >
          <Ionicons
            name="location-outline"
            size={16}
            color={theme.iconActive}
            style={styles.locationIcon}
          />
          <Text
            style={styles.locationButtonText}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {location
              ? (location.split(',')[0].trim().length > 10
                  ? location.split(',')[0].trim().slice(0, 10) + '...'
                  : location.split(',')[0].trim())
              : 'Select Location'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default LocationControls;
