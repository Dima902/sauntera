// locationUtils.js – aliases-first (≤1 km) + offsets, with caching, NO FALLBACKS
// Supports both {lat, lon} and {latitude, longitude} shapes.

const BASE_URL = 'https://fetchnearbycitiesfromoffsets-dbfubq4w5q-uc.a.run.app';
const CACHE_VERSION = 'v3';

const cityCache = new Map();   // combined aliases+offsets per (lat,lon)
const modeCache = new Map();   // per (lat,lon,mode,radius)

async function fetchCitiesCore({ lat, lon, mode = 'offsets', radiusMeters = 1000 }) {
  if (!lat || !lon) return [];

  const cacheKey = `${CACHE_VERSION}:${lat.toFixed(4)},${lon.toFixed(4)}::${mode}::${radiusMeters}`;
  if (modeCache.has(cacheKey)) return modeCache.get(cacheKey);

  const url =
    mode === 'radius'
      ? `${BASE_URL}?lat=${lat}&lon=${lon}&mode=radius&radiusMeters=${radiusMeters}`
      : `${BASE_URL}?lat=${lat}&lon=${lon}&mode=offsets`;

  try {
    const response = await fetch(url);
    const isJson = response.headers.get('content-type')?.includes('application/json');
    if (!response.ok || !isJson) {
      const text = await response.text().catch(() => '');
      console.error('❌ Invalid response for', mode, { status: response.status, text });
      modeCache.set(cacheKey, []);
      return [];
    }

    const data = await response.json();
    let cities = [];

    if (Array.isArray(data.cities) && data.cities.length > 0) {
      if (typeof data.cities[0] === 'string') {
        cities = data.cities.filter(Boolean);
      } else {
        // legacy compatibility: { name, regionName, countryName }
        cities = data.cities
          .map(c => `${c.name}, ${c.regionName}, ${c.countryName}`)
          .filter(Boolean);
      }
    }

    if (!cities.length) {
      console.warn(`⚠️ No cities returned for mode=${mode}.`);
    }

    modeCache.set(cacheKey, cities);
    return cities;
  } catch (err) {
    console.error(`❌ Error fetching cities (mode=${mode}):`, err);
    modeCache.set(cacheKey, []);
    return [];
  }
}

export async function fetchNearbyAliasesWithin1Km(lat, lon, radiusMeters = 1000) {
  return fetchCitiesCore({ lat, lon, mode: 'radius', radiusMeters });
}

export async function fetchNearbyCitiesOffsets(lat, lon) {
  return fetchCitiesCore({ lat, lon, mode: 'offsets' });
}

export async function getNearbyCitiesPreferredOrder(lat, lon, radiusMeters = 1000) {
  if (!lat || !lon) return [];

  const key = `${CACHE_VERSION}:${lat.toFixed(3)},${lon.toFixed(3)}::preferred::${radiusMeters}`;
  if (cityCache.has(key)) return cityCache.get(key);

  const [aliases, offsets] = await Promise.all([
    fetchNearbyAliasesWithin1Km(lat, lon, radiusMeters),
    fetchNearbyCitiesOffsets(lat, lon),
  ]);

  const seen = new Set();
  const out = [];
  for (const list of [aliases, offsets]) {
    for (const s of list) {
      const k = String(s || '').trim();
      if (!k) continue;
      const lower = k.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        out.push(k);
      }
    }
  }

  cityCache.set(key, out);
  console.log(`✅ nearby cities (aliases-first) for ${key}:`, out);
  return out;
}

export const fetchNearbyCitiesFromOffsets = async (latitude, longitude) => {
  let lat, lon;
  if (typeof latitude === 'object' && latitude !== null) {
    lat = latitude.lat ?? latitude.latitude;
    lon = latitude.lon ?? latitude.longitude;
  } else {
    lat = latitude;
    lon = longitude;
  }

  if (!lat || !lon) return [];

  const key = `${CACHE_VERSION}:${lat.toFixed(3)},${lon.toFixed(3)}::combined`;
  if (cityCache.has(key)) return cityCache.get(key);

  const combined = await getNearbyCitiesPreferredOrder(lat, lon, 1000);
  cityCache.set(key, combined);
  return combined;
};
