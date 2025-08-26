// FILE: src/hooks/deck/__tests__/time.test.js
import { todayYMD } from "../../hooks/deck/time";

test("todayYMD format YYYY-MM-DD", () => {
  const s = todayYMD();
  expect(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(s)).toBe(true);
});