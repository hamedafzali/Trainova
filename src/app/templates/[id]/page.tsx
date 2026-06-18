"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ExercisePicker } from "@/components/ExercisePicker";
import { useHydrated, useStore } from "@/lib/store";

export default function TemplateEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const hydrated = useHydrated();

  const template = useStore((s) => s.templates.find((t) => t.id === id));
  const exerciseById = useStore((s) => s.exerciseById);
  const addTemplateExercise = useStore((s) => s.addTemplateExercise);
  const removeTemplateExercise = useStore((s) => s.removeTemplateExercise);
  const startSession = useStore((s) => s.startSession);
  const [picking, setPicking] = useState(false);

  if (!hydrated) return <main className="p-4 text-muted">Loading…</main>;
  if (!template) {
    return (
      <main className="space-y-3 p-4">
        <p className="text-muted">Plan not found.</p>
        <Link href="/templates" className="text-accent">
          ← Back to plans
        </Link>
      </main>
    );
  }

  return (
    <main className="space-y-4 p-4">
      <header className="flex items-center justify-between pt-2">
        <div>
          <Link href="/templates" className="text-sm text-muted">
            ← Plans
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">{template.name}</h1>
        </div>
        <button
          className="btn-primary"
          onClick={() => {
            const sid = startSession(template.id);
            router.push(`/session/${sid}`);
          }}
        >
          Start
        </button>
      </header>

      {template.exercises.length === 0 ? (
        <div className="card text-center text-muted">No exercises yet.</div>
      ) : (
        <ul className="space-y-2">
          {template.exercises.map((te) => {
            const ex = exerciseById(te.exerciseId);
            return (
              <li key={te.id} className="card flex items-center justify-between">
                <div>
                  <p className="font-semibold">{ex?.name ?? "Exercise"}</p>
                  <p className="text-xs text-muted">
                    {te.targetSets} × {te.targetReps}
                    {te.targetWeight ? ` @ ${te.targetWeight}` : ""}
                  </p>
                </div>
                <button
                  className="btn-danger"
                  onClick={() => removeTemplateExercise(template.id, te.id)}
                >
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <button className="btn-ghost w-full" onClick={() => setPicking(true)}>
        + Add exercise
      </button>

      {picking && (
        <ExercisePicker
          onClose={() => setPicking(false)}
          onPick={(exerciseId) => {
            addTemplateExercise(template.id, exerciseId);
            setPicking(false);
          }}
        />
      )}
    </main>
  );
}
