// FILE: src/hooks/deck/filters.js
import { passesAllFilters, reduceFiltersByPriority } from "../../utils/filterMap";

/**
 * Merge Advanced + Quick filter arrays into a single flat list (for presence checks).
 * Always returns an array.
 */
export function normalizeFiltersObject(filtersObj) {
  const adv = (filtersObj && filtersObj["Advanced Filters"]) || [];
  const quick = (filtersObj && filtersObj["Quick Filters"]) || [];
  return [...adv, ...quick];
}

/**
 * For restaurant deck we enforce "Romantic Dinner" to guarantee results.
 */
export function injectRomanticDinner(filters = {}) {
  const adv = new Set(filters["Advanced Filters"] || []);
  adv.add("Romantic Dinner");
  return {
    ...filters,
    "Advanced Filters": Array.from(adv),
    "Quick Filters": filters["Quick Filters"] || [],
  };
}

/**
 * Apply local (client-side) filters to a list of ideas.
 * - On main deck, remove restaurant-like activities unless explicitly included
 * - Otherwise, honor reduceFiltersByPriority + passesAllFilters
 */
export function applyLocalFilters({
  list,
  deckType,
  reducedFiltersObj,
  includeRestaurants,
}) {
  let filtered = Array.isArray(list) ? list.slice() : [];

  // Remove restaurant-like items from MAIN unless explicitly allowed
  if (deckType === "main" && !includeRestaurants) {
    const RESTAURANT_ACTS = new Set(["coffeeshop", "dinner", "rooftop", "teatime"]);
    filtered = filtered.filter(
      (it) => !RESTAURANT_ACTS.has(String(it?.activity || "").toLowerCase())
    );
  }

  // Apply user filters if any are present (or always for restaurant deck)
  const hasUserFilters =
    (reducedFiltersObj?.["Quick Filters"]?.length || 0) > 0 ||
    (reducedFiltersObj?.["Advanced Filters"]?.length || 0) > 0;

  if (deckType === "restaurant" || hasUserFilters) {
    filtered = filtered.filter((it) => passesAllFilters(it, reducedFiltersObj || {}));
  }

  return filtered;
}

// Re-export to keep existing imports working
export { reduceFiltersByPriority };
