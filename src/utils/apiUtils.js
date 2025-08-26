// utils/apiUtils.js
// – fast Firestore querying by normalized location(s) + alias expansion
// - Batched where('location','in',[...]) with alias variants (USA/United States, UK, UAE, etc.)
// - US state + Canadian province/territory abbreviation expansion (both directions where safe)
// - Short retry loop after backend POST to avoid racing the write
// - Server-side predicate builder aligned with filterMap.js via filterPredicates.js
// - Disjunction control: dynamically shrink 'location in [...]' batch to keep product ≤ 30
// - If Budget-Friendly is too sparse, auto-widen price tiers on a second pass

import { db } from '../config/firebaseConfig';
import {
  collection,
  getDocs,
  query as fsQuery,
  where,
  limit as fsLimit,
} from 'firebase/firestore';

import {
  passesAllFilters,
  reduceFiltersByPriority,
  filterPriority,
} from './filterMap';

import { normalizeLocationString } from './locationNormalize';

// Single source of truth for server-side predicates
import {
  buildFirestorePredicatesFromFilters,
  maybeWidenPrice,
} from './filterPredicates';

// ---------------- Tunables ----------------
const MAX_FETCH_LIMIT_PER_BATCH = 200; // cap per Firestore query
const IN_BATCH_SIZE = 10;              // Firestore 'in' supports up to 10 values
const RESTAURANT_ACTS = ['coffeeshop', 'dinner', 'rooftop', 'teatime'];

// --------------- Country aliases ---------------
const COUNTRY_ALIASES = {
  'United States': ['USA', 'US', 'United States of America'],
  'USA': ['United States', 'US', 'United States of America'],
  'US': ['USA', 'United States', 'United States of America'],
  'United Kingdom': ['UK', 'Great Britain', 'GB'],
  'UK': ['United Kingdom', 'Great Britain', 'GB'],
  'UAE': ['United Arab Emirates'],
  'United Arab Emirates': ['UAE'],
  // Intentionally no alias for "Canada" to avoid "CA" conflict with California.
};

// --------------- US state abbrev ---------------
const US_STATE_PAIRS = [
  ['Alabama','AL'], ['Alaska','AK'], ['Arizona','AZ'], ['Arkansas','AR'],
  ['California','CA'], ['Colorado','CO'], ['Connecticut','CT'], ['Delaware','DE'],
  ['Florida','FL'], ['Georgia','GA'], ['Hawaii','HI'], ['Idaho','ID'],
  ['Illinois','IL'], ['Indiana','IN'], ['Iowa','IA'], ['Kansas','KS'],
  ['Kentucky','KY'], ['Louisiana','LA'], ['Maine','ME'], ['Maryland','MD'],
  ['Massachusetts','MA'], ['Michigan','MI'], ['Minnesota','MN'], ['Mississippi','MS'],
  ['Missouri','MO'], ['Montana','MT'], ['Nebraska','NE'], ['Nevada','NV'],
  ['New Hampshire','NH'], ['New Jersey','NJ'], ['New Mexico','NM'], ['New York','NY'],
  ['North Carolina','NC'], ['North Dakota','ND'], ['Ohio','OH'], ['Oklahoma','OK'],
  ['Oregon','OR'], ['Pennsylvania','PA'], ['Rhode Island','RI'], ['South Carolina','SC'],
  ['South Dakota','SD'], ['Tennessee','TN'], ['Texas','TX'], ['Utah','UT'],
  ['Vermont','VT'], ['Virginia','VA'], ['Washington','WA'], ['West Virginia','WV'],
  ['Wisconsin','WI'], ['Wyoming','WY'],
];
const US_STATE_ABBR = Object.fromEntries(US_STATE_PAIRS);
const US_ABBR_STATE = Object.fromEntries(US_STATE_PAIRS.map(([name, abbr]) => [abbr, name]));

