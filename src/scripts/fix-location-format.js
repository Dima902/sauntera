#!/usr/bin/env node
/**
 * fix-location-format.js (v3)
 *
 * Safer normalization:
 * - Handles street-first formats only when parts >= 4 (addr, city, region, country).
 * - Skips unsafe cases instead of guessing (prevents "Ontario, Canada, Canada").
 * - Never sets region == country; skips when ambiguous.
 * - Verbose mode explains skipped reasons.
 */

const fs = require("fs");
const path = require("path");
const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");
const admin = require("firebase-admin");

// ---------- Firebase init ----------
function initFirebase(argv) {
  if (argv.credentials) {
    const p = path.resolve(process.cwd(), argv.credentials);
    const raw = fs.readFileSync(p, "utf8");
    const json = JSON.parse(raw);
    console.log(`🔐 Using credentials: ${p}`);
    console.log(`   project_id: ${json.project_id}`);
    admin.initializeApp({ credential: admin.credential.cert(json), projectId: json.project_id });
  } else if (!admin.apps.length) {
    admin.initializeApp(); // uses GOOGLE_APPLICATION_CREDENTIALS if present
  }
}

// ---------- Helpers: location normalization ----------
const PROVINCES_CA = {
  ab: "Alberta", bc: "British Columbia", mb: "Manitoba", nb: "New Brunswick",
  nl: "Newfoundland and Labrador", ns: "Nova Scotia", nt: "Northwest Territories",
  nu: "Nunavut", on: "Ontario", pe: "Prince Edward Island", qc: "Quebec",
  sk: "Saskatchewan", yt: "Yukon",
};
const STATES_US = {
  al:"Alabama", ak:"Alaska", az:"Arizona", ar:"Arkansas", ca:"California", co:"Colorado",
  ct:"Connecticut", de:"Delaware", fl:"Florida", ga:"Georgia", hi:"Hawaii", id:"Idaho",
  il:"Illinois", in:"Indiana", ia:"Iowa", ks:"Kansas", ky:"Kentucky", la:"Louisiana",
  me:"Maine", md:"Maryland", ma:"Massachusetts", mi:"Michigan", mn:"Minnesota",
  ms:"Mississippi", mo:"Missouri", mt:"Montana", ne:"Nebraska", nv:"Nevada",
  nh:"New Hampshire", nj:"New Jersey", nm:"New Mexico", ny:"New York",
  nc:"North Carolina", nd:"North Dakota", oh:"Ohio", ok:"Oklahoma", or:"Oregon",
  pa:"Pennsylvania", ri:"Rhode Island", sc:"South Carolina", sd:"South Dakota",
  tn:"Tennessee", tx:"Texas", ut:"Utah", vt:"Vermont", va:"Virginia",
  wa:"Washington", wv:"West Virginia", wi:"Wisconsin", wy:"Wyoming",
};

const COUNTRY_ALIASES = {
  uk: 'United Kingdom',
  'u.k.': 'United Kingdom',
  'u.k': 'United Kingdom',
  britain: 'United Kingdom',
  england: 'United Kingdom',
  scotland: 'United Kingdom',
  wales: 'United Kingdom',
  'northern ireland': 'United Kingdom',

  usa: 'United States',
  'u.s.a.': 'United States',
  'u.s.a': 'United States',
  us: 'United States',
  'u.s.': 'United States',
  'u.s': 'United States',
};

const KNOWN_COUNTRIES = new Set([
  'Canada', 'United States', 'United Kingdom', 'France', 'Germany', 'Italy', 'Spain',
  'Portugal', 'Netherlands', 'Belgium', 'Switzerland', 'Austria', 'Ireland',
  'Australia', 'New Zealand', 'Mexico', 'Brazil', 'Argentina', 'Japan', 'South Korea',
  'China', 'India', 'Singapore', 'United Arab Emirates', 'Saudi Arabia', 'Turkey',
  'Greece', 'Sweden', 'Norway', 'Denmark', 'Finland', 'Poland', 'Czechia', 'Hungary',
  'Romania',
]);

