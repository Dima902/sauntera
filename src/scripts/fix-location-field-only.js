#!/usr/bin/env node
/**
 * fix-location-field-only.js (v4)
 *
 * Purpose: STRICTLY rewrite the *location* field to canonical
 *          "City, Region, Country" when we detect postal/case/abbr issues,
 *          e.g., "Toronto, On M5t 2g3, Canada" → "Toronto, Ontario, Canada".
 *
 * - Does NOT read or modify 'locationBase'.
 * - Supports scanning by prefix (orderBy + startAt/endAt).
 * - --force to bypass quick pre-check and attempt canonicalization on all scanned docs.
 * - Uses pretty-case guard so output is always Title Case, not ALL CAPS.
 *
 * Usage:
 *  Dry-run Toronto only:
 *    node fix-location-field-only.js --collection=dateIdeas --onlyCountry=Canada --prefix="Toronto, " --credentials ..\..\credentials\serviceAccount.json --limit=1000
 *
 *  Apply on Toronto:
 *    node fix-location-field-only.js --collection=dateIdeas --onlyCountry=Canada --prefix="Toronto, " --force --credentials ..\..\credentials\serviceAccount.json --apply
 *
 *  Exact one-off:
 *    node fix-location-field-only.js --collection=dateIdeas --whereField=location --whereOp== --whereValue="Toronto, On M5t 2g3, Canada" --credentials ..\..\credentials\serviceAccount.json --apply
 *
 *  Collection group:
 *    node fix-location-field-only.js --collectionGroup=dateIdeas --onlyCountry=Canada --credentials ..\..\credentials\serviceAccount.json --apply
 */

const fs = require("fs");
const path = require("path");
const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");
const admin = require("firebase-admin");

// ---------------- Firebase init ----------------
function initFirebase(argv) {
  if (argv.credentials) {
    const p = path.resolve(process.cwd(), argv.credentials);
    const raw = fs.readFileSync(p, "utf8");
    const json = JSON.parse(raw);
    console.log(`🔐 Using credentials: ${p}`);
    console.log(`   project_id: ${json.project_id}`);
    admin.initializeApp({ credential: admin.credential.cert(json), projectId: json.project_id });
  } else if (!admin.apps.length) {
    admin.initializeApp();
  }
}

// ---------------- Canonicalization helpers ----------------

// Canadian provinces (full ⇄ abbr)
const CA_PROV_ABBR = {
  Alberta: 'AB',
  'British Columbia': 'BC',
  Manitoba: 'MB',
  'New Brunswick': 'NB',
  'Newfoundland and Labrador': 'NL',
  'Nova Scotia': 'NS',
  Ontario: 'ON',
  'Prince Edward Island': 'PE',
  Quebec: 'QC',
  Saskatchewan: 'SK',
  'Northwest Territories': 'NT',
  Nunavut: 'NU',
  Yukon: 'YT',
};
const CA_ABBR_PROV = Object.fromEntries(Object.entries(CA_PROV_ABBR).map(([k,v]) => [v, k]));

// US states (full ⇄ abbr) — present for future use
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
const US_ABBR_STATE = Object.fromEntries(US_STATE_PAIRS.map(([n,a]) => [a, n]));

// Known countries (allowlist)
const KNOWN_COUNTRIES = new Set(['Canada','United States','United Kingdom']);

