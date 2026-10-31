import { MOTIONS, MUSCLES as GUIDE_MUSCLES, motionSpecFor, PATTERN_IDS, resolveMotion } from "pixelwizards-gym-motion";
import { describe, expect, it } from "vitest";
import { LIBRARY_EXERCISES as EXERCISES } from "@/data/exercises";
import { MUSCLES } from "@/domain/taxonomy";

// The engine itself is tested in pixelwizards-gym-motion. These check that
// Trainova's data fits it: every exercise has a movement and every muscle can light up.

describe("movement guide", () => {
  it("covers every library exercise", () => {
    const missing = EXERCISES.filter((e) => !MOTIONS[e.id]).map((e) => e.id);
    expect(missing).toEqual([]);
  });

  it("knows every muscle Trainova uses", () => {
    const unknown = MUSCLES.filter((m) => !(GUIDE_MUSCLES as readonly string[]).includes(m));
    expect(unknown).toEqual([]);
  });

  it.each(EXERCISES.map((e) => [e.id, e] as const))("%s resolves to a movement", (_, e) => {
    const { motion } = resolveMotion(motionSpecFor(e));
    expect(motion.keys.length).toBeGreaterThan(1);
  });

  it("shows free-weight lifts on their machine version", () => {
    const squat = motionSpecFor({ id: "e-squat", name: "Back squat", equipment: "barbell", primaryMuscle: "quads" });
    expect(squat.device).toBe("Smith machine");
  });

  it("infers a movement for custom exercises", () => {
    const fly = motionSpecFor({ id: "custom-1", name: "Incline Dumbbell Fly", equipment: "dumbbell", primaryMuscle: "chest" });
    expect(fly.pattern).toBe("armArc");
    for (const name of ["Mystery move", "Thing"]) {
      const spec = motionSpecFor({ id: `custom-${name}`, name, equipment: "other", primaryMuscle: null });
      expect(PATTERN_IDS).toContain(spec.pattern);
    }
  });
});
