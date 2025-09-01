// utils/locationNormalize.js
// Canonicalizes "City, Admin, Country" to stable names and strips "Old ..." neighborhood prefixes.
// Supports US/Canada abbreviations, aliases, and accent cleanup.

const COUNTRY_ALIASES = {
  'us': 'United States',
  'usa': 'United States',
  'u.s.': 'United States',
  'u.s.a.': 'United States',
  'united states of america': 'United States',
  'united states': 'United States',
  'ca': 'Canada',
  'can': 'Canada',
  'canada': 'Canada',
};

const ADMIN_MAP_US = {
  al: 'Alabama', ak: 'Alaska', az: 'Arizona', ar: 'Arkansas', ca: 'California', co: 'Colorado',
  ct: 'Connecticut', de: 'Delaware', fl: 'Florida', ga: 'Georgia', hi: 'Hawaii', id: 'Idaho',
  il: 'Illinois', in: 'Indiana', ia: 'Iowa', ks: 'Kansas', ky: 'Kentucky', la: 'Louisiana',
  me: 'Maine', md: 'Maryland', ma: 'Massachusetts', mi: 'Michigan', mn: 'Minnesota',
  ms: 'Mississippi', mo: 'Missouri', mt: 'Montana', ne: 'Nebraska', nv: 'Nevada',
  nh: 'New Hampshire', nj: 'New Jersey', nm: 'New Mexico', ny: 'New York',
  nc: 'North Carolina', nd: 'North Dakota', oh: 'Ohio', ok: 'Oklahoma', or: 'Oregon',
  pa: 'Pennsylvania', ri: 'Rhode Island', sc: 'South Carolina', sd: 'South Dakota',
  tn: 'Tennessee', tx: 'Texas', ut: 'Utah', vt: 'Vermont', va: 'Virginia', wa: 'Washington',
  wv: 'West Virginia', wi: 'Wisconsin', wy: 'Wyoming', dc: 'District of Columbia'
};

const ADMIN_MAP_CA = {
  ab: 'Alberta', bc: 'British Columbia', mb: 'Manitoba', nb: 'New Brunswick',
  nl: 'Newfoundland and Labrador', ns: 'Nova Scotia', nt: 'Northwest Territories',
  nu: 'Nunavut', on: 'Ontario', pe: 'Prince Edward Island', qc: 'Quebec',
  sk: 'Saskatchewan', yt: 'Yukon'
};

// --- Old City prefix handling ---
const STRIP_PREFIXES = [
  "old",
  "old town",
  "olde town",
  "old towne",
  "olde towne",
  "old city",
  "old village",
];

const DO_NOT_STRIP_CITY_EXCEPTIONS = new Set([
  "Old Town", "Old Fort", "Old Bridge", "Old Greenwich",
  "Old Westbury", "Old Saybrook", "Old Forge", "Olds",
]);

function clean(s) {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .replace(/\u200B/g, '') // zero-width space
    .trim();
}

function lc(s) { return clean(s).toLowerCase(); }

/**
 * Title-case geo strings (spaces, hyphens, slashes, apostrophes).
 */
function titleCaseGeo(s) {
  const str = clean(s).toLowerCase();
  let out = str.replace(/(^|[ \-/])([a-z])/g, (_, sep, ch) => sep + ch.toUpperCase());
  out = out.replace(/([A-Za-z])'([a-z])/g, (_, a, b) => `${a}'${b.toUpperCase()}`);
  return out;
}

function stripOldNeighborhoodPrefixes(cityRaw) {
  const tokens = String(cityRaw || "").trim().split(/\s+/);
  if (tokens.length <= 1) return cityRaw;
  const lcTokens = tokens.map((t) => t.toLowerCase());
  const candidates = STRIP_PREFIXES.slice().sort((a, b) => b.length - a.length).map((p) => p.split(/\s+/));
  for (const pref of candidates) {
    const maybe = lcTokens.slice(0, pref.length).join(" ");
    if (maybe === pref.join(" ")) {
      const remainder = tokens.slice(pref.length).join(" ").trim();
      if (remainder) return remainder;
      break;
    }
  }
  return cityRaw;
}

export function canonicalCountry(countryRaw) {
  const key = lc(countryRaw);
  if (!key) return '';
  return COUNTRY_ALIASES[key] || COUNTRY_ALIASES[key.replace(/\./g, '')] || titleCaseGeo(countryRaw);
}

export function canonicalAdmin(adminRaw, countryFull) {
  const key = lc(adminRaw);
  if (!key) return '';
  if (countryFull === 'United States') {
    const full = ADMIN_MAP_US[key] ||
      ADMIN_MAP_US[key.replace(/\./g, '')] ||
      Object.values(ADMIN_MAP_US).find(n => lc(n) === key);
    return full ? full : titleCaseGeo(adminRaw);
  }
  if (countryFull === 'Canada') {
    const full = ADMIN_MAP_CA[key] ||
      ADMIN_MAP_CA[key.replace(/\./g, '')] ||
      Object.values(ADMIN_MAP_CA).find(n => lc(n) === key);
    return full ? full : titleCaseGeo(adminRaw);
  }
  return titleCaseGeo(adminRaw);
}

export function canonicalCity(cityRaw, adminFull, countryFull) {
  const cityClean = clean(cityRaw);
  const cityTitle = titleCaseGeo(cityClean);
  if (!DO_NOT_STRIP_CITY_EXCEPTIONS.has(cityTitle)) {
    return titleCaseGeo(stripOldNeighborhoodPrefixes(cityClean));
  }
  return cityTitle;
}

export function parseLocationString(s) {
  const parts = clean(s).split(',').map(p => clean(p));
  if (parts.length === 1) return { city: parts[0], admin: '', country: '' };
  if (parts.length === 2) return { city: parts[0], admin: parts[1], country: '' };
  const country = parts.pop();
  const city = parts.shift();
  const admin = clean(parts.join(', '));
  return { city, admin, country };
}

export function normalizeLocationParts({ city, admin, country }) {
  const countryFull = canonicalCountry(country);
  const adminFull = canonicalAdmin(admin, countryFull);
  const cityFull = canonicalCity(city, adminFull, countryFull);
  return {
    city: cityFull,
    admin: adminFull,
    country: countryFull,
    string: [cityFull, adminFull, countryFull].filter(Boolean).join(', ')
  };
}

export function normalizeLocationString(s) {
  const parts = parseLocationString(s);
  return normalizeLocationParts(parts);
}

export function normKeyFromParts({ city, admin, country }) {
  return [lc(city), lc(admin), lc(country)].join('|');
}

export function normKeyFromString(s) {
  const { city, admin, country } = normalizeLocationString(s);
  return normKeyFromParts({ city, admin, country });
}
