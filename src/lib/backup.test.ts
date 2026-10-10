import { describe, expect, it } from "vitest";
import { buildSetsCsv, CSV_HEADER } from "./backup";
import type { WorkoutSession, WorkoutSet } from "@/domain/types";

const session = (id: string, status: WorkoutSession["status"], notes: string | null = null): WorkoutSession => ({
  id,
  owner: "local",
  templateId: null,
  title: "Push, heavy",
  date: "2026-10-01",
  status,
  startedAt: `2026-10-01T10:00:00.000Z`,
  completedAt: null,
  reopenedAt: null,
  updatedAt: "",
  notes,
});

const set = (id: string, sessionId: string, completed = true): WorkoutSet => ({
  id,
  owner: "local",
  sessionId,
  exerciseId: "bench",
  deviceId: null,
  setIndex: 0,
  targetReps: 8,
  targetWeight: 60,
  actualReps: 8,
  actualWeight: 60,
  rpe: null,
  completed,
  completedAt: null,
});

describe("buildSetsCsv", () => {
  it("writes completed sets with escaped text and skips archived/open ones", () => {
    const csv = buildSetsCsv({
      sessions: [session("s1", "completed", 'felt "great"'), session("s2", "archived")],
      sets: [set("a", "s1"), set("b", "s1", false), set("c", "s2")],
      exercises: [{ id: "bench", name: "Bench Press", owner: null, defaultDeviceId: null, isCompound: true, primaryMuscle: "chest" }],
    });
    const lines = csv.trim().split("\n");
    expect(lines[0]).toBe(CSV_HEADER.join(","));
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe('2026-10-01,"Push, heavy",Bench Press,1,normal,60,8,,,,,"felt ""great"""');
  });
});

describe("buildBackup", () => {
  it("marks weights canonical so a lb user's re-import isn't converted twice", async () => {
    const { buildBackup } = await import("./backup");
    const { upgradeWeights, SCHEMA_VERSION } = await import("@/domain/legacy");
    const backup = buildBackup({ units: "lb", sets: [set("a", "s1")] }, SCHEMA_VERSION);
    const restored = upgradeWeights(JSON.parse(JSON.stringify(backup)));
    expect((restored.sets as WorkoutSet[])[0].actualWeight).toBe(60);
  });
});
