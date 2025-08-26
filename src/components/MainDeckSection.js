// components/MainDeckSection.js
import React, { useMemo, useState, useEffect, useContext } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import SwipeDeck from './SwipeDeck';
import { useDeckLoader } from '../hooks/useDeckLoader';
import { useTheme } from '../styles/theme';
import { createHomeScreenStyles } from '../styles/HomeScreenStyles';
import { DateIdeasContext } from '../context/DateIdeasContext';
import { useUserStatus } from '../hooks/useUserStatus';

// Helpers
const isSentinel = (item) =>
  item?.type === 'loading-more' || item?.type === 'limit-reached';

const getBaseId = (it) => it?.id ?? it?.place_id ?? it?.key;

/** De-dupe real idea cards by id while preserving sentinels */
function dedupeVisibleIdeas(list) {
  const seen = new Set();
  const out = [];
  for (const it of list) {
    if (isSentinel(it)) {
      out.push(it);
      continue;
    }
    const id = getBaseId(it);
    if (!id) continue;
    if (!seen.has(id)) {
      seen.add(id);
      out.push(it);
    }
  }
  return out;
}

export default function MainDeckSection({
  location,
  coords,
  onLoadingChange,
  forceLockHeight,
  // NEW: injected from HomeScreen to gate Filters for guests
  onPressFilters,
}) {
  const navigation = useNavigation();
  const theme = useTheme();
  const styles = useMemo(() => createHomeScreenStyles(theme), [theme]);

  const { filters } = useContext(DateIdeasContext);
  const { isLoading: statusLoading } = useUserStatus();

  const [isLoadMorePending, setIsLoadMorePending] = useState(false);

  const {
    ideas,
    loading,
    reloading,
    isLoadingMore,
    loadMoreIdeas,
    isEndlessForPremium,
  } = useDeckLoader({
    deckType: 'main',
    includeRestaurants: false,
    location,
    coords,
  });

  // Count active filters (for badge)
  const activeFilterCount = useMemo(() => {
    const quick = filters?.['Quick Filters']?.length ?? 0;
    const adv = filters?.['Advanced Filters']?.length ?? 0;
    return quick + adv;
  }, [filters]);
  const hasActiveFilters = activeFilterCount > 0;

  // Build display list with a loading sentinel while empty
  const displayIdeas = useMemo(() => {
    if (loading) return [{ id: 'loading-main', type: 'loading-more' }];

    let deck = Array.isArray(ideas) ? ideas.slice() : [];
    const hasLimitCard = deck.some((item) => item?.type === 'limit-reached');

    if (deck.length === 0) {
      // keep loader while backend refills / nothing yet
      return [{ id: 'loading-main-empty', type: 'loading-more' }];
    }

    if (deck.length === 1 && hasLimitCard) {
      // pad with a loader after limit to avoid abrupt end
      deck = deck.concat([{ id: 'loading-pad', type: 'loading-more' }]);
    }

    if (isLoadMorePending && !deck.find((x) => x?.type === 'loading-more')) {
      deck.splice(Math.min(5, deck.length), 0, { id: 'loading-more-insert', type: 'loading-more' });
    }

    return dedupeVisibleIdeas(deck);
  }, [ideas, loading, isLoadMorePending]);

  // Notify parent (HomeScreen) about loading status to coordinate height locking
  useEffect(() => {
    if (typeof onLoadingChange === 'function') {
      const stillLoading =
        loading ||
        reloading ||
        displayIdeas.every((x) => x?.type === 'loading-more');
      onLoadingChange(stillLoading);
    }
  }, [loading, reloading, displayIdeas, onLoadingChange]);

  const handleMainFilterPress = () => {
    // Prefer parent-provided handler (will show toast for guests)
    if (typeof onPressFilters === 'function') {
      onPressFilters();
      return;
    }
    // Fallback: direct navigation
    navigation.navigate('FiltersScreen');
  };

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>Featured Date Ideas</Text>
        <TouchableOpacity
          onPress={handleMainFilterPress}
          style={[
            styles.filterButtonIconWrapper,
            hasActiveFilters && styles.filterButtonActive,
          ]}
        >
          <Ionicons
            name="options-outline"
            size={28}
            color={hasActiveFilters ? theme.primary : theme.icon}
          />
          {hasActiveFilters && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <SwipeDeck
        ideas={displayIdeas}
        loading={loading}
        reloading={reloading}
        isLoadingMore={isLoadingMore}
        loadMoreIdeas={async () => {
          setIsLoadMorePending(true);
          try {
            await loadMoreIdeas();
          } finally {
            setIsLoadMorePending(false);
          }
        }}
        isEndlessForPremium={isEndlessForPremium}
        forceLockHeight={!!forceLockHeight}
      />
    </View>
  );
}
