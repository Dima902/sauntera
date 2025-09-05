// src/screens/SettingsScreen.js – Patched to use AuthContext.logout()

import React, { useState, useEffect, useContext, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  Switch,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import {
  registerForPushNotificationsAsync,
  toggleNotificationPreference,
  getNotificationPreference,
} from '../utils/notifications';
import { ThemeContext } from '../context/ThemeContext';
import { useTheme } from '../styles/theme';
import { createSettingsScreenStyles } from '../styles/SettingsScreenStyles';
import * as Linking from 'expo-linking';

// ✅ import AuthContext to use unified logout
import { AuthContext } from '../context/AuthContext';

export default function SettingsScreen() {
  const navigation = useNavigation();
  const theme = useTheme();
  const styles = useMemo(() => createSettingsScreenStyles(theme), [theme]);
  const { theme: themeState, toggleTheme } = useContext(ThemeContext);

  const { logout } = useContext(AuthContext); // ✅ use unified logout

  const [tipsEnabled, setTipsEnabled] = useState(false);
  const [eventsEnabled, setEventsEnabled] = useState(false);
  const [billingEmail, setBillingEmail] = useState('');

  useEffect(() => {
    const loadPrefs = async () => {
      const tips = await getNotificationPreference('tipsEnabled');
      const events = await getNotificationPreference('eventsEnabled');
      setTipsEnabled(tips);
      setEventsEnabled(events);
    };
    loadPrefs();
  }, []);

  const handleToggleTips = async (value) => {
    setTipsEnabled(value);
    await toggleNotificationPreference('tipsEnabled', value);
    if (value) await registerForPushNotificationsAsync();
  };

  const handleToggleEvents = async (value) => {
    setEventsEnabled(value);
    await toggleNotificationPreference('eventsEnabled', value);
    if (value) await registerForPushNotificationsAsync();
  };

  const handleLogout = async () => {
    try {
      await logout(); // ✅ signs out both web and native sessions
      navigation.reset({ index: 0, routes: [{ name: 'LoginScreen' }] });
    } catch (e) {
      Alert.alert('Logout Error', e?.message || String(e));
    }
  };

  const version = Constants?.manifest?.version || '1.0.0';

  return (
    <View style={{ flex: 1 }}>
      {/* Sticky Header */}
      <View style={[styles.headerRow, styles.stickyHeader]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.profileTitle}>Settings</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Scrollable Content */}
      <ScrollView
        style={[styles.container, { marginTop: 60 }]}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Notifications */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <View style={styles.settingRow}>
            <View style={styles.settingLabelRow}>
              <Ionicons
                name="bulb-outline"
                size={20}
                color={theme.text}
                style={{ marginRight: 8 }}
              />
              <View>
                <Text style={styles.settingLabel}>Date Night Tips</Text>
                <Text style={styles.settingDescription}>
                  Occasional tips and inspiration
                </Text>
              </View>
            </View>
            <Switch value={tipsEnabled} onValueChange={handleToggleTips} />
          </View>
          <View style={styles.settingRow}>
            <View style={styles.settingLabelRow}>
              <Ionicons
                name="calendar-outline"
                size={20}
                color={theme.text}
                style={{ marginRight: 8 }}
              />
              <View>
                <Text style={styles.settingLabel}>Event Alerts</Text>
                <Text style={styles.settingDescription}>
                  Get notified about local events
                </Text>
              </View>
            </View>
            <Switch value={eventsEnabled} onValueChange={handleToggleEvents} />
          </View>
        </View>

        {/* Appearance */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Appearance</Text>
          <View style={styles.settingRow}>
            <View style={styles.settingLabelRow}>
              <Ionicons
                name="moon-outline"
                size={20}
                color={theme.text}
                style={{ marginRight: 8 }}
              />
              <Text style={styles.settingLabel}>Dark Mode</Text>
            </View>
            <Switch
              value={themeState.mode === 'dark'}
              onValueChange={toggleTheme}
            />
          </View>
        </View>

        {/* Account */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.settingRow}>
            <Ionicons
              name="mail-outline"
              size={20}
              color={theme.text}
              style={{ marginRight: 8 }}
            />
            <Text style={styles.settingLabel}>
              {billingEmail || 'Not signed in'}
            </Text>
          </View>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons
              name="log-out-outline"
              size={20}
              color={theme.text}
              style={{ marginRight: 8 }}
            />
            <Text style={styles.logoutButtonText}>Log Out</Text>
          </TouchableOpacity>
        </View>

        {/* Help & Legal */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Help & Legal</Text>

          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => Linking.openURL('https://sauntera.com/privacy.html')}
          >
            <Ionicons
              name="shield-checkmark-outline"
              size={20}
              color={theme.text}
              style={{ marginRight: 8 }}
            />
            <Text style={styles.settingLabel}>Privacy Policy</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => Linking.openURL('https://sauntera.com/terms.html')}
          >
            <Ionicons
              name="document-text-outline"
              size={20}
              color={theme.text}
              style={{ marginRight: 8 }}
            />
            <Text style={styles.settingLabel}>Terms of Use</Text>
          </TouchableOpacity>
        </View>

        {/* App Info */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>App Info</Text>
          <View style={styles.settingRow}>
            <Ionicons
              name="information-circle-outline"
              size={20}
              color={theme.text}
              style={{ marginRight: 8 }}
            />
            <Text style={styles.settingLabel}>Version {version}</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
