// SwipeDeck.js (flicker-safe; stable keys across updates; guards invalid items; premium looping)
import React, { useRef, useMemo, useCallback, useEffect, useState } from "react";
import { View, FlatList, Dimensions } from "react-native";
import { useNavigation } from "@react-navigation/native";

import DateIdeaCard from "./DateIdeaCard";
import LoadingCard from "./LoadingCard";
import LimitReachedCard from "./LimitReachedCard";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_HEIGHT = 320;
const ENDLESS_PREFETCH = 4;
const MAX_BUFFER = 220;
const TRIM_TO = 160;

/** Sentinels */
const isLoadingItem = (item) => item?.type === "loading-more";
const isLimitReachedItem = (item) => item?.type === "limit-reached";
const isSentinel = (item) => isLoadingItem(item) || isLimitReachedItem(item);

/** IDs + validity */
const normalizeId = (it, idx = 0) =>
  it?.id ?? it?.place_id ?? it?.docId ?? it?.key ?? `item-${idx}`;

const isValidIdea = (it) => {
  if (!it || typeof it !== "object") return false;
  const hasId = !!(it.id ?? it.place_id ?? it.docId ?? it.key);
  const hasText = !!(it.title ?? it.name ?? it.venue_name ?? it.place_name);
  return hasId && hasText;
};

const dedupeById = (list) => {
  const seen = new Set();
  const out = [];
  for (let i = 0; i < (list?.length || 0); i++) {
    const it = list[i];
    const id = normalizeId(it, i);
    if (!id) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(it);
  }
  return out;
};

/** Stable key registry (persistent across updates) */
function makeStableKeyRegistry() {
  let seq = 0;
  const map = new Map(); // baseId -> stable key prefix
  return {
    baseKeyFor(item, idx = 0) {
      if (isLoadingItem(item)) return "loading-more";
      if (isLimitReachedItem(item)) return "limit-reached";
      const baseId = normalizeId(item, idx);
      if (!map.has(baseId)) map.set(baseId, `k${++seq}:${String(baseId)}`);
      return map.get(baseId);
    },
    maybeTrim(knownIds) {
      if (map.size > 2000) {
        const keep = new Set(knownIds);
        for (const id of Array.from(map.keys())) if (!keep.has(id)) map.delete(id);
      }
    },
  };
}

