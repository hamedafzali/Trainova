import { describe, expect, it } from "vitest";
import {
  activeSession,
  canCreateSession,
  canReopen,
  completedSetCount,
  dayKey,
  isAbandoned,
} from "./session";
import type { WorkoutSession, WorkoutSet } from "./types";

const session = (id: string, status: WorkoutSession["status"]): WorkoutSession => ({
  id,
  owner: "u",
  templateId: null,
  title: "W",
  date: "2026-06-18",
  status,
  startedAt: "2026-06-18T10:00:00.000Z",
  completedAt: status === "completed" ? "2026-06-18T10:30:00.000Z" : null,
  reopenedAt: null,
  updatedAt: "2026-06-18T10:00:00.000Z",
});

const set = (sessionId: string, completed: boolean): WorkoutSet => ({
  id: Math.random().toString(),
  owner: "u",
  sessionId,
  exerciseId: "e",
  deviceId: null,
  setIndex: 0,
  targetReps: 8,
  targetWeight: 50,
  actualReps: completed ? 8 : null,
  actualWeight: completed ? 50 : null,
  rpe: null,
  completed,
  completedAt: completed ? "2026-06-18T10:05:00.000Z" : null,
});

describe("active session is derived", () => {
  it("returns the single active session", () => {
    const s = [session("a", "completed"), session("b", "active")];
    expect(activeSession(s)?.id).toBe("b");
  });
  it("is null when all are completed/archived", () => {
    expect(activeSession([session("a", "completed"), session("b", "archived")])).toBeNull();
  });
});

describe("single-active invariant", () => {
  it("blocks creating while one is active", () => {
    expect(canCreateSession([session("a", "active")])).toBe(false);
  });
  it("allows creating when none active", () => {
    expect(canCreateSession([session("a", "completed")])).toBe(true);
  });
});

describe("reopen guard", () => {
  it("allows reopening a completed session when nothing is active", () => {
    const c = session("a", "completed");
    expect(canReopen(c, [c])).toBe(true);
  });
  it("blocks reopening when another session is active", () => {
    const c = session("a", "completed");
    expect(canReopen(c, [c, session("b", "active")])).toBe(false);
  });
  it("blocks reopening a non-completed session", () => {
    const a = session("a", "active");
    expect(canReopen(a, [a])).toBe(false);
  });
});

describe("abandonment", () => {
  it("flags an active session with no completed sets", () => {
    expect(isAbandoned(session("a", "active"), [])).toBe(true);
  });
  it("is not abandoned once a set is completed", () => {
    const sets = [set("a", true), set("a", false)];
    expect(completedSetCount("a", sets)).toBe(1);
    expect(isAbandoned(session("a", "active"), sets)).toBe(false);
  });
});

describe("dayKey", () => {
  it("formats local date", () => {
    expect(dayKey(new Date(2026, 5, 9))).toBe("2026-06-09");
  });
});
