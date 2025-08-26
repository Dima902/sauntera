// FILE: src/hooks/deck/__tests__/ids.test.js
// Minimal Jest tests to ensure helpers behave (optional but recommended)
import { dedupeArrayById, attachStableId, isValidIdea } from "../../hooks/deck/ids";

test("attachStableId adds ids when missing", () => {
  const arr = [{ title: "A" }, { id: "x", title: "B" }];
  const out = attachStableId(arr.slice());
  expect(out[0].id).toMatch(/^item-/);
  expect(out[1].id).toBe("x");
});

test("dedupeArrayById removes duplicates by id", () => {
  const arr = [{ id: "1", title: "A" }, { id: "1", title: "A2" }, { id: "2", title: "B" }];
  const out = dedupeArrayById(arr);
  expect(out.length).toBe(2);
  expect(out.map(x => x.id)).toEqual(["1", "2"]);
});

test("isValidIdea requires id and some text", () => {
  expect(isValidIdea({ id: "1", title: "Cafe" })).toBe(true);
  expect(isValidIdea({ id: "2" })).toBe(false);
  expect(isValidIdea(null)).toBe(false);
});