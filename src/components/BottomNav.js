// BottomNav.js - updated for theme support and labeled icons
import React, { useMemo } from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute } from '@react-navigation/native';
import { useTheme } from '../styles/theme';
import { createHomeScreenStyles } from '../styles/HomeScreenStyles';

const BottomNav = ({ navigation }) => {
  const route = useRoute();
  const current = route.name;
  const theme = useTheme();
  const styles = useMemo(() => createHomeScreenStyles(theme), [theme]);

  const navItems = [
    { screen: 'HomeScreen', icon: 'home', label: 'Home' },
    { screen: 'ProfileScreen', icon: 'person', label: 'Profile' },
    { screen: 'SavedScreen', icon: 'bookmark', label: 'Saved' },
    { screen: 'ItineraryOverviewScreen', icon: 'map', label: 'Plan' },
    { screen: 'HistoryScreen', icon: 'time', label: 'History' },
  ];

  return (
    <View style={styles.bottomNav}>
      {navItems.map(({ screen, icon, label }) => {
        const focused = current === screen;
        return (
          <TouchableOpacity
            key={screen}
            onPress={() => navigation.navigate(screen)}
            style={{ alignItems: 'center' }}
          >
            <Ionicons
              name={focused ? icon : `${icon}-outline`}
              size={26}
              color={theme.iconActive}
            />
            <Text style={{ fontSize: 10, color: theme.text}}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

export default BottomNav;
