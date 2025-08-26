// utils/locationNormalize.js
// Canonicalizes "City, Admin, Country" to full names (ISO-like) and builds a stable compare key.
// Fix: robust title-case for spaces, hyphens, slashes, and apostrophes so Firestore equality matches.
// Supports common US/Canada abbreviations and aliases (e.g., "USA" -> "United States", "NY" -> "New York")

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

function clean(s) {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .replace(/\u200B/g, '') // zero-width space
    .trim();
}

function lc(s) { return clean(s).toLowerCase(); }

/**
 * Title-case city/admin tokens across word boundaries, hyphens and slashes.
 * Also handles simple apostrophe cases like O'Neill.
 * e.g. "whitchurch-stouffville" -> "Whitchurch-Stouffville"
 *      "guelph/eramosa" -> "Guelph/Eramosa"
 */
function titleCaseGeo(s) {
  const str = clean(s).toLowerCase();

  // Capitalize first letter after start, space, hyphen, or slash
  let out = str.replace(/(^|[ \-/])([a-z])/g, (_, sep, ch) => sep + ch.toUpperCase());

  // Capitalize letters after apostrophes (e.g., o'neill -> O'Neill)
  out = out.replace(/([A-Za-z])'([a-z])/g, (_, a, b) => `${a}'${b.toUpperCase()}`);

  return out;
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

// Simple city canonicalization: no NYC borough collapsing
export function canonicalCity(cityRaw, adminFull, countryFull) {
  const cityClean = clean(cityRaw);
  return titleCaseGeo(cityClean);
}

// Parse "City, Admin, Country" or variants into parts
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
