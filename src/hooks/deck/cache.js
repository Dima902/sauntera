// FILE: src/hooks/deck/cache.js
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NEARBY_CITY_CACHE_DURATION } from "./config";

export function deckCacheKey({ userId = "guest", deckType, dateStr }) {
  return `deckCache:${userId}:${deckType}:${dateStr}`;
}

export async function purgeStaleDeckCaches(todayStr) {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const stale = keys.filter((k) => k.startsWith("deckCache:") && !k.endsWith(`:${todayStr}`));
    if (stale.length) await AsyncStorage.multiRemove(stale);
  } catch {}
}

export async function loadDeckIdsFromCache(cacheKey) {
  try { const raw = await AsyncStorage.getItem(cacheKey); const parsed = raw ? JSON.parse(raw) : null; return Array.isArray(parsed) ? parsed : null; } catch { return null; }
}

export async function saveDeckIdsToCache(cacheKey, ids) {
  try { await AsyncStorage.setItem(cacheKey, JSON.stringify(ids)); } catch {}
}

export async function getNearbyCitiesCached(lat, lon, fetchNearbyCitiesFromOffsets) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return [];
  const cacheKey = `nearbyCities-${lat},${lon}`;
  try {
    const raw = await AsyncStorage.getItem(cacheKey);
    if (raw) {
      const { cities, timestamp } = JSON.parse(raw);
      if (Array.isArray(cities) && Date.now() - timestamp < NEARBY_CITY_CACHE_DURATION) return cities;
    }
  } catch {}
  const cities = await fetchNearbyCitiesFromOffsets(lat, lon);
  try { await AsyncStorage.setItem(cacheKey, JSON.stringify({ cities, timestamp: Date.now() })); } catch {}
  return cities;
}

export function backendAttemptKey({ dateStr, deckType, location, filtersKey }) {
  const loc = String(location || "").trim() || "unknown";
  return `backendAttempt:${dateStr}:${deckType}:${loc}:${filtersKey}`;
}