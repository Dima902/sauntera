// FILE: src/hooks/deck/config.js
// Centralized knobs shared across modules (ASCII-only, no markdown headers)
export const LIMITS = {
  guest: { main: 5, restaurant: 5 },
  free:  { main: 20, mainFiltered: 10, restaurant: 10 },
};

export const MINIMUMS = {
  premium: { mainMin: 40, mainFilteredMin: 15, restaurantMin: 20 },
};

export const BATCH_SIZE = 5;
export const REFRESH_INTERVAL_MS = 3000; // initial backoff
export const NEARBY_CITY_CACHE_DURATION = 1000 * 60 * 60 * 12; // 12h
export const BOOT_DEBOUNCE_MS = 250;
export const FETCH_DEBOUNCE_MS = 1200;
export const INFLIGHT_COOLDOWN_MS = 12000;

// Removed: JAZZ_PREMIUM_MAIN_FILTERED_MIN, JAZZ_FILTER_KEYS

export const LIMIT_REACHED_SENTINEL = { id: "limit-reached", type: "limit-reached" };
export const isSentinel = (x) => x?.type === "limit-reached";

export const ENABLE_LOAD_METRICS = true;
export const __LOG__ = typeof __DEV__ !== "undefined" ? __DEV__ : true;
export const log = (...a) => { if (__LOG__) console.log(...a); };
export const warn = (...a) => { if (__LOG__) console.warn(...a); };
