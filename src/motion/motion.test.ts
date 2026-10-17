import { describe, expect, it } from "vitest";
import { LIBRARY_EXERCISES as EXERCISES } from "@/data/exercises";
import { MOTIONS, motionSpecFor, resolveMotion } from "./catalog";
import { BODY, solve } from "./rig";
import { sample } from "./timeline";
import { dist } from "./vec";

const finite = (v: number[]) => v.every(Number.isFinite);

/** How far the solved chain ends land from their targets, in metres. */
function reachError(key: Parameters<typeof solve>[0]) {
  const sk = solve(key);
  return Math.max(...[0, 1].flatMap((i) => [dist(sk.hand[i], key.hands[i]), dist(sk.ankle[i], key.feet[i])]));
}

describe("movement guide engine", () => {
  it("covers every library exercise", () => {
    const missing = EXERCISES.filter((e) => !MOTIONS[e.id]).map((e) => e.id);
    expect(missing).toEqual([]);
  });

  it.each(Object.keys(MOTIONS))("%s solves cleanly", (id) => {
    const { motion } = resolveMotion(MOTIONS[id]);
    expect(motion.keys.length).toBeGreaterThan(1);
    for (const key of motion.keys) {
      const sk = solve(key);
      for (const p of [sk.pelvis, sk.head, ...sk.hand, ...sk.elbow, ...sk.knee, ...sk.ankle, ...sk.toe]) expect(finite(p)).toBe(true);
      // Bones keep their length.
      for (const i of [0, 1]) {
        expect(dist(sk.shoulder[i], sk.elbow[i])).toBeCloseTo(BODY.upperArm, 3);
        expect(dist(sk.hip[i], sk.knee[i])).toBeCloseTo(BODY.thigh, 3);
      }
      // Targets are reachable — hands and feet land where the pattern put them.
      expect(reachError(key)).toBeLessThan(0.04);
      // Nothing sinks into the floor.
      expect(Math.min(sk.ankle[0][1], sk.ankle[1][1], sk.pelvis[1])).toBeGreaterThan(0.02);
    }
    for (let t = 0; t < 8; t += 0.37) {
      const f = sample(motion, t);
      expect(finite(f.pose.pelvis)).toBe(true);
      expect(typeof f.cue).toBe("string");
    }
  });

  it("infers a movement for exercises outside the library", () => {
    const spec = motionSpecFor({ id: "custom-1", name: "Incline Dumbbell Fly", equipment: "dumbbell", primaryMuscle: "chest" });
    expect(spec.pattern).toBe("armArc");
    expect(spec.equipment?.some((p) => p.kind === "dumbbell")).toBe(true);
    expect(motionSpecFor({ id: "custom-2", name: "Mystery move", equipment: "machine", primaryMuscle: "lats" }).pattern).toBe("pulldown");
    expect(motionSpecFor({ id: "custom-3", name: "Thing", equipment: "other", primaryMuscle: null }).pattern).toBe("squat");
  });
});