// --------------- Canadian provinces ---------------
const CA_PROV_ABBR = {
  Alberta: 'AB',
  'British Columbia': 'BC',
  Manitoba: 'MB',
  'New Brunswick': 'NB',
  'Newfoundland and Labrador': 'NL',
  'Nova Scotia': 'NS',
  Ontario: 'ON',
  'Prince Edward Island': 'PE',
  Quebec: 'QC', // normalized (no accent)
  Saskatchewan: 'SK',
  'Northwest Territories': 'NT',
  Nunavut: 'NU',
  Yukon: 'YT',
};
const CA_ABBR_PROV = Object.fromEntries(Object.entries(CA_PROV_ABBR).map(([k, v]) => [v, k]));

// ---------------- Utils ----------------
function uniq(arr) {
  const seen = new Set();
  const out = [];
  for (const v of arr) {
    const s = String(v || '').trim();
    if (!s) continue;
    if (!seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  }
  return out;
}

function expandCountryAliases(locStr) {
  const parts = String(locStr).split(',').map((s) => s.trim());
  if (parts.length < 2) return [locStr];
  const country = parts[parts.length - 1];
  const aliases = COUNTRY_ALIASES[country];
  if (!aliases || !aliases.length) return [locStr];
  const head = parts.slice(0, -1).join(', ');
  const out = [locStr];
  for (const alt of aliases) out.push(`${head}, ${alt}`);
  return uniq(out);
}

function maybeAddUSStateAbbrevVariants(locStrs) {
  const out = new Set(locStrs);
  for (const s of locStrs) {
    const parts = s.split(',').map((p) => p.trim());
    if (parts.length !== 3) continue;
    const [city, stateOrAbbr, country] = parts;
    const countryUpper = (country || '').toUpperCase();
    if (
      countryUpper === 'USA' ||
      countryUpper === 'US' ||
      countryUpper === 'UNITED STATES' ||
      countryUpper === 'UNITED STATES OF AMERICA'
    ) {
      const abbr = US_STATE_ABBR[stateOrAbbr];
      if (abbr) out.add(`${city}, ${abbr}, ${country}`);
      if (US_ABBR_STATE[stateOrAbbr]) out.add(`${city}, ${US_ABBR_STATE[stateOrAbbr]}, ${country}`);
    }
  }
  return Array.from(out);
}

function maybeAddCanadianProvAbbrevVariants(locStrs) {
  const out = new Set(locStrs);
  for (const s of locStrs) {
    const parts = s.split(',').map((p) => p.trim());
    if (parts.length !== 3) continue;
    const [city, provOrAbbr, country] = parts;
    if ((country || '').toLowerCase() !== 'canada') continue;

    const normalized =
      provOrAbbr.normalize?.('NFD').replace(/[\u0300-\u036f]/g, '') ?? provOrAbbr;
    const abbr = CA_PROV_ABBR[provOrAbbr] || CA_PROV_ABBR[normalized];
    if (abbr) out.add(`${city}, ${abbr}, ${country}`);
    if (CA_ABBR_PROV[provOrAbbr]) out.add(`${city}, ${CA_ABBR_PROV[provOrAbbr]}, ${country}`);
  }
  return Array.from(out);
}

function expandLocationAliases(baseLocations) {
  let expanded = [];
  for (const base of baseLocations) {
    expanded.push(...expandCountryAliases(base));
  }
  expanded = maybeAddUSStateAbbrevVariants(expanded);
  expanded = maybeAddCanadianProvAbbrevVariants(expanded);
  return uniq(expanded);
}

const shuffleArray = (array) => {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// ---------------- Disjunction control ----------------
// Keep (#location_in) * (#activity_in) * (#price_in) ≤ 30
function computeLocBatchSizeFor(predicates) {
  const actN = Array.isArray(predicates?.activityIn)
    ? Math.min(predicates.activityIn.length, 10)
    : 1;
  const priceN = Array.isArray(predicates?.priceIn)
    ? Math.min(predicates.priceIn.length, 10)
    : 1;

  const denom = Math.max(1, actN * priceN); // 'category == …' doesn't contribute
  const maxDisj = 30;
  const raw = Math.floor(maxDisj / denom);
  return Math.min(IN_BATCH_SIZE, Math.max(1, raw));
}

// ---------------- Firestore fetch ----------------
async function fetchIdeasByLocationsBatched(locationsNormOrAliased, predicates = {}) {
  const t0 = Date.now();
  const ideasRef = collection(db, 'dateIdeas');
  const out = [];

  // NEW: dynamic chunk size to avoid disjunction overflow
  const locBatchSize = computeLocBatchSizeFor(predicates);
  const actN = Array.isArray(predicates?.activityIn) ? Math.min(predicates.activityIn.length, 10) : 1;
  const priceN = Array.isArray(predicates?.priceIn) ? Math.min(predicates.priceIn.length, 10) : 1;
  console.log(
    `🔢 disjunction control: locBatchSize=${locBatchSize}, activityN=${actN}, priceN=${priceN}, ` +
    `maxProduct=${locBatchSize * actN * priceN}`
  );

  for (let i = 0; i < locationsNormOrAliased.length; i += locBatchSize) {
    const chunk = locationsNormOrAliased.slice(i, i + locBatchSize);
    if (!chunk.length) continue;

    const q = fsQuery(
      ideasRef,
      where('location', 'in', chunk),
      ...(predicates.activityIn ? [where('activity', 'in', predicates.activityIn.slice(0, 10))] : []),
      ...(predicates.categoryEq ? [where('category', '==', predicates.categoryEq)] : []),
      ...(predicates.priceIn ? [where('price', 'in', predicates.priceIn.slice(0, 10))] : []),
      fsLimit(MAX_FETCH_LIMIT_PER_BATCH)
    );

    const snapT0 = Date.now();
    const snapshot = await getDocs(q);
    const snapMs = Date.now() - snapT0;

    snapshot.forEach((doc) => out.push(doc.data()));
    console.log(
      `🗂️ Firestore batch ${Math.floor(i / locBatchSize) + 1} size=${chunk.length} ` +
      `fetched=${snapshot.size} in ${snapMs}ms`
    );
  }

  const totalMs = Date.now() - t0;
  console.log(`🗃️ Firestore total (batched by location): ${out.length} docs in ${totalMs}ms`);
  return out;
}

/**
 * Reduce any selected filters down to ONE highest-priority filter for backend fetch.
 * - Uses filterPriority to choose the max.
 * - Ties are broken by user selection order (first occurrence wins).
 * - Returns normalized { 'Quick Filters': [...], 'Advanced Filters': [...] } with exactly 0 or 1 item.
 */
function reduceToSingleBackendFilter(filters = {}) {
  const quick = Array.isArray(filters['Quick Filters']) ? filters['Quick Filters'] : [];
  const advanced = Array.isArray(filters['Advanced Filters']) ? filters['Advanced Filters'] : [];
  const all = [...quick, ...advanced];

  if (all.length === 0) {
    return { 'Quick Filters': [], 'Advanced Filters': [] };
  }

  let best = null;
  let bestScore = -Infinity;
  for (const f of all) {
    const score = typeof filterPriority[f] === 'number' ? filterPriority[f] : 0;
    if (score > bestScore) {
      bestScore = score;
      best = f;
    }
  }

  const single = { 'Quick Filters': [], 'Advanced Filters': [] };
  if (best) {
    if (quick.includes(best)) single['Quick Filters'] = [best];
    else if (advanced.includes(best)) single['Advanced Filters'] = [best];
  }

  console.log('🎯 Backend single-filter selection:', single, '(from selected:', filters, ')');
  return single;
}

/**
 * Fetch ideas from Firestore with server-side location filtering (alias-aware)
 * and one Firestore-friendly predicate (activity/category/price) aligned to filterMap.js.
 *
 * Accepts either the object payload or the legacy positional style.
 */
export const fetchIdeasFromFirestore = async function compatFetchIdeasFromFirestore(
  arg1 = null,
  arg2 = {},
  arg3 = [],
  arg4 = 'main',
  arg5 = false
) {
  try {
    // Normalize incoming args
    let city, filters, nearbyCities, deckType, includeRestaurants;

    if (arg1 && typeof arg1 === 'object' && !Array.isArray(arg1)) {
      const payload = arg1;
      city = payload.city ?? payload.location ?? null;
      filters = payload.filters ?? {};
      nearbyCities = payload.nearbyCities ?? [];
      deckType = payload.deckType ?? 'main';
      includeRestaurants = payload.includeRestaurants ?? (deckType === 'restaurant');
    } else {
      city = arg1;
      filters = arg2 ?? {};
      nearbyCities = arg3 ?? [];
      deckType = arg4 ?? 'main';
      includeRestaurants = arg5 ?? (arg4 === 'restaurant');
    }

    // 🔽 Canonicalize locations & expand aliases
    const normCity = city ? normalizeLocationString(city).string : null;
    const normNearby = (nearbyCities || []).map((c) => normalizeLocationString(c).string);

    const base = [normCity, ...normNearby].filter(Boolean);
    const aliased = expandLocationAliases(base);
    const locationsToMatch = uniq([...base, ...aliased]);

    console.log('📍 Firestore querying for locations (with aliases):', locationsToMatch);
    console.log('🎛️ Filters passed in:', filters);
    console.log('🍽️ Deck type:', deckType, 'Include restaurants:', includeRestaurants);

    // ⏱️ Phase A: network fetch (by location + best predicate)
    const { predicate: initialPred, chosenKey } =
      buildFirestorePredicatesFromFilters(filters, { includeRestaurants });

    const netT0 = Date.now();
    let locationFiltered = await fetchIdeasByLocationsBatched(locationsToMatch, initialPred);
    let netMs = Date.now() - netT0;
    console.log(
      `⏱️ FS network (pass#1) took ${netMs}ms, docs=${locationFiltered.length}, pred= `,
      initialPred,
      'chosenKey=',
      chosenKey
    );

    // If filtered and too sparse for Budget-Friendly, widen price and re-try once
    const anySelected =
      (filters?.['Quick Filters']?.length || 0) + (filters?.['Advanced Filters']?.length || 0) > 0;

    if (anySelected && locationFiltered.length < 5 && chosenKey === 'Budget-Friendly' && initialPred?.priceIn) {
      const widened = maybeWidenPrice(initialPred);
      if (widened !== initialPred) {
        const net2T0 = Date.now();
        const widenedRes = await fetchIdeasByLocationsBatched(locationsToMatch, widened);
        const net2Ms = Date.now() - net2T0;
        console.log(`⏱️ FS network (pass#2 price-wide) took ${net2Ms}ms, docs=${widenedRes.length}, pred=`, widened);
        if (widenedRes.length > locationFiltered.length) {
          locationFiltered = widenedRes;
          netMs += net2Ms;
        }
      }
    }

    // ⏱️ Phase B: activity split (main deck drops restaurants unless needed)
    const actT0 = Date.now();
    const restaurants = locationFiltered.filter((i) =>
      RESTAURANT_ACTS.includes(String(i.activity || '').toLowerCase())
    );
    const nonRestaurants = locationFiltered.filter(
      (i) => !RESTAURANT_ACTS.includes(String(i.activity || '').toLowerCase())
    );

    let scoped = [];
    if (deckType === 'restaurant' || includeRestaurants) {
      scoped = restaurants;
    } else {
      // main deck: exclude restaurants
      if (nonRestaurants.length === 0 && restaurants.length > 0) {
        const noFiltersSelected =
          !filters ||
          (!filters['Advanced Filters']?.length && !filters['Quick Filters']?.length);
        scoped = noFiltersSelected ? restaurants.slice(0, 6) : nonRestaurants;
      } else {
        scoped = nonRestaurants;
      }
    }
    console.log(
      `🍽️ Activity scope => restaurants=${restaurants.length}, non=${nonRestaurants.length}, used=${scoped.length} in ${
        Date.now() - actT0
      }ms`
    );

    // Shuffle before user filters
    const shuffleT0 = Date.now();
    const shuffled = shuffleArray(scoped);
    const shuffleMs = Date.now() - shuffleT0;

    // Reduce filters by priority (same as before)
    const reduced = reduceFiltersByPriority(filters || {});
    if (JSON.stringify(reduced) !== JSON.stringify(filters || {})) {
      console.log('🪄 Filters reduced by priority:', reduced, '(from', filters, ')');
    }

    const hasAny =
      reduced &&
      (reduced['Quick Filters']?.length || reduced['Advanced Filters']?.length);

    if (!hasAny) {
      console.log(`✅ No user filters; returning ${shuffled.length} (shuffle ${shuffleMs}ms)`);
      return shuffled;
    }

    // ⏱️ Phase C: local filter
    const filtT0 = Date.now();
    const filtered = shuffled.filter((idea) => passesAllFilters(idea, reduced));
    const filtMs = Date.now() - filtT0;

    if (!filtered.length) {
      console.warn('⚠️ No ideas passed the reduced filters.');
    }

    console.log(
      `⏱️ FS post steps: shuffle=${shuffleMs}ms, filter=${filtMs}ms, final=${filtered.length}`
    );
    return filtered;
  } catch (e) {
    console.error('🔥 Error fetching from Firestore:', e);
    return [];
  }
};

// ---------- GPT+Google backend trigger + post-fetch reload with short retry ----------
export const fetchIdeasFromBackendAndReload = async ({
  city,
  coords,
  filters,
  userId = 'guest',
  expandRadius = false,
  excludeCities = [],
  query = '',
  radius = 0,
  silent = false,
  nearbyCities = [],
  deckType = 'main',
  includeRestaurants = false,
}) => {
  try {
    const normalizedCity = city ? normalizeLocationString(city).string : null;
    const normalizedExclude = (excludeCities || []).map((c) => normalizeLocationString(c).string);
    const normalizedNearby = (nearbyCities || []).map((c) => normalizeLocationString(c).string);

    // collapse to a single highest-priority filter for backend
    const backendSingleFilter = reduceToSingleBackendFilter(filters || {});

    const payload = {
      city: normalizedCity,
      coords,
      // IMPORTANT: backend gets only ONE filter (highest priority)
      filters: backendSingleFilter,
      userId,
      expandRadius,
      radius,
      excludeCities: normalizedExclude,
      query,
      silent,
      deckType,
      includeRestaurants,
      nearbyCities: normalizedNearby,
    };

    console.log(
      `📡 Triggering backend fetch for: ${
        normalizedCity || (coords ? `${coords?.lat},${coords?.lon}` : 'unknown')
      } deckType:${deckType} includeRestaurants:${includeRestaurants}`
    );
    console.log('🧩 Backend filters (single):', backendSingleFilter);

    const t0 = Date.now();
    await fetch('https://us-central1-happoria.cloudfunctions.net/generateDateIdeasFn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const postMs = Date.now() - t0;
    console.log(`📨 Backend POST returned in ${postMs}ms`);

    // Small retry loop: allow CF write to land and indexes to catch up
    const RETRY_DELAYS = [900, 1200, 1600]; // total ~3.7s worst-case
    let last = [];

    for (let i = 0; i < RETRY_DELAYS.length; i++) {
      await new Promise((res) => setTimeout(res, RETRY_DELAYS[i]));

      // Reload using the user's full original filters;
      const updatedIdeas = await fetchIdeasFromFirestore(
        normalizedCity,
        filters,
        normalizedNearby,
        deckType,
        includeRestaurants
      );

      if (updatedIdeas.length > 0) {
        console.log(
          `🔄 Reloaded ${updatedIdeas.length} ideas after GPT fallback (attempt ${i + 1})`
        );
        return updatedIdeas;
      }
      last = updatedIdeas;
    }

    console.log(`🔄 Reloaded ${last.length} ideas after GPT fallback (final attempt)`);
    return last;
  } catch (err) {
    console.error('❌ Error triggering GPT fetch + reload:', err?.message || err);
    return [];
  }
};
