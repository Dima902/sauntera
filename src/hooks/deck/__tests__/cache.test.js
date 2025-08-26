// FILE: src/hooks/deck/__tests__/cache.test.js
import { deckCacheKey } from "../../hooks/deck/cache";

test("deckCacheKey stable format", () => {
  const k = deckCacheKey({ userId: "u1", deckType: "main", dateStr: "2025-08-19" });
  expect(k).toBe("deckCache:u1:main:2025-08-19");
});