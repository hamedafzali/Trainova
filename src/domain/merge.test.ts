import { describe, expect, it } from "vitest";
import { mergeSnapshots } from "./merge";

describe("mergeSnapshots", () => {
  it("returns local when remote is null", () => {
    const local = { sessions: [{ id: "a" }] };
    expect(mergeSnapshots(local, null)).toEqual(local);
  });

  it("unions distinct sessions from both devices", () => {
    const local = { sessions: [{ id: "phone", updatedAt: "2026-06-19T10:00:00Z" }], sets: [] };
    const remote = { sessions: [{ id: "laptop", updatedAt: "2026-06-19T09:00:00Z" }], sets: [] };
    const merged = mergeSnapshots(local, remote);
    expect((merged.sessions as { id: string }[]).map((s) => s.id).sort()).toEqual([
      "laptop",
      "phone",
    ]);
  });

  it("keeps the more recently updated session for the same id", () => {
    const local = { sessions: [{ id: "x", updatedAt: "2026-06-19T12:00:00Z", title: "new" }] };
    const remote = { sessions: [{ id: "x", updatedAt: "2026-06-19T08:00:00Z", title: "old" }] };
    const merged = mergeSnapshots(local, remote) as { sessions: { title: string }[] };
    expect(merged.sessions[0].title).toBe("new");
  });

  it("keeps the higher-value PR per exercise+kind", () => {
    const local = { prs: [{ exerciseId: "e1", kind: "max_weight", value: 90 }] };
    const remote = { prs: [{ exerciseId: "e1", kind: "max_weight", value: 100 }] };
    const merged = mergeSnapshots(local, remote) as { prs: { value: number }[] };
    expect(merged.prs[0].value).toBe(100);
  });

  it("merges custom exercises additively", () => {
    const local = { exercises: [{ id: "a" }, { id: "b" }] };
    const remote = { exercises: [{ id: "b" }, { id: "c" }] };
    const merged = mergeSnapshots(local, remote) as { exercises: { id: string }[] };
    expect(merged.exercises.map((e) => e.id).sort()).toEqual(["a", "b", "c"]);
  });
});

describe("tombstones", () => {
  it("does not resurrect a set deleted on one device", () => {
    const local = { sets: [{ id: "keep" }], tombstones: [{ id: "gone", at: "2026-10-01" }] };
    const remote = { sets: [{ id: "keep" }, { id: "gone" }] };
    const merged = mergeSnapshots(local, remote) as { sets: { id: string }[] };
    expect(merged.sets.map((s) => s.id)).toEqual(["keep"]);
  });

  it("honours tombstones that arrive from the remote side", () => {
    const local = { programs: [{ id: "p1" }, { id: "p2" }] };
    const remote = { programs: [{ id: "p1" }], tombstones: [{ id: "p2", at: "2026-10-01" }] };
    const merged = mergeSnapshots(local, remote) as {
      programs: { id: string }[];
      tombstones: { id: string }[];
    };
    expect(merged.programs.map((p) => p.id)).toEqual(["p1"]);
    expect(merged.tombstones).toHaveLength(1);
  });

  it("unions bodyweight entries", () => {
    const merged = mergeSnapshots(
      { bodyLog: [{ id: "a", date: "2026-10-01", weightKg: 80 }] },
      { bodyLog: [{ id: "b", date: "2026-10-02", weightKg: 79.5 }] }
    ) as { bodyLog: unknown[] };
    expect(merged.bodyLog).toHaveLength(2);
  });
});

describe("profile merge", () => {
  it("keeps the account's onboarded profile over a fresh device", () => {
    const merged = mergeSnapshots(
      { profile: { onboarded: false, goal: null } },
      { profile: { onboarded: true, goal: "strength" } }
    ) as { profile: { goal: string } };
    expect(merged.profile.goal).toBe("strength");
  });
});

describe("conflict policy", () => {
  it("keeps the newer edit of a template from either side", () => {
    const local = { templates: [{ id: "t", name: "Old", updatedAt: "2026-10-01T00:00:00.000Z" }] };
    const remote = { templates: [{ id: "t", name: "New", updatedAt: "2026-10-02T00:00:00.000Z" }] };
    const merged = mergeSnapshots(local, remote) as { templates: { name: string }[] };
    expect(merged.templates).toEqual([expect.objectContaining({ name: "New" })]);
  });

  it("follows the units of the winning profile", () => {
    const merged = mergeSnapshots(
      { units: "kg", profile: { onboarded: true, updatedAt: "2026-10-01T00:00:00.000Z" } },
      { units: "lb", profile: { onboarded: true, updatedAt: "2026-10-03T00:00:00.000Z" } }
    );
    expect(merged.units).toBe("lb");
  });

  it("keeps the more recently edited copy of a set and rebuilds PRs from it", () => {
    const base = { id: "s1", exerciseId: "bench", completed: true, completedAt: "2026-10-01T10:00:00.000Z" };
    const merged = mergeSnapshots(
      { sets: [{ ...base, actualWeight: 350, actualReps: 8 }], prs: [] },
      {
        sets: [{ ...base, actualWeight: 35, actualReps: 8, editedAt: "2026-10-02T10:00:00.000Z" }],
        prs: [{ exerciseId: "bench", kind: "max_weight", value: 350, achievedAt: "2026-10-01" }],
      }
    ) as { prs: { kind: string; value: number }[] };
    expect(merged.prs.find((p) => p.kind === "max_weight")?.value).toBe(35);
  });
});
