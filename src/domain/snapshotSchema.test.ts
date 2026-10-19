import { describe, expect, it } from "vitest";
import { validateSnapshot } from "./snapshotSchema";

describe("validateSnapshot", () => {
  it("accepts a normal document, including assisted (negative) weights", () => {
    expect(
      validateSnapshot({
        units: "kg",
        profile: { goal: "strength" },
        sets: [{ id: "3f1c-uuid", actualWeight: -20, actualReps: 8, rpe: null }],
        prs: [{ exerciseId: "bench", kind: "e1rm", value: 120 }],
        bodyLog: [{ id: "b1", weightKg: 82.5 }],
        tombstones: [{ id: "x", at: "2026-01-01" }],
      })
    ).toEqual([]);
  });

  it("rejects wrong shapes and implausible numbers with a path", () => {
    const issues = validateSnapshot({
      units: "stone",
      sets: [{ id: "ok", actualWeight: 2000 }, { id: "bad id with spaces" }, "nope"],
      bodyLog: [{ id: "b", weightKg: 5 }],
      templates: {},
    });
    const paths = issues.map((i) => i.path);
    expect(paths).toEqual(
      expect.arrayContaining(["units", "sets[0].actualWeight", "sets[1].id", "sets[2]", "bodyLog[0].weightKg", "templates"])
    );
  });

  it("rejects non-objects and caps the issue list", () => {
    expect(validateSnapshot(null)).toHaveLength(1);
    expect(validateSnapshot({ sets: Array.from({ length: 100 }, () => ({})) }).length).toBeLessThanOrEqual(20);
  });
});

describe("coaching profile validation", () => {
  it("accepts a valid profile and rejects out-of-range values", () => {
    expect(validateSnapshot({ profile: { coaching: { daysPerWeek: 3, sessionMinutes: 45, limitations: "knee" } } })).toEqual([]);
    const issues = validateSnapshot({ profile: { coaching: { daysPerWeek: 9, coachNotes: "x".repeat(3000) } } });
    expect(issues.map((i) => i.path)).toEqual(["profile.coaching.daysPerWeek", "profile.coaching.coachNotes"]);
  });
});

describe("validateSnapshot: check-ins and nutrition settings", () => {
  it("accepts valid check-ins and boolean nutrition flags", () => {
    expect(
      validateSnapshot({
        profile: { nutrition: { optOut: false, pregnancy: true } },
        checkIns: [{ id: "c1", date: "2026-10-18", sleep: 1, energy: 5, soreness: 3, stress: 2 }],
      })
    ).toEqual([]);
  });

  it("rejects out-of-scale check-ins and non-boolean flags", () => {
    const paths = validateSnapshot({
      profile: { nutrition: { medical: "yes" } },
      checkIns: [{ id: "c1", date: "2026-10-18", sleep: 6, energy: 2.5, soreness: 0, stress: 3 }],
    }).map((i) => i.path);
    expect(paths).toEqual(expect.arrayContaining(["checkIns[0].sleep", "checkIns[0].energy", "checkIns[0].soreness"]));
    expect(paths.some((p) => p.startsWith("profile.nutrition"))).toBe(true);
  });
});
