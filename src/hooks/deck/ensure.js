// FILE: src/hooks/deck/ensure.js
import { Stopwatch } from "./time";
import {
  REFRESH_INTERVAL_MS,
  MAX_BACKOFF_MS,
  BACKEND_ATTEMPT_TTL_MS,
  BACKEND_POST_WAIT_MS,
} from "./config";

// In-memory guard against hammering the backend within a session.
// Keyed by deckType|locKey|filterHash|date
const backendAttemptMap = new Map();

/**
 * Ensurer: keeps decks populated up to target thresholds.
 * Adds a first-class backend trigger when Firestore is empty/below min.
 */
export function makeEnsurer({
  deckType,
  targets,
  isFiltered,
  // for backend trigger context:
  normalizedLocation,
  effectiveLocation,
  coords,
  effectiveFiltersObj,
  todayStr,
  // loaders and helpers:
  nearbyCitiesRef,
  loadFromFirestore,
  pushNextBatch,
  safeSetIdeasSWR,
  ensureIdeasFromNearbyOrWide,
}) {

  const locKey = normalizedLocation || effectiveLocation || "";
  const filterHash = JSON.stringify(effectiveFiltersObj || { "Advanced Filters": [], "Quick Filters": [] });

  const attemptKey = `${deckType}|${locKey}|${filterHash}|${todayStr}`;
  const hasFreshAttempt = () => {
    const ts = backendAttemptMap.get(attemptKey);
    if (!ts) return false;
    return (Date.now() - ts) < BACKEND_ATTEMPT_TTL_MS;
  };
  const markAttempt = () => backendAttemptMap.set(attemptKey, Date.now());

  async function maybeTriggerBackend({ fsCount, targetMin }) {
    // Decide whether to fire backend:
    // - Always fire if fsCount === 0 (brand-new city)
    // - Or if fsCount < targetMin, and we haven't attempted recently
    if ((fsCount === 0 || fsCount < targetMin) && !hasFreshAttempt()) {
      markAttempt();

      const nearby = Array.isArray(nearbyCitiesRef?.current) ? (nearbyCitiesRef.current) : [];
      const includeRestaurants = deckType === "restaurant";

      // Build a light "query" string for backend context (optional).
      // You can swap this for your own inferQueryFromFilters() if you prefer.
      const adv = (effectiveFiltersObj?.["Advanced Filters"] || []).join(", ");
      const quick = (effectiveFiltersObj?.["Quick Filters"] || []).join(", ");
      const queryStr = [adv, quick].filter(Boolean).join(" | ");

      // Fire the single-shot backend fetch (non-blocking for UI).
      // ensureIdeasFromNearbyOrWide returns ideas, but we rely on the post-write reload.
      try {
        // eslint-disable-next-line no-console
        console.log("🚨 Backend trigger:", {
          reason: fsCount === 0 ? "zeroFS" : "belowMin",
          deckType, locKey, targetMin, fsCount,
        });

        await ensureIdeasFromNearbyOrWide({
          coords,
          city: locKey,
          filters: effectiveFiltersObj || {},
          minCount: targetMin,
          expandRadius: true,
          forceNearby: false,
          queryStr,
          nearbyCities: nearby,
          deckType,
          includeRestaurants,
        });

        // Short delayed re-check to surface first batch quickly
        setTimeout(async () => {
          const { sessionPool, totalFirestoreCount } = await loadFromFirestore({
            preserveOnEmpty: true,
            primaryOnly: true,
          });
          if (targets.type === "premium") {
            if (sessionPool.length > 0) safeSetIdeasSWR(sessionPool.slice());
          } else {
            if (sessionPool.length > 0) pushNextBatch();
          }
          // eslint-disable-next-line no-console
          console.log("✅ Backend write complete: recheck FS", {
            seen: totalFirestoreCount,
          });
        }, BACKEND_POST_WAIT_MS);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("Backend trigger failed:", err?.message || err);
      }
    }
  }

  async function ensureTargetPopulation(currentCount /* bootToken kept for parity */) {
    const sw = new Stopwatch(
      `${deckType}:${targets.type}:${isFiltered ? "filtered" : "unfiltered"}`
    );
    const isPremiumTier = targets.type === "premium";
    const targetMin = isPremiumTier ? targets.min : targets.limit;

    // Already satisfied
    if (currentCount >= targetMin) {
      sw.end("enough already", { currentCount, targetMin });
      return;
    }

    // 1) Re-check Firestore (primary city; preserve on empty)
    const { sessionPool, totalFirestoreCount } = await loadFromFirestore({
      preserveOnEmpty: true,
    });
    sw.mark("recheck fs", { totalFirestoreCount });

    // Opportunistically update the UI if we found something on premium
    if (isPremiumTier && sessionPool.length > 0) {
      safeSetIdeasSWR(sessionPool.slice());
    }

    if (totalFirestoreCount >= targetMin) {
      sw.end("target reached after fs", { totalFirestoreCount });
      return;
    }

    // 1.5) Backend trigger path — if FS is empty or below target, fire once
    await maybeTriggerBackend({ fsCount: totalFirestoreCount, targetMin });

    // 2) Adaptive refresh with backoff (primary-only)
    let ticks = 0;
    let backoffMs = REFRESH_INTERVAL_MS;
    const MAX_REFRESH_TICKS = 10;
    const MAX_TICKS_PREMIUM_FILTERED = 3;

    // Stable hash to detect changes
    const idsHash = (list) =>
      (Array.isArray(list) ? list : [])
        .map((x) => String(x?.id || x?.docId || x?.place_id || ""))
        .filter(Boolean)
        .sort()
        .join("|");

    let lastHash = "";
    let stableNoChange = 0;

    const runOnce = async () => {
      ticks += 1;
      const { sessionPool: loopPool, totalFirestoreCount: fsCount } =
        await loadFromFirestore({
          preserveOnEmpty: true,
          primaryOnly: true,
        });

      const incomingHash = idsHash(loopPool);
      const changed = incomingHash !== lastHash;
      const unchanged = !changed;

      sw.mark("refresh tick", { ticks, fsCount, session: loopPool.length });

      const isPremiumTierLocal = targets.type === "premium";
      const targetMinLocal = isPremiumTierLocal ? targets.min : targets.limit;

      if (isPremiumTierLocal) {
        if (changed && loopPool.length > 0) {
          safeSetIdeasSWR(loopPool.slice());
        }
      } else {
        if (changed) {
          pushNextBatch();
        }
      }

      const satisfied = fsCount >= targetMinLocal;

      if (
        satisfied ||
        (isPremiumTierLocal && isFiltered && ticks >= MAX_TICKS_PREMIUM_FILTERED) ||
        (unchanged && ++stableNoChange >= 4) ||
        ticks >= MAX_REFRESH_TICKS
      ) {
        sw.end("target reached or stop");
        return;
      }

      // If still below min and no new data is coming in, try a single backend trigger again
      // (this won't hammer due to the attempt guard).
      if (!satisfied) {
        await maybeTriggerBackend({ fsCount, targetMin: targetMinLocal });
      }

      if (unchanged) {
        backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
      } else {
        stableNoChange = 0;
        backoffMs = REFRESH_INTERVAL_MS;
        lastHash = incomingHash;
      }

      setTimeout(runOnce, backoffMs);
    };

    setTimeout(runOnce, backoffMs);
  }

  return { ensureTargetPopulation };
}
