import { describe, expect, it } from "vitest";
import { describeSetup, EMPTY_COACHING, normalizeCoaching, showsRpe } from "./coachingProfile";

describe("normalizeCoaching", () => {
  it("returns an empty profile for junk", () => {
    expect(normalizeCoaching(null)).toEqual(EMPTY_COACHING);
    expect(normalizeCoaching("x")).toEqual(EMPTY_COACHING);
  });

  it("clamps numbers and drops unknown enums", () => {
    const c = normalizeCoaching({ daysPerWeek: 12, sessionMinutes: 3, equipment: "spaceship", rpe: "maybe" });
    expect(c.daysPerWeek).toBe(7);
    expect(c.sessionMinutes).toBe(15);
    expect(c.equipment).toBeNull();
    expect(c.rpe).toBeNull();
    expect(normalizeCoaching({ daysPerWeek: Number.NaN }).daysPerWeek).toBeNull();
  });

  it("dedupes and sorts training days, ignoring invalid ones", () => {
    expect(normalizeCoaching({ trainingDays: [5, 1, 1, 9, -1, 2.5, "3"] }).trainingDays).toEqual([1, 5]);
  });

  it("trims and bounds free text, stripping control characters", () => {
    const c = normalizeCoaching({ limitations: "  left knee\u0007 pain  ", coachNotes: "x".repeat(5000) });
    expect(c.limitations).toBe("left knee  pain");
    expect(c.coachNotes).toHaveLength(1000);
    expect(normalizeCoaching({ limitations: "   " }).limitations).toBeNull();
  });
});

describe("describeSetup", () => {
  it("only mentions what was given", () => {
    expect(describeSetup(EMPTY_COACHING)).toBeNull();
    expect(
      describeSetup({ ...EMPTY_COACHING, daysPerWeek: 3, trainingDays: [1, 3, 5], sessionMinutes: 45, equipment: "gym", rpe: "sometimes" })
    ).toBe("3 days/week, usually Mon/Wed/Fri, ~45 min sessions, equipment: full gym, logs RPE sometimes");
  });
});

describe("showsRpe", () => {
  it("hides the picker only when the user opted out", () => {
    expect(showsRpe(null)).toBe(true);
    expect(showsRpe({ rpe: "sometimes" })).toBe(true);
    expect(showsRpe({ rpe: "never" })).toBe(false);
  });
});