const SwipeDeck = ({
  data,
  ideas,
  loading,
  reloading,
  isLoadingMore,
  loadMoreIdeas,
  isEndlessForPremium = false,
  onCardPress,
  containerStyle,
  forceLockHeight = false,
}) => {
  const navigation = useNavigation();
  const baseInput = useMemo(() => (Array.isArray(data) ? data : ideas || []), [data, ideas]);

  // Baseline: filter junk & dedupe by id BEFORE building keys
  const realBaseCards = useMemo(() => {
    const cleaned = (baseInput || []).filter((x) => !isSentinel(x) && isValidIdea(x));
    return dedupeById(cleaned);
  }, [baseInput]);

  const [renderList, setRenderList] = useState([]);
  const loopCounterRef = useRef(0);
  const lastVisibleIndexRef = useRef(0);
  const appendInFlightRef = useRef(false);
  const currentIndexRef = useRef(0);
  const lastPoolSizeRef = useRef(0);

  const keyRegistryRef = useRef(makeStableKeyRegistry());
  const keyRegistry = keyRegistryRef.current;
  const busy = !!(loading || reloading || isLoadingMore);

  const ItemWrapper = useCallback(
    ({ children }) => <View style={{ width: SCREEN_WIDTH }}>{children}</View>,
    []
  );

  /** Wrap items with stable + unique keys (include a pass index to avoid dupes across loops) */
  const buildStableRenderList = useCallback(
    (items, pass = 0) =>
      items.map((item, idx) => ({
        ...item,
        _loopKey: `${keyRegistry.baseKeyFor(item, idx)}#${pass}:${idx}`,
      })),
    [keyRegistry]
  );

  /** Initial render */
  useEffect(() => {
    const initialSource = isEndlessForPremium ? realBaseCards : baseInput;
    const next = buildStableRenderList(initialSource, 0);
    setRenderList((prev) => {
      if (prev.length === next.length && prev.every((p, i) => p?._loopKey === next[i]?._loopKey)) {
        return prev;
      }
      return next;
    });
    lastVisibleIndexRef.current = 0;
    lastPoolSizeRef.current = realBaseCards.length;

    try {
      const ids = realBaseCards.map((it, i) => normalizeId(it, i)).filter(Boolean);
      keyRegistry.maybeTrim(ids);
    } catch {}
  }, [baseInput, realBaseCards, isEndlessForPremium, buildStableRenderList, keyRegistry]);

  /** Shuffle helper */
  const shuffleIndices = useCallback((len) => {
    const arr = Array.from({ length: len }, (_, i) => i);
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, []);

  /** Append premium loop with UNIQUE keys per occurrence */
  const appendLoopNow = useCallback(() => {
    if (!isEndlessForPremium || appendInFlightRef.current || !realBaseCards.length) return;
    appendInFlightRef.current = true;
    loopCounterRef.current += 1;
    const pass = loopCounterRef.current;

    const idxs = shuffleIndices(realBaseCards.length);
    const reshuffled = idxs.map((i, localIdx) => {
      const item = realBaseCards[i];
      const baseKey = keyRegistry.baseKeyFor(item, i);
      return { ...item, _loopKey: `${baseKey}#${pass}:${localIdx}` };
    });

    setRenderList((prev) => {
      const combined = prev.concat(reshuffled);
      return combined.length <= MAX_BUFFER ? combined : combined.slice(combined.length - TRIM_TO);
    });

    setTimeout(() => {
      appendInFlightRef.current = false;
    }, 80);
  }, [isEndlessForPremium, realBaseCards, shuffleIndices, keyRegistry]);

  const maybeAppendPremiumLoop = useCallback(
    (currentIndex) => {
      if (!isEndlessForPremium) return;
      const total = renderList.length;
      if (total === 0 || realBaseCards.length === 0) return;
      if (currentIndex >= Math.max(total - ENDLESS_PREFETCH, 0)) appendLoopNow();
    },
    [isEndlessForPremium, renderList.length, realBaseCards.length, appendLoopNow]
  );

  /** When premium pool first loads, trigger loop append */
  useEffect(() => {
    if (!isEndlessForPremium) return;
    const poolGrew = realBaseCards.length > lastPoolSizeRef.current;
    const notLoopingYet = renderList.length === realBaseCards.length;
    if ((poolGrew || notLoopingYet) && realBaseCards.length > 0) {
      lastPoolSizeRef.current = realBaseCards.length;
      appendLoopNow();
    }
  }, [isEndlessForPremium, realBaseCards.length, renderList.length, appendLoopNow]);

  const viewabilityConfig = useMemo(
    () => ({ itemVisiblePercentThreshold: 60, minimumViewTime: 50 }),
    []
  );

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (!viewableItems?.length) return;
    const maxIdx = viewableItems.reduce(
      (max, vi) => (vi.index > max ? vi.index : max),
      lastVisibleIndexRef.current
    );
    lastVisibleIndexRef.current = maxIdx;
    currentIndexRef.current = maxIdx;
    maybeAppendPremiumLoop(maxIdx);
  });

  const onScroll = useCallback((e) => {
    const x = e?.nativeEvent?.contentOffset?.x || 0;
    currentIndexRef.current = Math.max(0, Math.round(x / SCREEN_WIDTH));
  }, []);

  const onMomentumScrollEnd = useCallback(() => {
    if (isEndlessForPremium && realBaseCards.length) {
      if (currentIndexRef.current >= renderList.length - 1) appendLoopNow();
    }
  }, [appendLoopNow, isEndlessForPremium, realBaseCards.length, renderList.length]);

  /** Render a card */
  const renderItem = useCallback(
    ({ item }) => {
      if (isLimitReachedItem(item)) {
        return (
          <ItemWrapper>
            <LimitReachedCard />
          </ItemWrapper>
        );
      }
      if (!isValidIdea(item)) {
        return (
          <ItemWrapper>
            <LoadingCard />
          </ItemWrapper>
        );
      }
      return (
        <ItemWrapper>
          <DateIdeaCard
            idea={item}
            navigation={navigation}
            onPress={() =>
              onCardPress
                ? onCardPress(item)
                : navigation.navigate("DateIdeaDetails", { idea: item })
            }
          />
        </ItemWrapper>
      );
    },
    [ItemWrapper, navigation, onCardPress]
  );

  const keyExtractor = useCallback(
    (item, index) => item?._loopKey ?? `${keyRegistry.baseKeyFor(item, index)}#0:${index}`,
    [keyRegistry]
  );

  const getItemLayout = useCallback((_data, index) => {
    const length = SCREEN_WIDTH;
    return { length, offset: length * index, index };
  }, []);

  // --- NEW: hard guard to show a blocking loader if no real cards exist yet ---
  const hasRealCards = realBaseCards.length > 0;
  const shouldBlockWithLoader =
    !hasRealCards &&
    (busy || renderList.length === 0 || renderList.every((x) => !isValidIdea(x)));

  const lockHeight = forceLockHeight || !hasRealCards || busy;

  const deckContainerStyle = useMemo(
    () => [
      { minHeight: CARD_HEIGHT },
      lockHeight ? { height: CARD_HEIGHT } : null,
      containerStyle || null,
    ],
    [lockHeight, containerStyle]
  );

  if (shouldBlockWithLoader) {
    return (
      <View style={[deckContainerStyle, { justifyContent: "center" }]}>
        <View style={{ width: SCREEN_WIDTH }}>
          <LoadingCard />
        </View>
      </View>
    );
  }
  // ---------------------------------------------------------------------------

  return (
    <View style={deckContainerStyle}>
      <FlatList
        data={renderList}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        snapToInterval={SCREEN_WIDTH}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        initialNumToRender={6}
        windowSize={8}
        removeClippedSubviews={false}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={30}
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewableItemsChanged.current}
        onEndReachedThreshold={0.6}
        onEndReached={() => {
          if (!isEndlessForPremium && typeof loadMoreIdeas === "function" && !isLoadingMore) {
            loadMoreIdeas();
          }
        }}
        onScroll={onScroll}
        onMomentumScrollEnd={onMomentumScrollEnd}
        scrollEventThrottle={16}
        getItemLayout={getItemLayout}
        ListEmptyComponent={
          busy ? (
            <View style={{ width: SCREEN_WIDTH }}>
              <LoadingCard />
            </View>
          ) : null
        }
        ListFooterComponent={
          isLoadingMore ? (
            <View style={{ width: SCREEN_WIDTH }}>
              <LoadingCard />
            </View>
          ) : null
        }
      />
    </View>
  );
};

export default SwipeDeck;
