import { describe, expect, it } from "vitest";
import { AiOutputValidationError, validateGeneratedWorkout } from "./validate";

const workout = {
  name: "Full Body A",
  description: "A balanced strength session.",
  duration: 45,
  focus: "strength",
  exercises: [
    {
      name: "Goblet squat",
      sets: 3,
      reps: "8-10",
      rest: 90,
      rpe: 8,
      equipment: "Dumbbell",
      muscleGroup: "Quads",
      cue: "Keep your ribs stacked over your pelvis.",
    },
  ],
  warmup: [{ name: "Bike", duration: "3 min", instructions: "Easy pace." }],
  cooldown: [{ name: "Walk", duration: "2 min", instructions: "Slowly lower your heart rate." }],
};

describe("validateGeneratedWorkout", () => {
  it("keeps the structured training details required by plan import", () => {
    expect(validateGeneratedWorkout(workout)).toEqual(workout);
  });

  it("rejects unsafe or incomplete exercise output", () => {
    expect(() =>
      validateGeneratedWorkout({
        ...workout,
        exercises: [{ ...workout.exercises[0], rpe: 12 }],
      }),
    ).toThrow(AiOutputValidationError);
  });
});
