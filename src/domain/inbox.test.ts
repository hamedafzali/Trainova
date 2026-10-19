import { describe, expect, it } from "vitest";
import { buildInbox, unseen, type InboxInput } from "./inbox";
import type { CoachInsight } from "./coach";

const base: InboxInput = {
  today: "2026-10-19",
  assignments: [],
  readiness: { band: "ready", painReported: false },
  checkedInToday: true,
  hasTrained: true,
  insights: [],
};
const insight = (over: Partial<CoachInsight>): CoachInsight => ({
  id: "x",
  kind: "pr",
  severity: "success",
  message: "msg",
  numbers: [],
  ...over,
});

describe("buildInbox", () => {
  it("is empty when nothing needs attention", () => {
    expect(buildInbox(base)).toEqual([]);
  });

  it("asks for a check-in only once there is training history", () => {
    expect(buildInbox({ ...base, checkedInToday: false }).map((i) => i.id)).toEqual(["checkin-2026-10-19"]);
    expect(buildInbox({ ...base, checkedInToday: false, hasTrained: false })).toEqual([]);
  });

  it("links readiness items to Progress → Body", () => {
    const items = buildInbox({ ...base, readiness: { band: "low", painReported: true } });
    expect(items.map((i) => i.id)).toEqual(["pain-2026-10-19", "readiness-low-2026-10-19"]);
    expect(items.every((i) => i.href === "/progress?tab=body")).toBe(true);
  });

  it("puts trainer plans first and links insights to where they can be acted on", () => {
    const items = buildInbox({
      ...base,
      assignments: [{ id: "a1", name: "Push", trainer: "coach@example.com" }],
      insights: [
        insight({ id: "volume-up", kind: "volume_up", severity: "info" }),
        insight({ id: "stall-bench", kind: "stall", severity: "warning", exerciseId: "bench" }),
        insight({ id: "pr-bench-e1rm-2026-10-18", kind: "pr", exerciseId: "bench" }),
      ],
    });
    expect(items.map((i) => [i.id, i.href])).toEqual([
      ["assignment-a1", "/programs"],
      ["stall-bench-2026-10", "/exercises/bench"],
      ["pr-bench-e1rm-2026-10-18", "/exercises/bench"],
      ["volume-up-2026-10", "/progress?tab=workouts"],
    ]);
  });

  it("merges the records one exercise broke into one item", () => {
    const items = buildInbox({
      ...base,
      insights: [
        insight({ id: "pr-bench-max_weight-2026-10-18", exerciseId: "bench", message: "New PR on Bench: 100kg." }),
        insight({ id: "pr-bench-max_reps-2026-10-18", exerciseId: "bench", message: "New PR on Bench: 12 reps." }),
        insight({ id: "pr-squat-max_weight-2026-10-18", exerciseId: "squat", message: "New PR on Squat: 140kg." }),
      ],
    });
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ title: "New personal records", body: "New PR on Bench: 100kg. New PR on Bench: 12 reps." });
    expect(items[1].title).toBe("New personal record");
  });

  it("gives a daily item a new id each day", () => {
    const a = buildInbox({ ...base, checkedInToday: false })[0].id;
    const b = buildInbox({ ...base, today: "2026-10-20", checkedInToday: false })[0].id;
    expect(a).not.toBe(b);
  });
});

describe("unseen", () => {
  it("skips seen items and never counts info items", () => {
    const items = buildInbox({
      ...base,
      checkedInToday: false,
      insights: [insight({ id: "missed", kind: "missed", severity: "warning" }), insight({ id: "pr-1", kind: "pr" })],
    });
    expect(unseen(items, new Set(["pr-1"])).map((i) => i.id)).toEqual(["checkin-2026-10-19"]);
  });
});
