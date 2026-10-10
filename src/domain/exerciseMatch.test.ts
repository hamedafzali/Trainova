import { describe, expect, it } from "vitest";
import { LIBRARY_EXERCISES } from "@/data/exercises";
import { matchExercise, normaliseName } from "./exerciseMatch";

const id = (name: string) => matchExercise(name, LIBRARY_EXERCISES)?.id ?? null;

describe("normaliseName", () => {
  it("lowercases, singularises and strips punctuation", () => {
    expect(normaliseName("Romanian Deadlifts")).toBe("romanian deadlift");
    expect(normaliseName("Farmer's Carry")).toBe("farmer carry");
    expect(normaliseName("Crunches")).toBe("crunch");
    expect(normaliseName("Bench Press (flat)")).toBe("bench press");
  });
});

describe("matchExercise", () => {
  it("matches exact names case-insensitively", () => {
    expect(id("leg press")).toBe("e-legpress");
    expect(id("Dumbbell Bench Press")).toBe("e-dbbench");
  });
  it("understands common aliases and plurals", () => {
    expect(id("RDL")).toBe("e-rdl");
    expect(id("OHP")).toBe("e-ohp");
    expect(id("Pull ups")).toBe("e-pullup");
    expect(id("Barbell Bench Press")).toBe("e-bench");
    expect(id("Squats")).toBe("e-squat");
    expect(id("Lateral Raises")).toBe("e-lateral");
    expect(id("Farmers walk")).toBe("e-farmer");
  });
  it("uses the named equipment to pick between variants", () => {
    expect(id("Cable Lateral Raise")).toBe("e-cablelateral");
    expect(id("barbell rows")).toBe("e-bbrow");
  });
  it("returns null for unrelated names", () => {
    expect(id("Underwater basket weaving")).toBeNull();
    expect(id("")).toBeNull();
  });
});
