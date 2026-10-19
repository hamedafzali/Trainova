import { beforeEach, describe, expect, it } from "vitest";
import { useStore } from "./store";

const st = () => useStore.getState();

/** Start an empty workout and log one set on `exerciseId`. */
function logSet(sessionId: string, exerciseId: string, kg: number, reps: number) {
  st().addSet(sessionId, exerciseId);
  const s = st().sets.filter((x) => x.sessionId === sessionId && x.exerciseId === exerciseId).at(-1)!;
  st().updateSet(s.id, { actualWeight: kg, actualReps: reps });
  st().completeSet(s.id);
  return s.id;
}

describe("correcting logged sets", () => {
  let session: string;
  let bench: string;
  let row: string;
  beforeEach(() => {
    st().resetUserData();
    session = st().startSession(null).id!;
    [bench, row] = st().exercises.filter((e) => e.type === "weight_reps" || !e.type).map((e) => e.id);
  });

  it("a corrected typo no longer counts as a record", () => {
    const id = logSet(session, bench, 350, 8);
    expect(st().prs.find((p) => p.exerciseId === bench && p.kind === "max_weight")?.value).toBe(350);
    st().editSet(id, { actualWeight: 35 });
    expect(st().prs.find((p) => p.exerciseId === bench && p.kind === "max_weight")?.value).toBe(35);
  });

  it("deleting or undoing a logged set takes its record back", () => {
    const id = logSet(session, bench, 50, 5);
    st().updateSet(id, { completed: false, completedAt: null });
    expect(st().prs.filter((p) => p.exerciseId === bench)).toEqual([]);
    st().completeSet(id);
    st().removeSet(id);
    expect(st().prs.filter((p) => p.exerciseId === bench)).toEqual([]);
  });

  it("moves a set logged on the wrong exercise", () => {
    logSet(session, row, 40, 10);
    const wrong = logSet(session, bench, 60, 8);
    st().moveSet(wrong, row);
    const rows = st().setsForSession(session).filter((x) => x.exerciseId === row);
    expect(rows.map((x) => x.actualWeight)).toEqual([40, 60]);
    expect(rows.map((x) => x.setIndex)).toEqual([0, 1]);
    expect(st().prs.filter((p) => p.exerciseId === bench)).toEqual([]);
  });

  it("a new set starts from the last logged weight, not the plan", () => {
    logSet(session, bench, 35, 8);
    st().addSet(session, bench);
    expect(st().sets.filter((x) => x.exerciseId === bench).at(-1)?.targetWeight).toBe(35);
  });
});

describe("swapping an exercise mid-workout", () => {
  let session: string;
  let bench: string;
  let row: string;
  let press: string;
  beforeEach(() => {
    st().resetUserData();
    session = st().startSession(null).id!;
    [bench, row, press] = st().exercises.filter((e) => e.type === "weight_reps" || !e.type).map((e) => e.id);
  });

  it("moves the open sets and keeps the logged ones", () => {
    logSet(session, bench, 60, 8);
    st().addSet(session, bench);
    st().addSet(session, bench);
    expect(st().swapSessionExercise(session, bench, press)).toBe(2);
    const sets = st().setsForSession(session);
    const benchSets = sets.filter((x) => x.exerciseId === bench);
    expect(benchSets.map((x) => x.completed)).toEqual([true]);
    const moved = sets.filter((x) => x.exerciseId === press);
    expect(moved.map((x) => x.setIndex)).toEqual([0, 1]);
    expect(moved.every((x) => !x.completed && x.targetWeight === null)).toBe(true);
  });

  it("refuses an exercise already in the workout or nothing to move", () => {
    st().addSet(session, bench);
    st().addSet(session, row);
    expect(st().swapSessionExercise(session, bench, row)).toBe(0);
    logSet(session, press, 40, 10);
    const other = st().exercises.find((e) => ![bench, row, press].includes(e.id))!.id;
    expect(st().swapSessionExercise(session, press, other)).toBe(0);
    expect(st().setsForSession(session).filter((x) => x.exerciseId === bench)).toHaveLength(1);
  });
});
