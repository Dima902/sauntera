// FILE: src/hooks/deck/__tests__/filters.test.js
import { applyLocalFilters } from "../../hooks/deck/filters";

test("applyLocalFilters filters out restaurant acts for main deck", () => {
  const list = [
    { id: "1", activity: "dinner" },
    { id: "2", activity: "livejazz" },
  ];
  const out = applyLocalFilters({ list, deckType: "main", includeRestaurants: false, isStrictJazz: false, reducedFiltersObj: { "Advanced Filters": [], "Quick Filters": [] } });
  expect(out.map(x => x.id)).toEqual(["2"]);
});

test("applyLocalFilters strict jazz keeps only livejazz", () => {
  const list = [
    { id: "1", activity: "dinner" },
    { id: "2", activity: "livejazz" },
    { id: "3", activity: "museum" },
  ];
  const out = applyLocalFilters({ list, deckType: "main", includeRestaurants: false, isStrictJazz: true, reducedFiltersObj: { "Advanced Filters": [], "Quick Filters": [] } });
  expect(out.map(x => x.id)).toEqual(["2"]);
});