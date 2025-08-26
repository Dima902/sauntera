// src/utils/ideasListUtils.js
import { useMemo } from "react";

/** Sentinels */
export const isLoadingItem = (x) => x?.type === "loading-more";
export const isLimitReachedItem = (x) => x?.type === "limit-reached";
export const isSentinel = (x) => isLoadingItem(x) || isLimitReachedItem(x);

/** IDs + validity */
export const normalizeId = (it, idx = 0) =>
  it?.id ??
  it?.placeId ??
  it?.place_id ??
  it?.docId ??
  it?.key ??
  `item-${idx}`;

export const isValidIdea = (it) => {
  if (!it || typeof it !== "object") return false;
  const hasId = !!(it.id ?? it.placeId ?? it.place_id ?? it.docId ?? it.key);
  const hasText = !!(it.title ?? it.name ?? it.venue_name ?? it.place_name);
  return hasId && hasText;
};

/** De-dupe by normalized id, preserving first occurrence refs */
export const dedupeById = (list = []) => {
  const seen = new Set();
  const out = [];
  for (let i = 0; i < list.length; i++) {
    const it = list[i];
    const id = normalizeId(it, i);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(it);
  }
  return out;
};

/**
 * Hook: ensure unique, valid ideas (memoized)
 * Accepts an array (possibly with sentinels), returns a cleaned array.
 */
export function useUniqueIdeas(input) {
  return useMemo(() => {
    const src = Array.isArray(input) ? input : [];
    const cleaned = src.filter((x) => !isSentinel(x) && isValidIdea(x));
    return dedupeById(cleaned);
  }, [input]);
}

/** Default export to support `import utils from ...` style */
export default {
  isLoadingItem,
  isLimitReachedItem,
  isSentinel,
  normalizeId,
  isValidIdea,
  dedupeById,
  useUniqueIdeas,
};
