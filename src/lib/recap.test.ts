import { describe, expect, it } from "vitest";
import { escapeXml, recapSvg, type RecapData } from "./recap";

const base: RecapData = {
  title: "Push <A> & co",
  dateLabel: "Sat, Oct 10",
  duration: "48 min",
  volume: "6.2 t",
  sets: 18,
  prNames: [],
  muscles: new Map([["chest", 6]]),
  topSets: [{ name: "Bench Press", detail: "80 kg × 8" }],
};

describe("recapSvg", () => {
  it("escapes user text so the SVG stays valid", () => {
    expect(escapeXml(`a<b>&"c'`)).toBe("a&lt;b&gt;&amp;&quot;c&apos;");
    const svg = recapSvg(base);
    expect(svg).toContain("Push &lt;A&gt; &amp; co");
    expect(svg).not.toContain("<A>");
  });

  it("shows a PR banner only when there are PRs", () => {
    expect(recapSvg(base)).not.toContain("personal record");
    expect(recapSvg({ ...base, prNames: ["Bench Press", "Squat"] })).toContain("2 new personal records");
  });

  it("lists the muscles trained", () => {
    expect(recapSvg(base)).toContain("Trained: Chest");
  });
});
