"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { getToken } from "@/lib/auth";

const GOALS = ["strength", "hypertrophy", "fat_loss", "health"];
const FOCUSES = ["strength", "hypertrophy", "endurance"];
const LEVELS = ["beginner", "intermediate", "advanced"];
const INTENSITIES = ["low", "medium", "high"];

/** Generates a workout via Mistral AI and imports it as a template. */
export function AiPlanButton() {
  const router = useRouter();
  const importGeneratedPlan = useStore((s) => s.importGeneratedPlan);
  const profile = useStore((s) => s.profile);
  const [open, setOpen] = useState(false);
  const [goal, setGoal] = useState<string>(profile.goal ?? "strength");
  const [focus, setFocus] = useState<string>("strength");
  const [experience, setExperience] = useState<string>(
    profile.experience ?? "beginner",
  );
  const [duration, setDuration] = useState(45);
  const [equipment, setEquipment] = useState("Full gym");
  const [intensity, setIntensity] = useState<string>("medium");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/ai/workout", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          action: "generate_workout",
          data: {
            goal,
            focus,
            duration,
            equipment: equipment.split(",").map((e) => e.trim()),
            experience,
            intensity,
          },
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Failed");

      // Convert AI workout to template format
      const workout = j.workout;
      const template = {
        name: workout.name,
        notes: [
          workout.description,
          workout.warmup?.length
            ? `Warm-up:\n${workout.warmup
                .map((item: { name: string; duration: string; instructions: string }) =>
                  `• ${item.name} (${item.duration}): ${item.instructions}`,
                )
                .join("\n")}`
            : null,
          workout.cooldown?.length
            ? `Cooldown:\n${workout.cooldown
                .map((item: { name: string; duration: string; instructions: string }) =>
                  `• ${item.name} (${item.duration}): ${item.instructions}`,
                )
                .join("\n")}`
            : null,
        ]
          .filter(Boolean)
          .join("\n\n") || null,
        exercises: workout.exercises.map((ex: any) => ({
          name: ex.name,
          muscle: ex.muscleGroup || null,
          sets: ex.sets,
          reps:
            typeof ex.reps === "string"
              ? parseInt(ex.reps.split("-")[0])
              : ex.reps,
          restSeconds: ex.rest,
          tempo: ex.tempo || null,
          targetRpe: ex.rpe,
          cue: ex.cue || null,
          substitution: ex.substitution || null,
        })),
      };

      const id = importGeneratedPlan(template);
      setOpen(false);
      router.push(`/templates/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button className="btn-primary w-full" onClick={() => setOpen(true)}>
        ✨ Generate a workout with AI
      </button>
    );
  }

  return (
    <div className="card space-y-3">
      <p className="font-semibold">✨ AI workout generator</p>
      <label className="block text-sm">
        <span className="text-muted">Goal</span>
        <select
          className="input"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
        >
          {GOALS.map((g) => (
            <option key={g} value={g}>
              {g.replace("_", " ")}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="text-muted">Focus</span>
        <select
          className="input"
          value={focus}
          onChange={(e) => setFocus(e.target.value)}
        >
          {FOCUSES.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="text-muted">Experience</span>
        <select
          className="input"
          value={experience}
          onChange={(e) => setExperience(e.target.value)}
        >
          {LEVELS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="text-muted">Duration (minutes)</span>
        <input
          className="input"
          type="number"
          min="15"
          max="120"
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
        />
      </label>
      <label className="block text-sm">
        <span className="text-muted">Equipment</span>
        <input
          className="input"
          placeholder="e.g. Full gym, dumbbells only, bodyweight"
          value={equipment}
          onChange={(e) => setEquipment(e.target.value)}
        />
      </label>
      <label className="block text-sm">
        <span className="text-muted">Intensity</span>
        <select
          className="input"
          value={intensity}
          onChange={(e) => setIntensity(e.target.value)}
        >
          {INTENSITIES.map((i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </select>
      </label>
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex gap-2">
        <button
          className="btn-ghost flex-1"
          onClick={() => setOpen(false)}
          disabled={busy}
        >
          Cancel
        </button>
        <button
          className="btn-primary flex-1"
          onClick={generate}
          disabled={busy}
        >
          {busy ? "Generating…" : "Generate"}
        </button>
      </div>
    </div>
  );
}
