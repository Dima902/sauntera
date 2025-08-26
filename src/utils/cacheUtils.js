// cacheUtils.js - refactored 24-Apr-2025. 10.08pm
import AsyncStorage from '@react-native-async-storage/async-storage';

// In-memory cache (module-scoped, not exported)
const memoryCache = {};

// Toggle for logging (set to false in production)
const ENABLE_CACHE_LOGS = true;

// Utility: create a cache key (supports city or coords)
const makeCacheKey = (namespace, keyObj) => {
  if (typeof keyObj === 'string') return `${namespace}${keyObj}`;
  // If keyObj is { city, lat, lon } or similar
  if (typeof keyObj === 'object' && keyObj !== null) {
    return `${namespace}${JSON.stringify(keyObj)}`;
  }
  throw new Error('Invalid cache key');
};

/**
 * Fetch with in-memory and persistent cache.
 * @param {string|object} keyObj - City name or {city, lat, lon}
 * @param {function} fetcherFn - Async function to fetch data if cache miss
 * @param {string} namespace - Namespace for cache keys
 * @param {number} expiryMs - Expiry in ms (default 7 days)
 */
export const fetchWithCache = async (
  keyObj,
  fetcherFn,
  namespace = 'default_',
  expiryMs = 7 * 24 * 60 * 60 * 1000
) => {
  const key = makeCacheKey(namespace, keyObj);

  // 1️⃣ In-memory check
  if (memoryCache[key]) {
    if (ENABLE_CACHE_LOGS) console.log(`✅ In-memory cache hit: ${key}`);
    return memoryCache[key];
  }

  // 2️⃣ AsyncStorage check
  try {
    const persisted = await AsyncStorage.getItem(key);
    if (persisted) {
      const { data, timestamp } = JSON.parse(persisted);
      if (Date.now() - timestamp < expiryMs) {
        if (ENABLE_CACHE_LOGS) console.log(`✅ Persistent cache hit: ${key}`);
        memoryCache[key] = data;
        return data;
      } else {
        await AsyncStorage.removeItem(key); // expired
      }
    }
  } catch (err) {
    if (ENABLE_CACHE_LOGS) console.warn(`⚠️ Error reading cache for ${key}:`, err);
  }

  // 3️⃣ Fallback to API fetcherFn
  try {
    const freshData = await fetcherFn(keyObj);
    memoryCache[key] = freshData;
    await AsyncStorage.setItem(key, JSON.stringify({ data: freshData, timestamp: Date.now() }));
    if (ENABLE_CACHE_LOGS) console.log(`⬇️ Cached fresh data for: ${key}`);
    return freshData;
  } catch (err) {
    if (ENABLE_CACHE_LOGS) console.error(`❌ Error fetching fresh data for ${key}:`, err);
    return null;
  }
};

/**
 * Clear expired caches for a given namespace.
 * @param {string} namespace
 * @param {number} expiryMs
 */
export const clearExpiredCaches = async (namespace = '', expiryMs = 7 * 24 * 60 * 60 * 1000) => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const filteredKeys = keys.filter(key => key.startsWith(namespace));
    const now = Date.now();

    for (const key of filteredKeys) {
      const item = await AsyncStorage.getItem(key);
      if (item) {
        const { timestamp } = JSON.parse(item);
        if (!timestamp || (now - timestamp) > expiryMs) {
          if (ENABLE_CACHE_LOGS) console.log(`🗑️ Clearing expired cache: ${key}`);
          await AsyncStorage.removeItem(key);
          delete memoryCache[key];
        }
      }
    }
  } catch (err) {
    if (ENABLE_CACHE_LOGS) console.error('Error clearing expired caches:', err);
  }
};

/**
 * Manually clear all caches for a given namespace (regardless of expiry).
 * @param {string} namespace
 */
export const clearAllCaches = async (namespace = '') => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const filteredKeys = keys.filter(key => key.startsWith(namespace));
    for (const key of filteredKeys) {
      await AsyncStorage.removeItem(key);
      delete memoryCache[key];
      if (ENABLE_CACHE_LOGS) console.log(`🧹 Cleared cache: ${key}`);
    }
  } catch (err) {
    if (ENABLE_CACHE_LOGS) console.error('Error clearing all caches:', err);
  }
};