const POSTAL_MATCHERS = [
  /\b[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d\b/i,     // Canadian postal (e.g., M6H 1A4)
  /\b\d{5}(-\d{4})?\b/,                           // US ZIP or ZIP+4
];

const clean = (s) => (s || "").replace(/\s+/g, " ").trim();

function stripPostalAndUnits(chunk) {
  let x = chunk || "";
  for (const rx of POSTAL_MATCHERS) x = x.replace(rx, "").trim();
  x = x.replace(/\b(apt|unit|suite|#)\s*\S+$/i, "").trim();
  return x;
}

function titleCase(s) {
  return (s || "").toLowerCase().replace(/\b\w+/g, (w) => w[0].toUpperCase() + w.slice(1));
}

function detectCountry(parts) {
  const last = clean(parts[parts.length - 1] || '');
  if (!last) return null;

  const lastTC = titleCase(last);
  if (KNOWN_COUNTRIES.has(lastTC)) return lastTC;

  const key = last.replace(/[^a-z. ]/gi, '').toLowerCase();
  if (COUNTRY_ALIASES[key]) return COUNTRY_ALIASES[key];

  const regionRaw = clean(parts[1] || '');
  const regionKey = regionRaw.replace(/[^a-z]/gi, '').toLowerCase();
  if (PROVINCES_CA[regionKey]) return 'Canada';
  if (STATES_US[regionKey]) return 'United States';

  return null;
}

function normalizeRegion(raw, countryHint) {
  const key = (raw || "").replace(/[^a-z]/gi, "").toLowerCase();
  if (countryHint === "Canada" && PROVINCES_CA[key]) return PROVINCES_CA[key];
  if (countryHint === "United States" && STATES_US[key]) return STATES_US[key];
  return titleCase(stripPostalAndUnits(raw));
}

function looksLikeStreetNumber(s) {
  return /^\d+(\s|$)/.test((s || '').trim());
}

/**
 * Normalize location strings into canonical "City, Region, Country".
 * Returns { locationBase, locationCanonical, reason, misaligned, countryDetected, skipReason? }
 */
function normalizeLocationFields(locationRaw) {
  const original = clean(locationRaw);
  if (!original) {
    return { locationBase: null, locationCanonical: null, reason: "empty", countryDetected: null, misaligned: true, skipReason: "empty" };
  }

  const partsRaw = original.split(",").map(s => clean(s));
  const partsNoPostal = partsRaw.map(stripPostalAndUnits);
  const N = partsNoPostal.length;

  // Country detection first (based on last chunk/aliases)
  const countryDetected = detectCountry(partsNoPostal); // may be null

  // Heuristic path A: street-first format
  if (looksLikeStreetNumber(partsNoPostal[0])) {
    // Expect: [address], city, region, country  (>= 4 chunks)
    if (N < 4) {
      return {
        locationBase: null,
        locationCanonical: null,
        reason: "streetFirstTooShort",
        countryDetected,
        misaligned: true,
        skipReason: "insufficientGranularity(street-first,<4 parts)",
      };
    }
    const cityCandidate = partsNoPostal[1];
    const regionCandidate = partsNoPostal[2];
    const country = countryDetected || titleCase(partsNoPostal[N - 1]);

    const city = titleCase(cityCandidate || "");
    const regionFull = normalizeRegion(regionCandidate, country);

    // Guard: region must not equal country
    if (regionFull === country) {
      return {
        locationBase: null,
        locationCanonical: null,
        reason: "regionEqualsCountry",
        countryDetected,
        misaligned: true,
        skipReason: "regionEqualsCountry(street-first)",
      };
    }

    const canonical = [city, regionFull, country].filter(Boolean).join(", ");
    const hadPostal = POSTAL_MATCHERS.some(rx => rx.test(original));
    const extraSegments = (N > 4); // extra beyond [addr, city, region, country] is fine but we still normalize
    const caseMismatch = original.toLowerCase() !== canonical.toLowerCase();

    return {
      locationBase: canonical,
      locationCanonical: canonical,
      reason: [
        hadPostal ? "postal" : null,
        extraSegments ? "extraSegments" : null,
        caseMismatch ? "caseMismatch" : null,
        !countryDetected ? "countryUnknown" : null,
      ].filter(Boolean).join("|"),
      misaligned: hadPostal || extraSegments || caseMismatch || !countryDetected,
      countryDetected,
    };
  }

  // Heuristic path B: city-first format (City, Region, Country)
  const cityCandidate = partsNoPostal[0] || "";
  const regionCandidate = partsNoPostal[1] || "";
  const city = titleCase(cityCandidate);
  const regionFull = normalizeRegion(regionCandidate, countryDetected || undefined);

  // If we know the country, use it; otherwise produce "City, Region" only and mark as unknown
  if (countryDetected) {
    if (regionFull === countryDetected) {
      return {
        locationBase: null,
        locationCanonical: null,
        reason: "regionEqualsCountry",
        countryDetected,
        misaligned: true,
        skipReason: "regionEqualsCountry(city-first)",
      };
    }
    const canonical = [city, regionFull, countryDetected].filter(Boolean).join(", ");

    const hadPostal = POSTAL_MATCHERS.some(rx => rx.test(original));
    const extraSegments = (N > 3);
    const caseMismatch =
      original.toLowerCase().includes(", on ") || // common pitfall
      original.toLowerCase() !== canonical.toLowerCase();

    return {
      locationBase: canonical,
      locationCanonical: canonical,
      reason: [
        hadPostal ? "postal" : null,
        extraSegments ? "extraSegments" : null,
        caseMismatch ? "caseMismatch" : null,
      ].filter(Boolean).join("|"),
      misaligned: hadPostal || extraSegments || caseMismatch,
      countryDetected,
    };
  } else {
    // Country unknown → cannot safely produce City, Region, Country
    const canonical = [titleCase(cityCandidate), titleCase(regionCandidate)].filter(Boolean).join(", ");
    const hadPostal = POSTAL_MATCHERS.some(rx => rx.test(original));
    const extraSegments = (N > 3);
    const caseMismatch = original.toLowerCase() !== canonical.toLowerCase();

    return {
      locationBase: canonical,              // no country appended
      locationCanonical: canonical,
      reason: [
        hadPostal ? "postal" : null,
        extraSegments ? "extraSegments" : null,
        caseMismatch ? "caseMismatch" : null,
        "countryUnknown",
      ].filter(Boolean).join("|"),
      misaligned: true,
      countryDetected: null,
      skipReason: "countryUnknown",
    };
  }
}

// ---------- Scan ----------
async function scan(db, argv) {
  const hasWhere = argv.whereField && argv.whereOp && typeof argv.whereValue !== "undefined";
  if (argv.collectionGroup) {
    let q = db.collectionGroup(argv.collectionGroup);
    if (hasWhere) q = q.where(argv.whereField, argv.whereOp, argv.whereValue);
    if (argv.limit) q = q.limit(Number(argv.limit));
    console.log(`🔎 collectionGroup("${argv.collectionGroup}")${hasWhere ? ` where ${argv.whereField} ${argv.whereOp} ${JSON.stringify(argv.whereValue)}` : ""}`);
    return await q.get();
  } else {
    let q = db.collection(argv.collection);
    if (hasWhere) q = q.where(argv.whereField, argv.whereOp, argv.whereValue);
    if (argv.limit) q = q.limit(Number(argv.limit));
    console.log(`🔎 collection("${argv.collection}")${hasWhere ? ` where ${argv.whereField} ${argv.whereOp} ${JSON.stringify(argv.whereValue)}` : ""}`);
    return await q.get();
  }
}

// ---------- Main ----------
async function main() {
  const argv = yargs(hideBin(process.argv))
    .option("collection", { type: "string", describe: "Top-level collection (e.g., dateIdeas)" })
    .option("collectionGroup", { type: "string", describe: "Collection group name (e.g., dateIdeas)" })
    .conflicts("collection", "collectionGroup")
    .option("apply", { type: "boolean", default: false, describe: "Write changes" })
    .option("rewriteLocation", { type: "boolean", default: false, describe: "Also rewrite 'location' to canonical" })
    .option("limit", { type: "number", describe: "Limit documents scanned (debugging)" })
    .option("whereField", { type: "string" })
    .option("whereOp", { type: "string" })
    .option("whereValue", {})
    .option("assumeCountry", { type: "string", describe: "Fallback country ONLY when unknown (e.g., Canada)" })
    .option("onlyCountry", { type: "string", describe: "Only update docs clearly belonging to this country" })
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

  console.log(`\n🧭 Project="${projectId}" | mode=${argv.apply ? "APPLY" : "DRY-RUN"}${argv.rewriteLocation ? " + rewriteLocation" : ""}\n`);

  const snap = await scan(db, argv);
  console.log(`📄 Fetched ${snap.size} docs`);

  const onlyCountry = argv.onlyCountry ? titleCase(argv.onlyCountry) : null;
  const assumeCountry = argv.assumeCountry ? titleCase(argv.assumeCountry) : null;

  const candidates = [];
  let skipped = 0;

  for (const doc of snap.docs) {
    const d = doc.data() || {};
    const loc = d.location || "";
    let {
      locationBase, locationCanonical, reason, misaligned, countryDetected, skipReason
    } = normalizeLocationFields(loc);

    if (!locationBase) {
      if (argv.verbose) console.log(`   ⏭️  Skip ${doc.ref.path} — ${skipReason || "noBase"}`);
      skipped++;
      continue;
    }

    // Filter by onlyCountry
    if (onlyCountry && titleCase(countryDetected || "") !== onlyCountry) {
      if (argv.verbose) console.log(`   ⏭️  Skip ${doc.ref.path} — outside onlyCountry=${onlyCountry}`);
      skipped++;
      continue;
    }

    // If country is unknown but user provided assumeCountry, reconstruct if safe
    if (!countryDetected && assumeCountry) {
      const parts = locationCanonical.split(",").map(clean).filter(Boolean);
      if (parts.length >= 2) {
        locationCanonical = `${parts[0]}, ${parts[1]}, ${assumeCountry}`;
        locationBase = locationCanonical;
        reason = reason ? `${reason}|assumedCountry` : "assumedCountry";
        misaligned = true;
      } else {
        if (argv.verbose) console.log(`   ⏭️  Skip ${doc.ref.path} — cannot infer with assumeCountry (need City+Region)`);
        skipped++;
        continue;
      }
    }

    // Extra guard: avoid Region == Country results
    const partsCanon = locationCanonical.split(",").map(clean);
    if (partsCanon.length >= 3 && partsCanon[1] === partsCanon[2]) {
      if (argv.verbose) console.log(`   ⏭️  Skip ${doc.ref.path} — region==country after normalization`);
      skipped++;
      continue;
    }

    const needsBase = d.locationBase !== locationBase;
    const needsRewrite = argv.rewriteLocation && d.location !== locationCanonical;

    if (needsBase || needsRewrite) {
      candidates.push({
        ref: doc.ref,
        id: doc.id,
        oldLocation: d.location || "",
        newLocation: locationCanonical,
        oldBase: d.locationBase || "",
        newBase: locationBase,
        reason: reason || (needsBase || needsRewrite ? "differs" : ""),
      });
    }
  }

  if (!candidates.length) {
    console.log("✅ No misaligned locations detected (nothing to update).");
    if (skipped && argv.verbose) console.log(`ℹ️  Skipped ${skipped} docs for safety.`);
    return;
  }

  console.log(`\n🩹 Found ${candidates.length} docs needing updates.${skipped ? ` (skipped ${skipped} unsafe cases)` : ""}`);
  console.log("   Sample (first 10):");
  candidates.slice(0,10).forEach((c, i) => {
    console.log(` ${String(i+1).padStart(2," ")}. ${c.ref.path}`);
    console.log(`     location:      "${c.oldLocation}"  →  "${c.newLocation}"`);
    console.log(`     locationBase:  "${c.oldBase}"      →  "${c.newBase}"`);
    if (c.reason) console.log(`     reason: ${c.reason}`);
  });

  if (!argv.apply) {
    console.log(`\n📝 Dry-run complete. Re-run with --apply to write.${argv.rewriteLocation ? " (--rewriteLocation will also rewrite 'location')" : ""}`);
    return;
  }

  // Apply in batches
  const batchSize = Math.max(1, Math.min(500, argv.batchSize || 300));
  console.log(`\n🚀 Writing in batches of ${batchSize}…`);
  let written = 0;
  while (written < candidates.length) {
    const batch = db.batch();
    const chunk = candidates.slice(written, written + batchSize);
    for (const c of chunk) {
      const payload = { locationBase: c.newBase };
      if (argv.rewriteLocation) payload.location = c.newLocation;
      batch.update(c.ref, payload);
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
