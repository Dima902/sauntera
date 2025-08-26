// SettingsScreen.js - Fully updated for dynamic Firebase auth
import React, { useState, useEffect, useContext, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, Alert, Switch, ScrollView
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { deleteUser, signOut } from 'firebase/auth';
import { getAuthInstance } from '../config/firebaseConfig';
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

export default function SettingsScreen() {
  const navigation = useNavigation();
  const theme = useTheme();
  const styles = useMemo(() => createSettingsScreenStyles(theme), [theme]);
  const { theme: themeState, toggleTheme } = useContext(ThemeContext);

  const [authRef, setAuthRef] = useState(null);
  const [tipsEnabled, setTipsEnabled] = useState(false);
  const [eventsEnabled, setEventsEnabled] = useState(false);
  const [billingEmail, setBillingEmail] = useState('');

  useEffect(() => {
    (async () => {
      const auth = await getAuthInstance();
      setAuthRef(auth);
      if (auth?.currentUser?.email) {
        setBillingEmail(auth.currentUser.email);
      }
    })();

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
    if (!authRef) return;
    try {
      await signOut(authRef);
      navigation.reset({ index: 0, routes: [{ name: 'LoginScreen' }] });
    } catch (e) {
      Alert.alert('Logout Error', e.message);
    }
  };

  const handleDeleteAccount = async () => {
    if (!authRef?.currentUser) return;
    Alert.alert(
      'Delete Account',
      'Are you sure? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteUser(authRef.currentUser);
              navigation.reset({ index: 0, routes: [{ name: 'LoginScreen' }] });
            } catch (err) {
              Alert.alert('Error', err.message);
            }
          },
        },
      ]
    );
  };

  const version = Constants?.manifest?.version || '1.0.0';

  return (
    <View style={{ flex: 1 }}>
      {/* Sticky Header */}
      <View style={[styles.headerRow, styles.stickyHeader]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.profileTitle}>Settings</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Scrollable Content */}
      <ScrollView
        style={[styles.container, { marginTop: 60 }]} // adjust height to match sticky header
        contentContainerStyle={{ paddingBottom: 40 }}
      >

      {/* Notifications */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        <View style={styles.settingRow}>
          <View style={styles.settingLabelRow}>
            <Ionicons name="bulb-outline" size={20} color={theme.text} style={{ marginRight: 8 }} />
            <View>
              <Text style={styles.settingLabel}>Date Night Tips</Text>
              <Text style={styles.settingDescription}>Occasional tips and inspiration</Text>
            </View>
          </View>
          <Switch value={tipsEnabled} onValueChange={handleToggleTips} />
        </View>
        <View style={styles.settingRow}>
          <View style={styles.settingLabelRow}>
            <Ionicons name="calendar-outline" size={20} color={theme.text} style={{ marginRight: 8 }} />
            <View>
              <Text style={styles.settingLabel}>Event Alerts</Text>
              <Text style={styles.settingDescription}>Get notified about local events</Text>
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
            <Ionicons name="moon-outline" size={20} color={theme.text} style={{ marginRight: 8 }} />
            <Text style={styles.settingLabel}>Dark Mode</Text>
          </View>
          <Switch value={themeState.mode === 'dark'} onValueChange={toggleTheme} />
        </View>
      </View>

      {/* Account */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.settingRow}>
          <Ionicons name="mail-outline" size={20} color={theme.text} style={{ marginRight: 8 }} />
          <Text style={styles.settingLabel}>{billingEmail || 'Not signed in'}</Text>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={theme.text} style={{ marginRight: 8 }} />
          <Text style={styles.logoutButtonText}>Log Out</Text>
        </TouchableOpacity>
      </View>

      {/* Help & Legal section */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Help & Legal</Text>

        <TouchableOpacity
          style={styles.settingRow}
          onPress={() => Linking.openURL('https://sauntera.com/privacy.html')}
        >
          <Ionicons name="shield-checkmark-outline" size={20} color={theme.text} style={{ marginRight: 8 }} />
          <Text style={styles.settingLabel}>Privacy Policy</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.settingRow}
          onPress={() => Linking.openURL('https://sauntera.com/terms.html')}
        >
          <Ionicons name="document-text-outline" size={20} color={theme.text} style={{ marginRight: 8 }} />
          <Text style={styles.settingLabel}>Terms of Use</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingRow} onPress={() => navigation.navigate('LegalScreen', { type: 'copyright' })}>
          <Ionicons name="clipboard-outline" size={20} color={theme.text} style={{ marginRight: 8 }} />
          <Text style={styles.settingLabel}>Copyright Notice</Text>
        </TouchableOpacity>
      </View>


      {/* App Info */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>App Info</Text>
        <View style={styles.settingRow}>
          <Ionicons name="information-circle-outline" size={20} color={theme.text} style={{ marginRight: 8 }} />
          <Text style={styles.settingLabel}>Version {version}</Text>
        </View>
      </View>

      {/* Delete Account */}
      <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteAccount}>
        <Ionicons name="trash-outline" size={20} color={theme.text} style={{ marginRight: 8 }} />
        <Text style={styles.deleteButtonText}>Delete Account</Text>
      </TouchableOpacity>
    </ScrollView>
    </View>
  );
}