const POSTAL_MATCHERS = [
  /\b[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d\b/i,     // CA postal (e.g., M6H 1A4)
  /\b\d{5}(-\d{4})?\b/,                           // US ZIP (+4)
];

const clean = (s) => (s || "").replace(/\s+/g, " ").trim();

function stripPostalAndUnits(chunk) {
  let x = chunk || "";
  for (const rx of POSTAL_MATCHERS) x = x.replace(rx, "").trim();
  x = x.replace(/\b(apt|unit|suite|#)\s*\S+$/i, "").trim();
  return x;
}

// Title-case that preserves accents
function titleCasePreserve(s) {
  const lower = (s || "").toLocaleLowerCase();
  return lower.replace(/\b([^\W_]+)([^\s]*)/g, (_m, head, tail) =>
    head.toLocaleUpperCase() + tail
  );
}

// Final pretty-case guard for tokens/whole triplet
function prettyCaseToken(s) {
  const lower = (s || "").toLocaleLowerCase();
  return lower.replace(/\b([^\W_])([^\s]*)/g, (_m, h, t) => h.toLocaleUpperCase() + t);
}
function prettyCaseLocationTriplet(city, region, country) {
  return `${prettyCaseToken(city)}, ${prettyCaseToken(region)}, ${prettyCaseToken(country)}`;
}

function looksLikeStreetNumber(s) { return /^\d+(\s|$)/.test((s || '').trim()); }

function detectCountry(parts) {
  const last = clean(parts[parts.length - 1] || '');
  if (!last) return null;

  const key = last.replace(/[^a-z. ]/gi, '').toLowerCase();
  if (['uk','u.k','u.k.','england','scotland','wales','northern ireland','britain','great britain','gb'].includes(key)) {
    return 'United Kingdom';
  }
  if (['usa','u.s.a','u.s.a.','us','u.s','u.s.','united states of america'].includes(key)) {
    return 'United States';
  }
  for (const c of KNOWN_COUNTRIES) {
    if (c.toLowerCase() === last.toLowerCase()) return c;
  }
  return null;
}

function normalizeRegionForCountry(regionRaw, country) {
  if (!regionRaw) return '';
  const token = regionRaw.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // strip accents for key matching
  const keyUp = token.replace(/[^a-z]/gi, '').toUpperCase();

  if (country === 'Canada') {
    if (CA_ABBR_PROV[keyUp]) return CA_ABBR_PROV[keyUp];                 // from abbr
    for (const full of Object.keys(CA_PROV_ABBR)) {
      if (full.toLowerCase() === regionRaw.toLowerCase()) return full;   // from full
    }
  }
  if (country === 'United States') {
    if (US_ABBR_STATE[keyUp]) return US_ABBR_STATE[keyUp];
    for (const [full] of US_STATE_PAIRS) {
      if (full.toLowerCase() === regionRaw.toLowerCase()) return full;
    }
  }
  return titleCasePreserve(regionRaw); // fallback (keeps accents)
}

/**
 * Canonicalize a free-form location into "City, Region, Country".
 * Returns { value, reason } or { skip:true, reason }.
 */
function canonicalizeLocation(locationRaw) {
  const original = clean(locationRaw);
  if (!original) return { skip: true, reason: 'empty' };

  const partsRaw = original.split(',').map(clean);
  const partsNoPostal = partsRaw.map(stripPostalAndUnits);
  const N = partsNoPostal.length;
  const country = detectCountry(partsNoPostal);

  // Street-first: [addr, city, region, country]
  if (looksLikeStreetNumber(partsNoPostal[0])) {
    if (N < 4) return { skip: true, reason: 'streetFirst-tooShort' };
    const city = titleCasePreserve(partsNoPostal[1]);
    const region = normalizeRegionForCountry(partsNoPostal[2], country || 'Canada');
    const finalCountry = country || 'Canada';
    if (!city || !region || !finalCountry) return { skip: true, reason: 'streetFirst-missingPiece' };
    if (region === finalCountry) return { skip: true, reason: 'region==country' };
    return { value: prettyCaseLocationTriplet(city, region, finalCountry), reason: 'streetFirst' };
  }

  // City-first: [city, region, (postal), country]
  const city = titleCasePreserve(partsNoPostal[0] || '');
  const regionRaw = partsNoPostal[1] || '';
  const region = normalizeRegionForCountry(regionRaw, country || 'Canada');

  if (!city || !region) return { skip: true, reason: 'cityFirst-missingCityOrRegion' };

  let countryOut = country || partsNoPostal[2] || '';
  if (!countryOut && POSTAL_MATCHERS[0].test(original)) countryOut = 'Canada';
  if (!countryOut) return { skip: true, reason: 'countryUnknown' };
  if (region === countryOut) return { skip: true, reason: 'region==country' };

  return { value: prettyCaseLocationTriplet(city, region, countryOut), reason: 'cityFirst' };
}

/**
 * Heuristic "is worth fixing" gate.
 * You can bypass with --force.
 */
function looksBroken(locationStr) {
  const s = String(locationStr || '');
  if (!s) return false;

  const parts = s.split(',').map(clean);
  const N = parts.length;

  // 1) Any Canadian or US postal anywhere in the whole string
  const hasPostal = POSTAL_MATCHERS.some((rx) => rx.test(s));

  // 2) Street-first but too short (addr, city, region, country should be ≥ 4 parts)
  const streetFirstTooShort = looksLikeStreetNumber(parts[0]) && N < 4;

  // 3) Province token is mixed-case 2 letters ("On"), OR province+postal in same token
  //    e.g., parts[1] === "On M5t 2g3"
  const sec = parts[1] || '';
  const twoLetterMixed = /^[A-Za-z]{2}$/.test(sec) && sec !== sec.toUpperCase();
  const provPlusPostal = /^([A-Za-z]{2})\s+[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/i.test(sec);

  return hasPostal || streetFirstTooShort || twoLetterMixed || provPlusPostal;
}

// ---------------- Firestore scan ----------------
async function scan(db, argv) {
  const hasWhere = argv.whereField && argv.whereOp && typeof argv.whereValue !== "undefined";
  if (argv.collectionGroup) {
    let q = db.collectionGroup(argv.collectionGroup);
    if (argv.prefix) {
      q = q.orderBy('location').startAt(argv.prefix).endAt(argv.prefix + '\uf8ff');
    }
    if (hasWhere) q = q.where(argv.whereField, argv.whereOp, argv.whereValue);
    if (argv.limit) q = q.limit(Number(argv.limit));
    console.log(`🔎 collectionGroup("${argv.collectionGroup}")` +
      (argv.prefix ? ` prefix=${JSON.stringify(argv.prefix)}` : '') +
      (hasWhere ? ` where ${argv.whereField} ${argv.whereOp} ${JSON.stringify(argv.whereValue)}` : ''));
    return await q.get();
  } else {
    let q = db.collection(argv.collection);
    if (argv.prefix) {
      q = q.orderBy('location').startAt(argv.prefix).endAt(argv.prefix + '\uf8ff');
    }
    if (hasWhere) q = q.where(argv.whereField, argv.whereOp, argv.whereValue);
    if (argv.limit) q = q.limit(Number(argv.limit));
    console.log(`🔎 collection("${argv.collection}")` +
      (argv.prefix ? ` prefix=${JSON.stringify(argv.prefix)}` : '') +
      (hasWhere ? ` where ${argv.whereField} ${argv.whereOp} ${JSON.stringify(argv.whereValue)}` : ''));
    return await q.get();
  }
}

// ---------------- Main ----------------
async function main() {
  const argv = yargs(hideBin(process.argv))
    .option("collection", { type: "string", describe: "Top-level collection (e.g., dateIdeas)" })
    .option("collectionGroup", { type: "string", describe: "Collection group name (e.g., dateIdeas)" })
    .conflicts("collection", "collectionGroup")
    .option("apply", { type: "boolean", default: false, describe: "Write changes" })
    .option("limit", { type: "number", describe: "Limit scanned docs (debugging)" })
    .option("whereField", { type: "string" })
    .option("whereOp", { type: "string" })
    .option("whereValue", {})
    .option("onlyCountry", { type: "string", describe: "Only rewrite if result ends with this country (e.g., Canada)" })
    .option("prefix", { type: "string", describe: "Order by 'location' and scan by prefix (e.g., 'Toronto, ')" })
    .option("force", { type: "boolean", default: false, describe: "Ignore quick pre-check; try canonicalizing every scanned doc" })
    .option("batchSize", { type: "number", default: 300 })
    .option("credentials", { type: "string", describe: "Path to serviceAccount.json" })
    .option("verbose", { type: "boolean", default: false })
    .demandOption(["collection", "collectionGroup"].filter(Boolean).length ? [] : ["collection"], "Provide --collection or use --collectionGroup")
    .help()
    .strict()
    .parse();

  initFirebase(argv);
  const db = admin.firestore();

  const projectId =
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    admin.app().options.projectId ||
    "(unknown)";

  console.log(`\n🧭 Project="${projectId}" | mode=${argv.apply ? "APPLY" : "DRY-RUN"}\n`);

  const snap = await scan(db, argv);
  console.log(`📄 Fetched ${snap.size} docs`);

  const onlyCountry = argv.onlyCountry ? String(argv.onlyCountry).trim() : null;

  const candidates = [];
  let checked = 0, skipped = 0;

  for (const doc of snap.docs) {
    const data = doc.data() || {};
    const loc = data.location || "";

    checked++;

    if (!argv.force && !looksBroken(loc)) {
      if (argv.verbose) console.log(`   ⏭️  Skip ${doc.ref.path} — looks fine`);
      continue;
    }

    const canon = canonicalizeLocation(loc);
    if (canon.skip || !canon.value) {
      if (argv.verbose) console.log(`   ⏭️  Skip ${doc.ref.path} — ${canon.reason}`);
      skipped++;
      continue;
    }

    if (onlyCountry && !canon.value.endsWith(`, ${onlyCountry}`)) {
      if (argv.verbose) console.log(`   ⏭️  Skip ${doc.ref.path} — outside onlyCountry=${onlyCountry}`);
      skipped++;
      continue;
    }

    if (canon.value !== loc) {
      candidates.push({
        ref: doc.ref,
        oldLocation: loc,
        newLocation: canon.value,
        reason: canon.reason || 'differs',
      });
    } else if (argv.verbose) {
      console.log(`   ⏭️  Skip ${doc.ref.path} — already canonical`);
    }
  }

  if (!candidates.length) {
    console.log("✅ No rewrite candidates found.");
    if (skipped && argv.verbose) console.log(`ℹ️  Skipped ${skipped} docs (safety). Checked=${checked}`);
    return;
  }

  console.log(`\n🩹 Found ${candidates.length} docs needing *location* rewrite.${skipped ? ` (skipped ${skipped})` : ""}`);
  console.log("   Sample (first 10):");
  candidates.slice(0,10).forEach((c, i) => {
    console.log(` ${String(i+1).padStart(2," ")}. ${c.ref.path}`);
    console.log(`     location: "${c.oldLocation}"  →  "${c.newLocation}"`);
    if (c.reason) console.log(`     reason: ${c.reason}`);
  });

  if (!argv.apply) {
    console.log(`\n📝 Dry-run complete. Re-run with --apply to write.`);
    return;
  }

  const batchSize = Math.max(1, Math.min(500, argv.batchSize || 300));
  console.log(`\n🚀 Writing in batches of ${batchSize}…`);
  let written = 0;

  while (written < candidates.length) {
    const batch = db.batch();
    const chunk = candidates.slice(written, written + batchSize);
    for (const c of chunk) {
      batch.update(c.ref, { location: c.newLocation });
    }
    await batch.commit();
    written += chunk.length;
    console.log(`   …updated ${written}/${candidates.length}`);
  }

  console.log(`\n🎉 Done. Updated ${written} docs.`);
}

main().catch((err) => {
  console.error("❌ Failed:", err?.stack || err?.message || String(err));
  process.exit(1);
});
