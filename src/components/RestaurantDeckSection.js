// components/RestaurantDeckSection.js
import React, { useMemo, useState, useEffect } from 'react';
import { View, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import SwipeDeck from './SwipeDeck';
import { useTheme } from '../styles/theme';
import { createHomeScreenStyles } from '../styles/HomeScreenStyles';
import { useDeckLoader } from '../hooks/useDeckLoader';

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

export default function RestaurantDeckSection({
  location,
  onLoadingChange,
  forceLockHeight,
}) {
  const navigation = useNavigation();
  const theme = useTheme();
  const styles = useMemo(() => createHomeScreenStyles(theme), [theme]);

  const [restaurantLoadMorePending, setRestaurantLoadMorePending] = useState(false);

  const {
    ideas: restaurantDeck,
    loading: restaurantLoading,
    reloading: restaurantReloading,
    isLoadingMore: isRestaurantLoadingMore,
    loadMoreIdeas: loadMoreRestaurantIdeas,
    isEndlessForPremium,
  } = useDeckLoader({
    deckType: 'restaurant',
    includeRestaurants: true,
    location,
  });

  // Build display list with loading sentinel and de-dupe by id
  const displayRestaurants = useMemo(() => {
    if (restaurantLoading)
      return [{ id: 'loading-restaurant', type: 'loading-more' }];

    let deck = Array.isArray(restaurantDeck) ? restaurantDeck.slice() : [];
    const hasLimitCard = deck.some((item) => item?.type === 'limit-reached');

    if (deck.length === 0) {
      // keep loader while none yet
      return [{ id: 'loading-restaurant-empty', type: 'loading-more' }];
    }

    if (deck.length === 1 && hasLimitCard) {
      deck = deck.concat([{ id: 'loading-pad-rest', type: 'loading-more' }]);
    }

    if (restaurantLoadMorePending && !deck.find((x) => x?.type === 'loading-more')) {
      deck.splice(
        Math.min(5, deck.length),
        0,
        { id: 'loading-more-insert-rest', type: 'loading-more' }
      );
    }

    return dedupeVisibleIdeas(deck);
  }, [restaurantDeck, restaurantLoading, restaurantLoadMorePending]);

  // Notify parent about loading status
  useEffect(() => {
    if (typeof onLoadingChange === 'function') {
      const stillLoading =
        restaurantLoading ||
        restaurantReloading ||
        displayRestaurants.every((x) => x?.type === 'loading-more');
      onLoadingChange(stillLoading);
    }
  }, [restaurantLoading, restaurantReloading, displayRestaurants, onLoadingChange]);

  return (
    <View style={[styles.section, { marginTop: 5 }]}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>Restaurants & Cafés</Text>
      </View>

      <SwipeDeck
        ideas={displayRestaurants}
        loading={restaurantLoading}
        reloading={restaurantReloading}
        isLoadingMore={isRestaurantLoadingMore}
        loadMoreIdeas={async () => {
          setRestaurantLoadMorePending(true);
          try {
            await loadMoreRestaurantIdeas();
          } finally {
            setRestaurantLoadMorePending(false);
          }
        }}
        isEndlessForPremium={isEndlessForPremium}
        onCardPress={(item) => navigation.navigate('DateIdeaDetails', { idea: item })}
        forceLockHeight={!!forceLockHeight}
      />
    </View>
  );
}
