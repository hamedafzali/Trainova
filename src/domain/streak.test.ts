import { describe, expect, it } from "vitest";
import { startOfWeek, weekDays, weekStreak } from "./streak";

// Wednesday 2026-10-07
const today = new Date(2026, 9, 7, 12);

describe("streak", () => {
  it("weeks start on Monday", () => {
    expect(startOfWeek(today).getDate()).toBe(5);
    expect(weekDays(today)[0]).toBe("2026-10-05");
    expect(weekDays(today)[6]).toBe("2026-10-11");
  });

  it("counts consecutive trained weeks", () => {
    const days = new Set(["2026-10-06", "2026-10-01", "2026-09-22"]);
    expect(weekStreak(days, today)).toBe(3);
  });

  it("an untrained current week doesn't break the streak yet", () => {
    const days = new Set(["2026-10-01", "2026-09-22"]);
    expect(weekStreak(days, today)).toBe(2);
  });

  it("a gap week ends it", () => {
    const days = new Set(["2026-10-06", "2026-09-22"]);
    expect(weekStreak(days, today)).toBe(1);
    expect(weekStreak(new Set(), today)).toBe(0);
  });
});
