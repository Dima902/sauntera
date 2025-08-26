// FILE: src/hooks/deck/nearby.js
import { Stopwatch } from "./time";
import { log, warn } from "./config";
import { getNearbyCitiesCached } from "./cache";
import { normalizeLocationString } from "../../utils/locationNormalize";

export const uniqStrings = (arr) => {
  const seen = new Set(); const out = [];
  for (const s of arr) { const k = String(s || "").trim(); if (!k) continue; const lower = k.toLowerCase(); if (!seen.has(lower)) { seen.add(lower); out.push(k); } }
  return out;
};

export async function computeNearbyCities({ deckType, targetsType, isFiltered, coords, effectiveLocation, normalizedLocation, fetchNearbyCitiesFromOffsets }) {
  const sw = new Stopwatch(`${deckType}:${targetsType}:${isFiltered ? "filtered" : "unfiltered"}`);
  sw.mark("nearby start");
  try {
    const lat = coords?.lat ?? coords?.latitude; const lon = coords?.lon ?? coords?.longitude;
    const normalizedPrimary = normalizedLocation || effectiveLocation;
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      const list = await getNearbyCitiesCached(lat, lon, fetchNearbyCitiesFromOffsets);
      const arr = uniqStrings([normalizedPrimary, ...(Array.isArray(list) ? list : [])]).filter(Boolean).map((c) => normalizeLocationString(c).string);
      sw.end("nearby ready", { count: arr?.length || 0 });
      log("Cached offset cities", { lat, lon, arr });
      return arr;
    }
    const primaryOnly = uniqStrings([normalizedPrimary]).filter(Boolean).map((c) => normalizeLocationString(c).string);
    sw.end("nearby primary-only");
    return primaryOnly;
  } catch (e) {
    const primaryOnly = uniqStrings([normalizedLocation || effectiveLocation]).filter(Boolean).map((c) => normalizeLocationString(c).string);
    sw.end("nearby fallback primary-only"); warn("Nearby compute failed; using primary only:", e?.message || e);
    return primaryOnly;
  }
}
