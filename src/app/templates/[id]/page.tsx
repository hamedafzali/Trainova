"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ExercisePicker } from "@/components/ExercisePicker";
import { DeviceAvatar } from "@/components/DeviceAvatar";
import { useHydrated, useStore } from "@/lib/store";

export default function TemplateEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const hydrated = useHydrated();

  const template = useStore((s) => s.templates.find((t) => t.id === id));
  const exerciseById = useStore((s) => s.exerciseById);
  const deviceById = useStore((s) => s.deviceById);
  const units = useStore((s) => s.units);
  const addTemplateExercise = useStore((s) => s.addTemplateExercise);
  const removeTemplateExercise = useStore((s) => s.removeTemplateExercise);
  const setTemplateSetCount = useStore((s) => s.setTemplateSetCount);
  const updateTemplateSet = useStore((s) => s.updateTemplateSet);
  const startSession = useStore((s) => s.startSession);
  const getActiveSession = useStore((s) => s.getActiveSession);
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

  const start = () => {
    const { id: sid, blocked } = startSession(template.id);
    if (blocked) {
      const a = getActiveSession();
      if (a) router.push(`/session/${a.id}`);
      return;
    }
    if (sid) router.push(`/session/${sid}`);
  };

  const num = (v: string) => (v === "" ? null : Number(v));

  return (
    <main className="space-y-4 p-4">
      <header className="flex items-center justify-between pt-2">
        <div>
          <Link href="/templates" className="text-sm text-muted">
            ← Plans
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">{template.name}</h1>
        </div>
        <button className="btn-primary" onClick={start}>
          Start
        </button>
      </header>

      {template.exercises.length === 0 ? (
        <div className="card text-center text-muted">No exercises yet.</div>
      ) : (
        <ul className="space-y-2">
          {template.exercises.map((te) => {
            const ex = exerciseById(te.exerciseId);
            const device = deviceById(te.deviceId ?? ex?.defaultDeviceId);
            return (
              <li key={te.id} className="card space-y-2">
                <div className="flex items-center gap-2.5">
                  <DeviceAvatar device={device} className="h-10 w-10 rounded-lg text-sm" />
                  <div className="flex-1">
                    <p className="font-semibold leading-tight">{ex?.name ?? "Exercise"}</p>
                    {device && (
                      <p className="text-[11px] text-muted">
                        {device.name}
                        {device.machineNumber ? ` · No.${device.machineNumber}` : ""}
                      </p>
                    )}
                  </div>
                  <button
                    className="btn-danger"
                    onClick={() => removeTemplateExercise(template.id, te.id)}
                  >
                    ✕
                  </button>
                </div>

                {/* Per-set targets (supports ramps) */}
                <div className="space-y-1">
                  {te.sets.map((st, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-5 text-center text-xs text-muted">{i + 1}</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        className="num flex-1"
                        placeholder={units}
                        value={st.targetWeight ?? ""}
                        onChange={(e) =>
                          updateTemplateSet(template.id, te.id, i, {
                            targetWeight: num(e.target.value),
                          })
                        }
                      />
                      <span className="text-muted">×</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        className="num flex-1"
                        placeholder="reps"
                        value={st.targetReps ?? ""}
                        onChange={(e) =>
                          updateTemplateSet(template.id, te.id, i, {
                            targetReps: Number(e.target.value || 0),
                          })
                        }
                      />
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-center gap-3 text-sm">
                  <button
                    className="btn-ghost px-3 py-1"
                    onClick={() => setTemplateSetCount(template.id, te.id, te.sets.length - 1)}
                  >
                    − set
                  </button>
                  <span className="text-muted">{te.sets.length} sets</span>
                  <button
                    className="btn-ghost px-3 py-1"
                    onClick={() => setTemplateSetCount(template.id, te.id, te.sets.length + 1)}
                  >
                    + set
                  </button>
                </div>
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
