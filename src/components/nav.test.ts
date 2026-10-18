import { describe, expect, it } from "vitest";
import { MOBILE_TABS, activeHref, sidebarItems } from "./nav";

describe("navigation", () => {
  it("has the five primary tabs", () => {
    expect(MOBILE_TABS.map((t) => t.label)).toEqual(["Home", "Plan", "Workouts", "Progress", "Profile"]);
  });

  it("maps sub-pages to their tab on phones", () => {
    expect(activeHref(MOBILE_TABS, "/")).toBe("/");
    expect(activeHref(MOBILE_TABS, "/coach")).toBe("/");
    expect(activeHref(MOBILE_TABS, "/programs/abc")).toBe("/programs");
    expect(activeHref(MOBILE_TABS, "/calendar")).toBe("/programs");
    expect(activeHref(MOBILE_TABS, "/templates/t1")).toBe("/templates");
    expect(activeHref(MOBILE_TABS, "/exercises/bench")).toBe("/templates");
    expect(activeHref(MOBILE_TABS, "/history")).toBe("/templates");
    expect(activeHref(MOBILE_TABS, "/progress")).toBe("/progress");
    expect(activeHref(MOBILE_TABS, "/admin")).toBeNull();
  });

  it("highlights exactly one sidebar item, the most specific", () => {
    const items = sidebarItems();
    expect(activeHref(items, "/exercises/bench")).toBe("/exercises");
    expect(activeHref(items, "/history/x")).toBe("/history");
    expect(activeHref(items, "/coach")).toBe("/coach");
    expect(activeHref(items, "/calendar")).toBe("/programs");
    expect(activeHref(items, "/templates/t1")).toBe("/templates");
    // A prefix that only shares characters doesn't match.
    expect(activeHref(items, "/historyx")).toBeNull();
  });
});
