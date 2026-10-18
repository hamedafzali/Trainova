// One short, safe coaching cue per exercise for the exercise screen. Matched
// on the exercise name first, then its main muscle; a template cue or the
// first how-to step wins over the generic text.

import { muscleGroupOf } from "./taxonomy";
import type { Exercise } from "./types";

const BY_NAME: [RegExp, string][] = [
  [/bench|chest press|floor press/i, "Retract your shoulder blades and keep your feet flat on the floor for a stable base."],
  [/incline/i, "Keep your shoulder blades pinned back and lower the weight to your upper chest under control."],
  [/fly|flye|pec deck/i, "Keep a soft bend in your elbows and stop when you feel a stretch across your chest."],
  [/deadlift|rdl|romanian|good morning/i, "Brace before you pull and keep the bar close, hinging at the hips with a neutral back."],
  [/squat|hack/i, "Brace your core, keep your whole foot planted and let your knees track over your toes."],
  [/leg press/i, "Lower until your hips start to tuck, then press through your whole foot without locking your knees."],
  [/lunge|split squat|step.?up/i, "Keep your torso tall and push through the front heel to stand back up."],
  [/overhead|shoulder press|military/i, "Squeeze your glutes and ribs down so the press comes from your shoulders, not your lower back."],
  [/lateral raise|side raise/i, "Lead with your elbows and stop at shoulder height; lighter and controlled beats swinging."],
  [/pull.?up|chin.?up|pulldown/i, "Start each rep by pulling your shoulder blades down, then drive your elbows to your sides."],
  [/row/i, "Keep your chest up and pull your elbows back until your shoulder blades meet."],
  [/curl/i, "Pin your elbows to your sides and lower slowly; the way down builds strength too."],
  [/tricep|pushdown|skull|dip/i, "Keep your upper arms still and finish each rep with a full lockout."],
  [/plank|hollow|dead bug/i, "Tuck your pelvis slightly and breathe steadily while you hold the position."],
  [/calf/i, "Pause at the top and lower all the way to a full stretch on every rep."],
];

const BY_GROUP: Record<string, string> = {
  chest: "Control the lowering phase and keep your shoulder blades set throughout.",
  back: "Lead with your elbows and squeeze your shoulder blades together at the end of each rep.",
  legs: "Brace your core and keep your knees in line with your toes.",
  shoulders: "Keep your ribs down and move through a pain-free range.",
  arms: "Keep your elbows still and move only at the working joint.",
  core: "Brace as if bracing for a light punch and keep breathing.",
  cardio: "Settle into a pace you could hold a conversation at, then build from there.",
};

const GENERIC = "Move with control, stop a rep or two before form breaks, and stop if anything hurts.";

export function tipFor(exercise: Pick<Exercise, "name" | "primaryMuscle" | "instructions">, cue?: string | null): string {
  if (cue?.trim()) return cue.trim();
  const named = BY_NAME.find(([re]) => re.test(exercise.name));
  if (named) return named[1];
  if (exercise.instructions?.length) return exercise.instructions[0];
  return BY_GROUP[muscleGroupOf(exercise.primaryMuscle)] ?? GENERIC;
}
