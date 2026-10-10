import { describe, expect, it } from "vitest";
import { hasRedFlagSymptoms, performSafetyCheck, sanitizeContent } from "./safety";

describe("performSafetyCheck", () => {
  it("allows ordinary coaching that the old substring filter rejected", () => {
    for (const ok of [
      "Add some speed work: 6 x 2 fast reps.",
      "Your diet matters — aim for enough protein.",
      "Take a rest day between hard sessions.",
      "If it hurts, don't push through pain — swap to a neutral-grip press.",
      "Never train through sharp pain; see a physio if it persists.",
    ]) {
      expect(performSafetyCheck(ok).isSafe, ok).toBe(true);
    }
  });
  it("flags harmful advice", () => {
    expect(performSafetyCheck("Run a short steroid cycle to break the plateau.").isSafe).toBe(false);
    expect(performSafetyCheck("Just push through the pain, it builds toughness.").isSafe).toBe(false);
    expect(performSafetyCheck("Eat under 800 kcal a day for a month.").isSafe).toBe(false);
  });
  it("flags personal data", () => {
    expect(performSafetyCheck("Email me at someone@example.com").isSafe).toBe(false);
  });
});

describe("sanitizeContent", () => {
  it("redacts emails and phone numbers", () => {
    expect(sanitizeContent("me@x.io or 555-123-4567")).toBe("[redacted] or [redacted]");
  });
});

describe("hasRedFlagSymptoms", () => {
  it("detects symptoms that need a professional", () => {
    expect(hasRedFlagSymptoms("I got chest pain during squats")).toBe(true);
    expect(hasRedFlagSymptoms("felt numbness down my arm")).toBe(true);
    expect(hasRedFlagSymptoms("my legs are sore from yesterday")).toBe(false);
  });
});
