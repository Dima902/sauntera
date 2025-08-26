// FiltersScreen.js — flicker-free premium handling + global max (3) across Quick + Advanced
import React, { useState, useEffect, useMemo, useContext } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../styles/theme';
import { createFiltersScreenStyles } from '../styles/FiltersScreenStyles';
import {
  isMutuallyConflicting,
  quickFilters,
  advancedFilters,
  MAX_SIMULTANEOUS_FILTERS, // keep using this as the global cap = 3
} from '../utils/filtersConfig';
import ZoomToast from '../components/ZoomToast';
import { DateIdeasContext } from '../context/DateIdeasContext';
import { useUserStatus } from '../hooks/useUserStatus';
import PremiumUpsellModal from '../components/PremiumUpsellSheet';

export default function FiltersScreen({ navigation, route }) {
  const theme = useTheme();
  const styles = useMemo(() => createFiltersScreenStyles(theme), [theme]);

  const { filters, setFilters } = useContext(DateIdeasContext);
  const { isPremium, isLoading } = useUserStatus();

  // Only allow advanced when we definitively know they’re premium
  const canUseAdvanced = !isLoading && isPremium;

  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);

  const [selectedFilters, setSelectedFilters] = useState({
    quickFilters: [],
    advancedFilters: [],
  });

  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    if (filters) {
      setSelectedFilters({
        quickFilters: filters['Quick Filters'] || [],
        advancedFilters: filters['Advanced Filters'] || [],
      });
    }
  }, [filters]);

  useEffect(() => {
    const toast = route?.params?.toastMessage;
    if (toast) {
      setToastMessage(toast);
      setToastVisible(true);
    }
  }, [route?.params?.toastMessage]);

  const quickFiltersDisplay = useMemo(
    () => quickFilters.filter((f) => f !== 'Romantic Dinner'),
    []
  );
  const advancedFiltersDisplay = useMemo(() => advancedFilters, []);

  const toggleFilter = (key, filter) => {
    // While loading user status, ignore advanced taps (prevents upsell flash)
    if (key === 'advancedFilters' && (isLoading || !canUseAdvanced)) {
      if (!isLoading) setShowPremiumModal(true);
      return;
    }

    setSelectedFilters((prev) => {
      const updated = { ...prev };
      const allSelected = [...prev.quickFilters, ...prev.advancedFilters];

      // Conflict check
      const conflicts = allSelected.filter((f) => isMutuallyConflicting(f, filter));
      if (conflicts.length > 0) {
        const msg =
          conflicts.length === 1
            ? `"${filter}" can’t be selected with "${conflicts[0]}".`
            : `"${filter}" conflicts with both "${conflicts[0]}" and "${conflicts[1]}".`;
        Alert.alert('😬 Oops! Filters in conflict!', msg);
        return prev;
      }

      // Remove if already selected in this group
      if (key === 'quickFilters' && updated.quickFilters.includes(filter)) {
        updated.quickFilters = updated.quickFilters.filter((f) => f !== filter);
        return updated;
      }
      if (key === 'advancedFilters' && updated.advancedFilters.includes(filter)) {
        updated.advancedFilters = updated.advancedFilters.filter((f) => f !== filter);
        return updated;
      }

      // Enforce GLOBAL cap across Quick + Advanced when adding a new one
      const totalCount = updated.quickFilters.length + updated.advancedFilters.length;
      if (totalCount >= MAX_SIMULTANEOUS_FILTERS) {
        Alert.alert(
          'Limit Reached',
          `You can select up to ${MAX_SIMULTANEOUS_FILTERS} filters total.`
        );
        return prev;
      }

      // Safe to add
      if (key === 'quickFilters') {
        updated.quickFilters = [...updated.quickFilters, filter];
      } else {
        updated.advancedFilters = [...updated.advancedFilters, filter];
      }

      return updated;
    });
  };

  const applyFilters = async () => {
    // Defensive: ensure we never apply more than the global cap
    const totalCount =
      selectedFilters.quickFilters.length + selectedFilters.advancedFilters.length;
    if (totalCount > MAX_SIMULTANEOUS_FILTERS) {
      Alert.alert(
        'Too many filters',
        `Please keep it to ${MAX_SIMULTANEOUS_FILTERS} filters total.`
      );
      return;
    }

    const backendFilters = {
      'Quick Filters': selectedFilters.quickFilters,
      'Advanced Filters': selectedFilters.advancedFilters,
    };
    await setFilters(backendFilters);
    navigation.navigate('HomeScreen');
  };

  const resetFilters = async () => {
    setSelectedFilters({ quickFilters: [], advancedFilters: [] });
    await setFilters({ 'Quick Filters': [], 'Advanced Filters': [] });
    navigation.navigate('HomeScreen', {
      toastMessage: 'Filters cleared — showing all ideas',
    });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerWrapper}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.logo}>Filters</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Quick Filters */}
        <Text style={styles.sectionTitle}>Quick Filters</Text>
        <View style={styles.filterContainer}>
          {quickFiltersDisplay.map((filter) => (
            <TouchableOpacity
              key={filter}
              style={[
                styles.filterButton,
                selectedFilters.quickFilters.includes(filter) ? styles.selected : {},
              ]}
              onPress={() => toggleFilter('quickFilters', filter)}
            >
              <Text
                style={
                  selectedFilters.quickFilters.includes(filter)
                    ? styles.selectedText
                    : styles.unselectedText
                }
              >
                {filter}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Advanced Filters */}
        <Text style={styles.sectionTitle}>
          Advanced Filters {(!isLoading && !isPremium) ? <Text style={{ fontSize: 18 }}>🔒</Text> : null}
        </Text>

        <View style={styles.filterContainer} pointerEvents={isLoading ? 'none' : 'auto'}>
          {advancedFiltersDisplay.map((filter) => (
            <TouchableOpacity
              key={filter}
              style={[
                styles.filterButton,
                selectedFilters.advancedFilters.includes(filter) ? styles.selected : {},
                isLoading ? { opacity: 0.6 } : null,
              ]}
              onPress={() => toggleFilter('advancedFilters', filter)}
              disabled={isLoading}
            >
              <Text
                style={
                  selectedFilters.advancedFilters.includes(filter)
                    ? styles.selectedText
                    : styles.unselectedText
                }
              >
                {filter}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Actions */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.applyButton} onPress={applyFilters}>
          <Text style={styles.buttonText}>Apply Filters</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.resetButton} onPress={resetFilters}>
          <Text style={styles.resetButtonText}>Reset</Text>
        </TouchableOpacity>
      </View>

      {/* Premium modal — keep mounted briefly during exit to avoid pop flicker */}
      {(showPremiumModal || isDismissing) && (
        <PremiumUpsellModal
          visible={showPremiumModal}
          onClose={() => {
            setShowPremiumModal(false);
            setIsDismissing(true);
            setTimeout(() => setIsDismissing(false), 300);
          }}
        />
      )}

      {/* Toast */}
      <ZoomToast
        visible={toastVisible}
        message={toastMessage}
        onPress={() => {
          setToastVisible(false);
          navigation.navigate('LoginScreen');
        }}
        autoDismiss={4000}
      />
    </View>
  );
}
