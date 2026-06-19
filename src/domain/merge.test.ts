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
