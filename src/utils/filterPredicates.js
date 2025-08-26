// src/utils/filterPredicates.js
// Single source of truth for queryable predicate groups used by Firestore.
// Mirrors filterMap.js semantics exactly.

import { filterPriority } from './filterMap';

// --- Canonicalization (protects against token drift like 'iceSkating' vs 'iceskating')
export const ACTIVITY_ALIASES = {
  iceSkating: 'iceskating',
  gallery: 'artgallery',
  climbinggym: 'rockclimbing',
  bouldering: 'rockclimbing',
  // add more if you find variants in stored data
};

export const toCanonicalActivity = (a) =>
  (ACTIVITY_ALIASES?.[a] || a || '').toLowerCase();

// --- Exact activity groups (mirrors filterMap.js)
export const ACTIVITY_GROUPS = {
  'First Date':       ['arcade', 'market', 'picnic', 'parkwalk', 'boardgames'],
  'Anniversary':      ['liveconcert', 'winetasting', 'spa', 'poetryreading'],

  'Fun & Playful':    ['arcade', 'boardgames', 'vr', 'escaperoom', 'bowling', 'foodtruck'],

  'Romantic Dinner':  ['dinner', 'rooftop', 'teatime', 'coffeeshop'],

  'Cultural Experience': ['museum', 'artgallery', 'bookstore', 'poetryreading', 'historicwalk'],

  'Bars':             ['bar'],

  'Live Entertainment': ['liveconcert', 'livejazz', 'comedyshow', 'theater'],

  'Active & Sporty':  ['basketball', 'rockclimbing', 'gym', 'hiking', 'biking', 'tennis', 'iceskating'],

  'Jazz Night':       ['livejazz'],

  'Relaxation & Spa': ['spa', 'hotchocolate', 'yoga'],

  'Creative & Artsy': ['artclass', 'potteryclass', 'museum', 'artgallery', 'recordshopping'],

  'Relaxed & Chill':  ['cinema', 'spa', 'indoorpicnic', 'teatime', 'bookstore'],

  'Exciting & Thrilling': ['escaperoom', 'helicopterride', 'vr'],

  'Unique & Unusual Dates': ['ferryride', 'helicopterride', 'communityevent', 'streetart', 'openaircinema'],
};

// Category equality mapping (mirrors filterMap.js)
export const CATEGORY_EQ = {
  'Indoor Activities': 'ind',
  'Outdoor Adventure': 'out',
};

// Budget-friendly semantics in UI include $$.
// For querying, you often get better results by starting tight and widening if sparse.
export const PRICE_GROUPS = {
  primary: ['Free', '$'],
  wide:    ['Free', '$', '$$'],
};

// Utility: return all selected filters as a flat, ordered array
const flattenSelected = (filters) => ([
  ...(filters?.['Quick Filters'] ?? []),
  ...(filters?.['Advanced Filters'] ?? []),
]);

// Choose the best single Firestore-friendly predicate to push.
// Priority uses your filterPriority to pick the strongest non-layerable activity/group first.
// Falls back to category, then price. If nothing matches and includeRestaurants=true,
// bias to dinner-ish activities (Romantic Dinner).
export function buildFirestorePredicatesFromFilters(filters, { includeRestaurants = false } = {}) {
  const selected = flattenSelected(filters);
  if (!selected.length) return { predicate: {}, chosenKey: null };

  // 1) Prefer activity groups by highest filterPriority score
  const byScore = [...selected]
    .filter((label) => ACTIVITY_GROUPS[label]?.length)
    .sort((a, b) => (filterPriority[b] ?? 0) - (filterPriority[a] ?? 0));

  if (byScore.length) {
    const chosenKey = byScore[0];
    const list = ACTIVITY_GROUPS[chosenKey].map(toCanonicalActivity);
    return { predicate: { activityIn: list }, chosenKey };
  }

  // 2) Category equality if present
  for (const label of selected) {
    const cat = CATEGORY_EQ[label];
    if (cat) return { predicate: { categoryEq: cat }, chosenKey: label };
  }

  // 3) Price (Budget-Friendly)
  if (selected.includes('Budget-Friendly')) {
    return { predicate: { priceIn: PRICE_GROUPS.primary.slice() }, chosenKey: 'Budget-Friendly' };
  }

  // 4) Restaurant deck bias if requested and no predicate chosen
  if (includeRestaurants) {
    const list = ACTIVITY_GROUPS['Romantic Dinner'].map(toCanonicalActivity);
    return { predicate: { activityIn: list }, chosenKey: 'Romantic Dinner' };
  }

  return { predicate: {}, chosenKey: null };
}

// Optional helper: widen Budget-Friendly if sparse (<minCount)
export function maybeWidenPrice(predicate) {
  if (predicate?.priceIn &&
      predicate.priceIn.length === PRICE_GROUPS.primary.length) {
    return { ...predicate, priceIn: PRICE_GROUPS.wide.slice() };
  }
  return predicate;
}
