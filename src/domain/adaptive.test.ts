import { describe, expect, it } from "vitest";
import { recommendToday } from "./adaptive";

const templates = [
  { id: "a", owner: "u", name: "Full Body A", notes: null, exercises: [] },
  { id: "b", owner: "u", name: "Full Body B", notes: null, exercises: [] },
];

describe("recommendToday", () => {
  it("advances to the next program day after a completed session", () => {
    expect(recommendToday({
      templates,
      programs: [{ id: "p", owner: "u", name: "Plan", source: "self", notes: null, dayTemplateIds: ["a", "b"] }],
      sessions: [{ id: "s", owner: "u", templateId: "a", title: "A", date: "2026-08-10", status: "completed", startedAt: "2026-08-10T12:00:00Z", completedAt: "2026-08-10T12:40:00Z", reopenedAt: null, updatedAt: "2026-08-10T12:40:00Z" }],
      feedback: [],
    })).toMatchObject({ templateId: "b", mode: "standard" });
  });

  it("recommends a controlled session after pain feedback", () => {
    expect(recommendToday({
      templates,
      programs: [],
      sessions: [{ id: "s", owner: "u", templateId: "a", title: "A", date: "2026-08-10", status: "completed", startedAt: "2026-08-10T12:00:00Z", completedAt: "2026-08-10T12:40:00Z", reopenedAt: null, updatedAt: "2026-08-10T12:40:00Z" }],
      feedback: [{ id: "f", owner: "u", sessionId: "s", difficulty: "hard", energy: 2, confidence: 3, pain: "Knee discomfort", completedInMinutes: null, createdAt: "2026-08-10T12:41:00Z" }],
    })).toMatchObject({ templateId: "a", mode: "recovery" });
  });
});
