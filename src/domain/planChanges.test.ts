import { describe, expect, it } from "vitest";
import { capturePlan, createdIds, stampsOf, undoPlan, type PlanChange } from "./planChanges";
import type { Program, WorkoutTemplate } from "./types";

const tpl = (id: string, updatedAt: string, exercises: string[] = []): WorkoutTemplate =>
  ({
    id,
    owner: "me",
    name: id,
    notes: null,
    updatedAt,
    exercises: exercises.map((e, i) => ({ id: `${id}-${e}`, exerciseId: e, deviceId: null, position: i, sets: [], restSeconds: 90 })),
  }) as WorkoutTemplate;
const prog = (id: string, days: string[], updatedAt = "t0"): Program => ({
  id,
  owner: "me",
  name: id,
  source: "self",
  notes: null,
  dayTemplateIds: days,
  updatedAt,
});

function change(before: { templates: WorkoutTemplate[]; programs: Program[] }, after: typeof before, touched: string[]): PlanChange {
  const base = { before: capturePlan(before, touched, []), created: createdIds(before, after) };
  return {
    id: "c1",
    at: "t1",
    source: "ai_coach",
    actionType: "x",
    title: "x",
    detail: "",
    ...base,
    stamps: stampsOf(after, base),
    undoneAt: null,
  };
}

describe("undoPlan", () => {
  it("restores a modified workout with a fresh stamp", () => {
    const before = { templates: [tpl("a", "t0", ["squat", "bench"])], programs: [] };
    const after = { templates: [tpl("a", "t1", ["squat"])], programs: [] };
    const r = undoPlan(after, change(before, after, ["a"]), "t2");
    expect(r.ok && r.templates[0].exercises.map((e) => e.exerciseId)).toEqual(["squat", "bench"]);
    expect(r.ok && r.templates[0].updatedAt).toBe("t2");
  });

  it("deletes what the change created, including days on a program", () => {
    const before = { templates: [], programs: [] };
    const after = { templates: [tpl("d1", "t1"), tpl("d2", "t1")], programs: [prog("p", ["d1", "d2"], "t1")] };
    const r = undoPlan(after, change(before, after, []));
    expect(r).toMatchObject({ ok: true, templates: [], programs: [], deleted: ["d1", "d2", "p"] });
  });

  it("refuses when the workout was edited after the change", () => {
    const before = { templates: [tpl("a", "t0", ["squat"])], programs: [] };
    const after = { templates: [tpl("a", "t1", [])], programs: [] };
    const c = change(before, after, ["a"]);
    const r = undoPlan({ templates: [tpl("a", "t5", ["row"])], programs: [] }, c);
    expect(r.ok).toBe(false);
  });

  it("refuses a second undo and a change whose workout is gone", () => {
    const before = { templates: [tpl("a", "t0")], programs: [] };
    const after = { templates: [tpl("a", "t1")], programs: [] };
    const c = change(before, after, ["a"]);
    expect(undoPlan(after, { ...c, undoneAt: "t2" }).ok).toBe(false);
    expect(undoPlan({ templates: [], programs: [] }, c).ok).toBe(false);
  });

  it("snapshots are deep copies", () => {
    const t = tpl("a", "t0", ["squat"]);
    const snap = capturePlan({ templates: [t], programs: [] }, ["a"], []);
    t.exercises.length = 0;
    expect(snap.templates[0].exercises).toHaveLength(1);
  });
});
