// FILE: src/hooks/useDeckLoader.js
// Thin orchestrator over the split modules above
import { useEffect, useState, useContext, useMemo, useRef, useCallback } from "react";
import { InteractionManager } from "react-native";

import { DateIdeasContext } from "../context/DateIdeasContext";
import { fetchIdeasFromFirestore } from "../utils/apiUtils";
import { ensureIdeasFromNearbyOrWide } from "../utils/firebaseUtils";
import { useUserStatus } from "../hooks/useUserStatus";
import { fetchNearbyCitiesFromOffsets } from "../utils/locationUtils";
import { normalizeLocationString } from "../utils/locationNormalize";

import {
  LIMITS,
  MINIMUMS,
  BATCH_SIZE,
  LIMIT_REACHED_SENTINEL,
  isSentinel,
  ENABLE_LOAD_METRICS,
  log,
} from "./deck/config";
import { Stopwatch, todayYMD } from "./deck/time";
import { attachStableId, dedupeArrayById, isValidIdea } from "./deck/ids";
import {
  deckCacheKey,
  purgeStaleDeckCaches,
  loadDeckIdsFromCache,
  saveDeckIdsToCache,
} from "./deck/cache";
import {
  injectRomanticDinner,
  normalizeFiltersObject,
  reduceFiltersByPriority,
} from "./deck/filters";
import { computeNearbyCities } from "./deck/nearby";
import { makeFirestoreLoader } from "./deck/firestore";
import { makeEnsurer } from "./deck/ensure";

