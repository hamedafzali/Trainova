import { describe, expect, it } from "vitest";
import { MOBILE_TABS, activeHref, sidebarItems } from "./nav";

describe("navigation", () => {
  it("has the five primary tabs", () => {
    expect(MOBILE_TABS.map((t) => t.label)).toEqual(["Today", "Train", "Progress", "AI Coach", "Profile"]);
  });

  it("maps sub-pages to their tab on phones", () => {
    expect(activeHref(MOBILE_TABS, "/")).toBe("/");
    expect(activeHref(MOBILE_TABS, "/programs/abc")).toBe("/templates");
    expect(activeHref(MOBILE_TABS, "/exercises/bench")).toBe("/templates");
    expect(activeHref(MOBILE_TABS, "/history")).toBe("/progress");
    expect(activeHref(MOBILE_TABS, "/calendar")).toBe("/progress");
    expect(activeHref(MOBILE_TABS, "/coach")).toBe("/coach");
    expect(activeHref(MOBILE_TABS, "/admin")).toBeNull();
  });

  it("highlights exactly one sidebar item, the most specific", () => {
    const items = sidebarItems();
    expect(activeHref(items, "/exercises/bench")).toBe("/exercises");
    expect(activeHref(items, "/calendar")).toBe("/history");
    expect(activeHref(items, "/progress")).toBe("/progress");
    expect(activeHref(items, "/templates/t1")).toBe("/templates");
    // A prefix that only shares characters doesn't match.
    expect(activeHref(items, "/historyx")).toBeNull();
  });
});
