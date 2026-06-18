"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { getToken } from "@/lib/auth";

const GOALS = ["strength", "hypertrophy", "fat_loss", "health"];
const LEVELS = ["beginner", "intermediate", "advanced"];

/** Generates a workout day via Claude and imports it as a template. */
export function AiPlanButton() {
  const router = useRouter();
  const importGeneratedPlan = useStore((s) => s.importGeneratedPlan);
  const profile = useStore((s) => s.profile);
  const [open, setOpen] = useState(false);
  const [goal, setGoal] = useState<string>(profile.goal ?? "strength");
  const [experience, setExperience] = useState<string>(profile.experience ?? "beginner");
  const [equipment, setEquipment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/ai/plan", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ goal, experience, equipment }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Failed");
      const id = importGeneratedPlan(j.plan);
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
        ✨ Generate a plan with AI
      </button>
    );
  }

  return (
    <div className="card space-y-3">
      <p className="font-semibold">✨ AI plan</p>
      <label className="block text-sm">
        <span className="text-muted">Goal</span>
        <select className="input" value={goal} onChange={(e) => setGoal(e.target.value)}>
          {GOALS.map((g) => (
            <option key={g} value={g}>
              {g.replace("_", " ")}
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
        <span className="text-muted">Equipment (optional)</span>
        <input
          className="input"
          placeholder="e.g. machines only, dumbbells, home gym"
          value={equipment}
          onChange={(e) => setEquipment(e.target.value)}
        />
      </label>
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex gap-2">
        <button className="btn-ghost flex-1" onClick={() => setOpen(false)} disabled={busy}>
          Cancel
        </button>
        <button className="btn-primary flex-1" onClick={generate} disabled={busy}>
          {busy ? "Generating…" : "Generate"}
        </button>
      </div>
    </div>
  );
}