export function useDeckLoader({
  deckType = "main",
  includeRestaurants = false,
  filters: filtersOverride,
  location: locationOverride,
  coords,
}) {
  const ctx = useContext(DateIdeasContext);
  const contextFilters = ctx?.filters ?? { "Advanced Filters": [], "Quick Filters": [] };
  const contextLocation = ctx?.location ?? null;

  const effectiveLocation = useMemo(
    () => (locationOverride ?? contextLocation) || null,
    [locationOverride, contextLocation]
  );
  const normalizedLocation = useMemo(
    () =>
      effectiveLocation
        ? normalizeLocationString(effectiveLocation).string
        : effectiveLocation,
    [effectiveLocation]
  );

  const rawFilters = filtersOverride ?? contextFilters;
  const { isGuest, isPremium, isLoading: userStatusLoading, userId = "guest" } =
    useUserStatus();

  const enforcedRestaurantFilters = useMemo(
    () =>
      deckType === "restaurant"
        ? injectRomanticDinner({ "Advanced Filters": [], "Quick Filters": [] })
        : null,
    [deckType]
  );
  const effectiveFiltersObj = useMemo(
    () => (deckType === "restaurant" ? enforcedRestaurantFilters : rawFilters),
    [deckType, enforcedRestaurantFilters, rawFilters]
  );

  const filtersKey = useMemo(
    () =>
      JSON.stringify(
        effectiveFiltersObj || { "Advanced Filters": [], "Quick Filters": [] }
      ),
    [effectiveFiltersObj]
  );
  const allFilters = useMemo(
    () => normalizeFiltersObject(effectiveFiltersObj),
    [filtersKey]
  );

  const tierType = userStatusLoading
    ? "pending"
    : isPremium
    ? "premium"
    : isGuest
    ? "guest"
    : "free";
  const isFiltered =
    deckType === "restaurant"
      ? true
      : tierType !== "guest" && allFilters.length > 0;

  const targets = useMemo(() => {
    if (tierType === "premium") {
      return {
        type: "premium",
        min:
          deckType === "main"
            ? (isFiltered ? MINIMUMS.premium.mainFilteredMin : MINIMUMS.premium.mainMin)
            : MINIMUMS.premium.restaurantMin,
      };
    }
    if (tierType === "guest")
      return {
        type: "guest",
        limit: deckType === "main" ? LIMITS.guest.main : LIMITS.guest.restaurant,
      };
    return {
      type: "free",
      limit:
        deckType === "main"
          ? isFiltered
            ? LIMITS.free.mainFiltered
            : LIMITS.free.main
          : LIMITS.free.restaurant,
    };
  }, [tierType, isFiltered, deckType]);

  const todayStr = useMemo(() => todayYMD(), []);
  // IMPORTANT: cache key must be location + filters + date to avoid carrying old-city IDs.
  const cacheKey = useMemo(
    () => deckCacheKey({
      userId: userId || "guest",
      deckType,
      dateStr: todayStr,
      // append loc + filters to avoid collisions when switching cities
      extra: `${normalizedLocation || effectiveLocation || ""}::${filtersKey}`,
    }),
    [userId, deckType, todayStr, normalizedLocation, effectiveLocation, filtersKey]
  );

  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const lastGoodRef = useRef([]);
  const poolRef = useRef([]);
  const nextIndexRef = useRef(0);
  const nearbyCitiesRef = useRef([]);
  const cacheWrittenRef = useRef(false);

  useEffect(() => {
    purgeStaleDeckCaches(todayStr);
  }, [todayStr]);

  const reducedFiltersObj = useMemo(
    () =>
      reduceFiltersByPriority(
        effectiveFiltersObj || { "Advanced Filters": [], "Quick Filters": [] }
      ),
    [filtersKey]
  );
  useEffect(() => {
    if (deckType === "main")
      log("Filters reduced (main):", JSON.stringify(reducedFiltersObj));
  }, [deckType, reducedFiltersObj]);

  const computeSessionPool = useCallback(
    (pool) =>
      targets.type === "premium" ? pool.slice() : pool.slice(0, targets.limit),
    [targets]
  );

  const { loadFromFirestore, fullPoolRef } = useMemo(
    () =>
      makeFirestoreLoader({
        deckType,
        includeRestaurants,
        isFiltered,
        effectiveFiltersObj: reducedFiltersObj,
        normalizedLocation,
        effectiveLocation,
        nearbyCitiesRef,
        computeSessionPool,
        fetchIdeasFromFirestore,
      }),
    [
      deckType,
      includeRestaurants,
      isFiltered,
      reducedFiltersObj,
      normalizedLocation,
      effectiveLocation,
    ]
  );

  const safeSetIdeasSWR = useCallback((nextRaw) => {
    const next = dedupeArrayById(Array.isArray(nextRaw) ? nextRaw : []);
    setIdeas((prev) => {
      const prevDedup = dedupeArrayById(prev || []);
      if (next.length > 0) {
        if (
          prevDedup.length !== next.length ||
          prevDedup.some((x, i) => x !== next[i])
        ) {
          lastGoodRef.current = next;
          return next;
        }
        return prev;
      }
      if (lastGoodRef.current.length > 0) return prev; // keep last good
      return next; // allow empty on true cold start
    });
  }, []);

  const pushNextBatch = useCallback(() => {
    if (targets.type === "premium") {
      safeSetIdeasSWR(poolRef.current.slice());
      return;
    }
    if (poolRef.current.length === 0) {
      setIdeas((prev) => [LIMIT_REACHED_SENTINEL]);
      return;
    }
    const start = nextIndexRef.current;
    const end = Math.min(start + BATCH_SIZE, poolRef.current.length);
    const batch = poolRef.current.slice(start, end).filter(isValidIdea);
    setIdeas((prevRaw) => {
      const prev = (prevRaw || []).filter((x) => !isSentinel(x));
      const merged = dedupeArrayById(prev.concat(batch));
      nextIndexRef.current = merged.length;
      const reachedEnd = nextIndexRef.current >= poolRef.current.length;
      if (reachedEnd) return merged.concat(LIMIT_REACHED_SENTINEL);
      if (merged.length > 0)
        lastGoodRef.current = merged.filter((x) => !isSentinel(x));
      return merged;
    });
  }, [targets.type, safeSetIdeasSWR]);

  const { ensureTargetPopulation } = useMemo(
    () =>
      makeEnsurer({
        deckType,
        targets,
        isFiltered,
        normalizedLocation,
        effectiveLocation,
        coords,
        effectiveFiltersObj: reducedFiltersObj,
        todayStr,
        nearbyCitiesRef,
        loadFromFirestore,
        pushNextBatch,
        safeSetIdeasSWR,
        ensureIdeasFromNearbyOrWide,
      }),
    [
      deckType,
      targets,
      isFiltered,
      normalizedLocation,
      effectiveLocation,
      coords,
      reducedFiltersObj,
      todayStr,
    ]
  );

  const bootKey = useMemo(
    () =>
      `${deckType}|${normalizedLocation || effectiveLocation || ""}|${filtersKey}|${
        targets.type
      }`,
    [deckType, normalizedLocation, effectiveLocation, filtersKey, targets.type]
  );
  const bootDebounceRef = useRef(null);
  const lastBootKeyRef = useRef("");
  const bootTokenRef = useRef(0);

  useEffect(() => {
    if (userStatusLoading) return; // gate until tier resolved
    if (bootDebounceRef.current) clearTimeout(bootDebounceRef.current);
    bootDebounceRef.current = setTimeout(() => {
      if (lastBootKeyRef.current === bootKey) return;
      lastBootKeyRef.current = bootKey;
      bootTokenRef.current += 1;
      const bootToken = bootTokenRef.current;

      (async () => {
        const sw = new Stopwatch(
          `${deckType}:${targets.type}:${isFiltered ? "filtered" : "unfiltered"}`,
          ENABLE_LOAD_METRICS
        );
        lastGoodRef.current = [];
        const hadIdeas = ideas.length > 0;
        setReloading(hadIdeas);
        setLoading(!hadIdeas);
        await new Promise((r) => InteractionManager.runAfterInteractions(r));
        sw.mark("post interactions");

        nextIndexRef.current = 0;
        poolRef.current = [];
        fullPoolRef.current = [];

        const nearbyPromise = computeNearbyCities({
          deckType,
          targetsType: targets.type,
          isFiltered,
          coords,
          effectiveLocation,
          normalizedLocation,
          fetchNearbyCitiesFromOffsets,
        });
        nearbyPromise.then((arr) => {
          nearbyCitiesRef.current = arr;
        });

        const useCache = !(isFiltered || deckType === "restaurant");
        const cachedIds = useCache ? await loadDeckIdsFromCache(cacheKey) : null;
        if (cachedIds) sw.mark("cache ids loaded", { count: cachedIds.length });

        const primaryFetch = await loadFromFirestore({
          preserveOnEmpty: false,
          primaryOnly: true,
        });
        let sessionToUse = primaryFetch.sessionPool;

        const targetMinOrLimit =
          targets.type === "premium" ? targets.min : targets.limit;
        if (
          targets.type === "free" &&
          deckType === "main" &&
          sessionToUse.length < targetMinOrLimit
        ) {
          const arr = await nearbyPromise; // ensure list ready
          const res = await fetchIdeasFromFirestore({
            city: normalizedLocation || effectiveLocation,
            filters: isFiltered ? reducedFiltersObj : {},
            nearbyCities: arr || [],
            includeRestaurants: false,
            deckType,
          });
          const normalizedRes = attachStableId(res).filter(isValidIdea);
          const merged = dedupeArrayById(sessionToUse.concat(normalizedRes));
          sessionToUse = computeSessionPool(merged);
          fullPoolRef.current = merged.slice();
          poolRef.current = sessionToUse; // ✅ critical fix
        } else {
          fullPoolRef.current = primaryFetch.fullPoolRef.current.slice();
          poolRef.current = computeSessionPool(fullPoolRef.current);
        }

        if (sessionToUse.length > 0) {
          if (targets.type === "premium") safeSetIdeasSWR(sessionToUse.slice());
          else pushNextBatch();
          sw.mark("first render", {
            session: sessionToUse.length,
            totalFS: fullPoolRef.current.length,
          });
        }

        const afterPrimaryCount = fullPoolRef.current.length;
        if (afterPrimaryCount < targetMinOrLimit) {
          // Kick the ensurer which now includes a guarded backend trigger.
          ensureTargetPopulation(afterPrimaryCount, bootToken);
        } else {
          sw.mark("target satisfied by primary", { afterPrimaryCount });
        }

        if (
          !isFiltered &&
          deckType !== "restaurant" &&
          !cacheWrittenRef.current &&
          sessionToUse.length > 0
        ) {
          const ids = (sessionToUse || []).filter(isValidIdea).map((x) => x.id);
          await saveDeckIdsToCache(cacheKey, ids);
          cacheWrittenRef.current = true;
          sw.mark("cache ids saved", { count: ids.length });
        }

        setLoading(false);
        setReloading(false);
        sw.end("boot done");
      })();
    }, 250);

    return () => {
      if (bootDebounceRef.current) clearTimeout(bootDebounceRef.current);
    };
  }, [bootKey, userStatusLoading]);

  const loadMoreIdeas = useCallback(() => {
    if (targets.type === "premium") return;
    if (nextIndexRef.current >= poolRef.current.length) return;
    setTimeout(() => pushNextBatch(), 0);
  }, [pushNextBatch, targets.type]);

  const shouldAppendLimitReached = useMemo(
    () =>
      targets.type !== "premium" &&
      nextIndexRef.current >= poolRef.current.length,
    [targets.type, ideas.length]
  );
  const isEndlessForPremium = targets.type === "premium";

  useEffect(() => () => {
    /* cleanup on unmount */
  }, []);

  return {
    ideas,
    loading,
    reloading,
    isLoadingMore,
    loadMoreIdeas,
    shouldAppendLimitReached,
    isEndlessForPremium,
    totalAvailableNow: Array.isArray(poolRef.current)
      ? poolRef.current.length
      : 0,
  };
}

export default useDeckLoader;
