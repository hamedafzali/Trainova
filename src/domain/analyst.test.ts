import { describe, expect, it } from "vitest";
import {
  buildAnalystEvidence,
  ruleInterpretation,
  unsupportedNumbers,
  validateInterpretation,
  type AnalystInput,
} from "./analyst";
import type { Exercise, WorkoutSession, WorkoutSet } from "./types";

const TODAY = "2026-08-28"; // a Friday

function ex(id: string, name: string, primaryMuscle: string, extra: Partial<Exercise> = {}): Exercise {
  return { id, owner: null, name, defaultDeviceId: null, isCompound: true, primaryMuscle, ...extra };
}

/** Builds a log: each workout is a date plus [exerciseId, kg, reps, rpe?] sets. */
function log(workouts: [string, [string, number, number, number?][]][], extra: Partial<AnalystInput> = {}): AnalystInput {
  const sessions: WorkoutSession[] = [];
  const sets: WorkoutSet[] = [];
  workouts.forEach(([date, list], i) => {
    const id = `s${i}`;
    sessions.push({
      id,
      owner: "u",
      templateId: null,
      title: "W",
      date,
      status: "completed",
      startedAt: `${date}T10:00:00Z`,
      completedAt: `${date}T11:00:00Z`,
      reopenedAt: null,
      updatedAt: `${date}T11:00:00Z`,
    });
    list.forEach(([exerciseId, w, r, rpe], j) =>
      sets.push({
        id: `${id}-${j}`,
        owner: "u",
        sessionId: id,
        exerciseId,
        deviceId: null,
        setIndex: j,
        targetReps: null,
        targetWeight: null,
        actualReps: r,
        actualWeight: w,
        rpe: rpe ?? null,
        completed: true,
        completedAt: `${date}T10:30:00Z`,
      }),
    );
  });
  return {
    sessions,
    sets,
    exercises: [ex("squat", "Back Squat", "quads"), ex("bench", "Bench Press", "chest"), ex("row", "Row", "lats")],
    devices: [],
    units: "kg",
    coaching: { daysPerWeek: 3 } as AnalystInput["coaching"],
    ...extra,
  };
}

const squatUp = log([
  ["2026-08-03", [["squat", 100, 5], ["bench", 80, 5]]],
  ["2026-08-10", [["squat", 105, 5], ["bench", 80, 5]]],
  ["2026-08-17", [["squat", 110, 5], ["bench", 80, 5]]],
  ["2026-08-24", [["squat", 115, 5], ["bench", 80, 5]]],
  ["2026-07-20", [["squat", 95, 5]]], // previous period
]);

