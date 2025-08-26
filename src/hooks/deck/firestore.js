// FILE: src/hooks/deck/firestore.js
import { dedupeArrayById, isValidIdea } from "./ids";

/**
 * Loader responsible for fetching FS ideas with (optionally) nearby cities.
 * - Uses nearbyCitiesRef.current when primaryOnly === false.
 * - Preserves previous fullPoolRef on empty fetches when preserveOnEmpty=true.
 * - Returns a sessionPool using computeSessionPool.
 */
export function makeFirestoreLoader({
  deckType,
  includeRestaurants,
  isFiltered,
  effectiveFiltersObj,
  normalizedLocation,
  effectiveLocation,
  nearbyCitiesRef,
  computeSessionPool,
  fetchIdeasFromFirestore,
  isStrictJazz, // (kept for parity; not used here directly)
}) {
  const fullPoolRef = { current: [] };

  async function loadFromFirestore({ preserveOnEmpty = false, primaryOnly = true } = {}) {
    const city = normalizedLocation || effectiveLocation || null;
    const nearby = primaryOnly ? [] : (nearbyCitiesRef?.current || []);

    // IMPORTANT: pass nearbyCities only when primaryOnly === false
    const raw = await fetchIdeasFromFirestore({
      city,
      filters: isFiltered ? (effectiveFiltersObj || {}) : {},
      nearbyCities: nearby,
      includeRestaurants: includeRestaurants === true,
      deckType: deckType || "main",
    });

    let cleaned = dedupeArrayById((raw || []).filter(isValidIdea));
    // If filtered results are sparse, try widening to nearby cities in a second pass
    if (isFiltered && cleaned.length < 5 && (nearbyCitiesRef?.current || []).length > 0 && primaryOnly === true) {
      const widened = await fetchIdeasFromFirestore({
        city,
        filters: effectiveFiltersObj || {},
        nearbyCities: nearbyCitiesRef.current || [],
        includeRestaurants: includeRestaurants === true,
        deckType: deckType || "main",
      });
      const widenedClean = dedupeArrayById((widened || []).filter(isValidIdea));
      if (widenedClean.length > cleaned.length) {
        cleaned = widenedClean;
      }
    }
    if (cleaned.length === 0 && preserveOnEmpty) {
      // keep the last good pool if requested
      return {
        sessionPool: computeSessionPool(fullPoolRef.current || []),
        totalFirestoreCount: (fullPoolRef.current || []).length,
        fullPoolRef,
      };
    }

    fullPoolRef.current = cleaned;
    const sessionPool = computeSessionPool(fullPoolRef.current || []);
    return { sessionPool, totalFirestoreCount: cleaned.length, fullPoolRef };
  }

  return { loadFromFirestore, fullPoolRef };
}

export default makeFirestoreLoader;
