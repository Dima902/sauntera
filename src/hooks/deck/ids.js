// FILE: src/hooks/deck/ids.js
// Stable IDs + validity + dedupe helpers

// Normalize to a single string id (fallback-safe)
export function normalizeId(it, fallbackIndex = 0) {
  const raw =
    (it && (it.id ?? it.place_id ?? it.docId ?? it.key)) ??
    `item-${fallbackIndex}`;
  return String(raw);
}

// Ensure each item has a stable .id and .key for React keys
export function attachStableId(list) {
  if (!Array.isArray(list)) return [];
  for (let i = 0; i < list.length; i++) {
    const it = list[i];
    if (!it) continue;
    if (it.id == null) it.id = normalizeId(it, i);
    if (it.key == null) it.key = String(it.id);
  }
  return list;
}

// Dedupe by id while preserving original object references
export function dedupeByIdPreserveRefs(list) {
  const seen = new Set();
  const out = [];
  for (const it of list) {
    const id = normalizeId(it);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    if (it && it.key == null) it.key = id; // keep React key aligned
    out.push(it);
  }
  return out;
}

// Dedupe by id, returning a new array (not preserving original positions for dupes)
export function dedupeArrayById(list) {
  const seen = new Set();
  const out = [];
  for (const it of list || []) {
    const id = normalizeId(it);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    if (it && it.key == null) it.key = id; // keep React key aligned
    out.push(it);
  }
  return out;
}

// Guard used to prevent "blank/no-title" cards
export function isValidIdea(it) {
  if (!it || typeof it !== "object") return false;
  const hasId = !!(it.id ?? it.place_id ?? it.docId ?? it.key);
  const hasAnyText = !!(it.title ?? it.name ?? it.venue_name ?? it.place_name);
  return hasId && hasAnyText;
}