describe("buildAnalystEvidence", () => {
  it("measures consistency against the weekly target", () => {
    const e = buildAnalystEvidence(squatUp, 4, TODAY);
    expect(e.schemaVersion).toBe("analyst-evidence/1");
    expect(e.period).toEqual({ weeks: 4, from: "2026-08-01", to: "2026-08-28" });
    expect(e.consistency).toMatchObject({
      sessions: 4,
      perWeek: 1,
      targetPerWeek: 3,
      adherencePct: 33,
      previousSessions: 1,
      longestGapDays: 7,
      daysSinceLast: 4,
    });
  });

  it("classifies e1RM trends per lift", () => {
    const e = buildAnalystEvidence(squatUp, 4, TODAY);
    const squat = e.lifts.find((l) => l.exerciseId === "squat")!;
    const bench = e.lifts.find((l) => l.exerciseId === "bench")!;
    expect(squat.status).toBe("improving");
    expect(squat.startE1rm).toBe(116.5); // 100 × (1 + 5/30), rounded to 0.5
    expect(squat.series).toHaveLength(4);
    expect(bench.status).toBe("stalled");
    expect(bench.changePct).toBe(0);
  });

  it("flags declining lifts and lifts with too little data", () => {
    const e = buildAnalystEvidence(
      log([
        ["2026-08-05", [["squat", 120, 5], ["row", 60, 10]]],
        ["2026-08-12", [["squat", 115, 5]]],
        ["2026-08-19", [["squat", 110, 5]]],
      ]),
      4,
      TODAY,
    );
    expect(e.lifts.find((l) => l.exerciseId === "squat")!.status).toBe("declining");
    expect(e.lifts.find((l) => l.exerciseId === "row")!).toMatchObject({ status: "insufficient", changePct: null });
    expect(e.dataQuality.liftsWithTooFewSessions).toBe(1);
    expect(e.confidence).toBe("low"); // under 4 workouts
  });

  it("counts hard sets per muscle group against the previous period, skipping warm-ups and cardio", () => {
    const input = { ...squatUp, sets: [...squatUp.sets, { ...squatUp.sets[0], id: "warm", kind: "warmup" as const }] };
    const e = buildAnalystEvidence(input, 4, TODAY);
    expect(e.muscleGroups.find((m) => m.group === "legs")).toMatchObject({ hardSets: 4, perWeek: 1, previousHardSets: 1, changePct: 300 });
    expect(e.muscleGroups.find((m) => m.group === "chest")).toMatchObject({ hardSets: 4, previousHardSets: 0, changePct: null });
  });

  it("reports data quality: RPE coverage and missing target", () => {
    const e = buildAnalystEvidence(
      log(
        [
          ["2026-08-03", [["squat", 100, 5, 8], ["squat", 100, 5]]],
          ["2026-08-10", [["squat", 100, 5]]],
        ],
        { coaching: null },
      ),
      4,
      TODAY,
    );
    expect(e.dataQuality.rpeLoggedPct).toBe(33);
    expect(e.consistency.adherencePct).toBeNull();
    expect(e.dataQuality.notes.join(" ")).toMatch(/No weekly training target/);
    expect(e.facts.some((f) => f.id === "consistency.target")).toBe(false);
  });

  it("leaves RPE coverage out when the user doesn't log RPE", () => {
    const input = log([["2026-08-03", [["squat", 100, 5]]]], { coaching: { rpe: "never" } as AnalystInput["coaching"] });
    expect(buildAnalystEvidence(input, 4, TODAY).dataQuality.rpeLoggedPct).toBeNull();
  });

  it("reports weights in the user's units", () => {
    const e = buildAnalystEvidence({ ...squatUp, units: "lb" }, 4, TODAY);
    expect(e.lifts.find((l) => l.exerciseId === "squat")!.startE1rm).toBe(257); // 116.67 kg
  });

  it("is high confidence only with frequent training, two trends and a comparison period", () => {
    const weeks: [string, [string, number, number][]][] = [];
    for (let d = 1; d <= 28; d += 3) {
      const day = `2026-08-${String(d).padStart(2, "0")}`;
      weeks.push([day, [["squat", 100 + d, 5], ["bench", 70 + d / 2, 5]]]);
    }
    weeks.push(["2026-07-15", [["squat", 95, 5]]]);
    expect(buildAnalystEvidence(log(weeks), 4, TODAY).confidence).toBe("high");
  });

  it("is empty but well-formed with no data", () => {
    const e = buildAnalystEvidence(log([]), 8, TODAY);
    expect(e.consistency.sessions).toBe(0);
    expect(e.lifts).toEqual([]);
    expect(e.confidence).toBe("low");
    expect(ruleInterpretation(e).points).toEqual([]);
  });
});

describe("numeric-claim validation", () => {
  const e = buildAnalystEvidence(squatUp, 4, TODAY);

  it("accepts numbers that are facts, in any sign or whole-number rounding", () => {
    expect(unsupportedNumbers("4 workouts, 33% of your target of 3 per week; 1RM is up.", e)).toEqual([]);
  });

  it("rejects numbers the engine didn't compute", () => {
    expect(unsupportedNumbers("Add 2 sets and aim for 140 kg.", e)).toEqual([2, 140]);
  });

  it("allows digits that belong to an exercise name", () => {
    const named = buildAnalystEvidence(
      { ...squatUp, exercises: [...squatUp.exercises.filter((x) => x.id !== "bench"), ex("bench", "45 Degree Press", "chest")] },
      4,
      TODAY,
    );
    expect(unsupportedNumbers("Your 45 Degree Press held steady.", named)).toEqual([]);
  });

  it("the rule-based reading always passes its own validator", () => {
    const rules = ruleInterpretation(e);
    expect(rules.points.length).toBeGreaterThan(0);
    expect(validateInterpretation(rules, e)).toMatchObject({ summary: rules.summary, source: "ai" });
  });

  it("rejects a reply with an invented number, an unknown fact id or a bad shape", () => {
    const ok = { summary: "Solid month.", points: [{ title: "Squat up", detail: "Up to 134.", factIds: ["lift.0.end"] }] };
    expect(validateInterpretation(ok, e)).not.toBeNull();
    expect(validateInterpretation({ ...ok, summary: "You trained 5 times." }, e)).toBeNull();
    expect(validateInterpretation({ ...ok, points: [{ ...ok.points[0], factIds: ["made.up"] }] }, e)).toBeNull();
    expect(validateInterpretation({ ...ok, points: [{ ...ok.points[0], factIds: [] }] }, e)).toBeNull();
    expect(validateInterpretation({ summary: "", points: [] }, e)).toBeNull();
    expect(validateInterpretation("nope", e)).toBeNull();
  });
});
