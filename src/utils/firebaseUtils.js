// FILE: src/utils/firebaseUtils.js
// Firestore-first + single GPT fallback (deterministic):
// 1) Firestore (primary city)
// 2) Firestore (primary + nearby)
// 3) GPT+Google backend trigger, then reload and return

import { getAuthInstance, db } from '../config/firebaseConfig';
import { collection, query as fsQuery, where, doc, setDoc } from 'firebase/firestore';
import { fetchIdeasFromBackendAndReload, fetchIdeasFromFirestore } from './apiUtils';
import { passesAllFilters, FILTER_TAG_MAP } from './filterMap';
import { normalizeLocationString } from './locationNormalize';

// ───────────────────────────────────────────────────────────────────────────────
// Small, local utils (no React deps)

const normId = (x, i = 0) =>
  String(
    x?.id ||
      x?.docId ||
      x?.placeId ||
      x?.place_id ||
      x?.ideaKey ||
      x?.key ||
      `anon-${i}`
  );

const isValidIdea = (it) => {
  if (!it || typeof it !== 'object') return false;
  const hasId = !!(it.id || it.docId || it.placeId || it.place_id || it.ideaKey || it.key);
  const hasText = !!(it.title || it.name || it.venue_name || it.place_name);
  return hasId && hasText;
};

function dedupeById(arr) {
  const seen = new Set();
  const out = [];
  for (let i = 0; i < (arr?.length || 0); i++) {
    const it = arr[i];
    const id = normId(it, i);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(it);
  }
  return out;
}

const filterIdeas = (ideas, filters) => {
  if (!filters || Object.keys(filters).length === 0) return ideas || [];
  return (ideas || []).filter((idea) => passesAllFilters(idea, filters));
};

// ───────────────────────────────────────────────────────────────────────────────
// Compat shim: supports both positional and object call styles
export const ensureIdeasFromNearbyOrWide = async function compatEnsureIdeasFromNearbyOrWide(
  ...args
) {
  let opts;
  if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null) {
    opts = args[0];
  } else {
    const [
      coords,
      city,
      filters = {},
      minCount = 5,
      /* regenerateCount = 0 */ _ignored0,
      expandRadius = false,
      forceNearby = false,
      queryStr = '',
      nearbyCities = [],
      deckType = 'main',
      includeRestaurants = false,
    ] = args;

    opts = {
      coords,
      city,
      filters,
      minCount,
      expandRadius,
      forceNearby,
      queryStr,
      nearbyCities,
      deckType,
      includeRestaurants,
    };
  }

  const {
    coords,
    city,
    filters = {},
    minCount = 5,
    expandRadius = false,
    forceNearby = false,
    queryStr = '',
    nearbyCities = [],
    deckType = 'main',
    includeRestaurants = false,
  } = opts;

  // Normalize for backend/excludes; fetchIdeasFromFirestore also normalizes internally.
  const normalizedCity = city ? normalizeLocationString(city).string : null;
  const normalizedNearby = (nearbyCities || []).map((c) => normalizeLocationString(c).string);

  try {
    // ── 1) Firestore: primary only
    const primary = await fetchIdeasFromFirestore({
      city: normalizedCity || undefined,
      filters,
      nearbyCities: [],
      deckType,
      includeRestaurants,
    });

    let pool = dedupeById(filterIdeas(primary, filters)).filter(isValidIdea);
    if (pool.length >= minCount) {
      console.log('🎯 ensureIdeasFromNearbyOrWide (stored only):', pool.length);
      return pool.slice(0, minCount);
    }

    // ── 2) Firestore: primary + nearby (single batched call)
    const canTryNearby = forceNearby || (Array.isArray(normalizedNearby) && normalizedNearby.length > 0);
    if (canTryNearby) {
      const withNearby = await fetchIdeasFromFirestore({
        city: normalizedCity || undefined,
        filters,
        nearbyCities: normalizedNearby,
        deckType,
        includeRestaurants,
      });

      pool = dedupeById(filterIdeas(withNearby, filters)).filter(isValidIdea);
      if (pool.length >= minCount) {
        console.log('🎯 ensureIdeasFromNearbyOrWide (stored with nearby):', pool.length);
        return pool.slice(0, minCount);
      }
    }

    // ── 3) GPT+Google backend trigger, then short reload (handled inside apiUtils)
    console.log('🤖 Final fallback: GPT+Google single fetch (primary only)');
    const after = await fetchIdeasFromBackendAndReload({
      city: normalizedCity || undefined,
      coords,
      filters,                 // full user filters; apiUtils may narrow for backend
      userId: 'guest',
      expandRadius: expandRadius || true,
      excludeCities: [],       // scope is the city; no excludes
      query: queryStr || '',
      radius: 0,
      silent: false,
      nearbyCities: normalizedNearby, // used during reload phase
      deckType,
      includeRestaurants,
      minCount,                // ← ensure backend aims to satisfy minimum
    });

    const finalPool = dedupeById(filterIdeas(after, filters)).filter(isValidIdea);
    console.log('🎯 ensureIdeasFromNearbyOrWide (final after GPT+reload):', finalPool.length);
    return finalPool.slice(0, minCount);
  } catch (err) {
    console.warn('ensureIdeasFromNearbyOrWide failed:', err?.message || err);
    return [];
  }
};

// ───────────────────────────────────────────────────────────────────────────────
// Save idea for logged-in user

export const saveIdeaForUser = async (idea) => {
  const auth = await getAuthInstance();
  const user = auth?.currentUser;
  if (!user) return;

  try {
    const ideaRef = doc(db, `users/${user.uid}/savedIdeas`, String(normId(idea)));
    await setDoc(ideaRef, {
      ...idea,
      savedAt: new Date(),
    });
  } catch (err) {
    console.error('❌ Error saving idea:', err);
  }
};

// ───────────────────────────────────────────────────────────────────────────────
// Optional: compound Firestore query (kept for compatibility with callers)

export function buildCompoundFirestoreQuery(location, filters) {
  const queryRef = collection(db, 'dateIdeas');
  const norm = location ? normalizeLocationString(location).string : '';
  const conditions = [where('location', '==', norm)];

  // choose highest-priority filters and merge their tags
  let maxPriority = -1;
  for (const f of (filters || [])) {
    const cfg = FILTER_TAG_MAP[f];
    if (cfg?.priority > maxPriority) maxPriority = cfg.priority;
  }

  const combinedTags = new Set();
  let priceLevelCap;

  for (const f of (filters || [])) {
    const cfg = FILTER_TAG_MAP[f];
    if (!cfg) continue;
    const { tags = [], priority, priceLevel } = cfg;

    if (priority === maxPriority) {
      for (const t of tags) combinedTags.add(t);
    }
    if (priceLevel !== undefined) {
      priceLevelCap = priceLevelCap === undefined ? priceLevel : Math.min(priceLevelCap, priceLevel);
    }
  }

  if (combinedTags.size > 0) {
    conditions.push(where('tags', 'array-contains-any', [...combinedTags]));
  }
  if (priceLevelCap !== undefined) {
    conditions.push(where('priceLevel', '<=', priceLevelCap));
  }

  return fsQuery(queryRef, ...conditions);
}

export default {
  ensureIdeasFromNearbyOrWide,
  saveIdeaForUser,
  buildCompoundFirestoreQuery,
};
