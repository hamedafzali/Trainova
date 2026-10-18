import { describe, expect, it } from "vitest";
import { newer, stampChanges, stampList } from "./versioning";

const AT = "2026-10-18T10:00:00.000Z";

describe("stampList", () => {
  it("stamps only records that were replaced", () => {
    const a = { id: "a", owner: "me", name: "A" };
    const b = { id: "b", owner: "me", name: "B" };
    const out = stampList([a, b], [a, { ...b, name: "B2" }], AT);
    expect(out[0]).toBe(a);
    expect(out[1]).toMatchObject({ name: "B2", updatedAt: AT });
  });

  it("never stamps shared library records", () => {
    const lib: { id: string; owner: null; name: string; updatedAt?: string } = { id: "d-1", owner: null, name: "Chest Press" };
    const out = stampList([lib], [{ ...lib, name: "x" }], AT);
    expect(out[0].updatedAt).toBeUndefined();
  });

  it("keeps a stamp that the update already set (e.g. from sync)", () => {
    const old = { id: "a", owner: "me", updatedAt: "2026-10-01T00:00:00.000Z" };
    const incoming = { id: "a", owner: "me", updatedAt: "2026-10-05T00:00:00.000Z" };
    expect(stampList([old], [incoming], AT)[0].updatedAt).toBe("2026-10-05T00:00:00.000Z");
  });

  it("returns the same array when nothing changed", () => {
    const list = [{ id: "a", owner: "me" }];
    expect(stampList([...list], list, AT)).toBe(list);
  });
});

describe("stampChanges", () => {
  it("stamps an edited profile", () => {
    const prev: Record<string, unknown> = { profile: { goal: null } };
    const out = stampChanges(prev, { profile: { goal: "strength" } }, AT);
    expect(out.profile).toMatchObject({ goal: "strength", updatedAt: AT });
  });

  it("treats a units change as a profile edit", () => {
    const prev = { units: "kg", profile: { goal: "strength" } };
    const out = stampChanges(prev, { units: "lb" }, AT);
    expect(out.profile).toMatchObject({ goal: "strength", updatedAt: AT });
  });

  it("leaves unrelated updates alone", () => {
    const prev: Record<string, unknown> = { units: "kg", profile: { goal: "strength" }, sessions: [] };
    const next = { sessions: [{ id: "s" }] };
    expect(stampChanges(prev, next, AT)).toBe(next);
  });
});

describe("newer", () => {
  it("prefers the later stamp and keeps the first copy on ties", () => {
    const a = { updatedAt: "2026-10-01" };
    const b = { updatedAt: "2026-10-02" };
    expect(newer(a, b)).toBe(b);
    expect(newer(b, a)).toBe(b);
    const c = {};
    const d = {};
    expect(newer(c, d)).toBe(c);
  });
});
