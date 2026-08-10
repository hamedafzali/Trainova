"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ExercisePicker } from "@/components/ExercisePicker";
import { DeviceAvatar } from "@/components/DeviceAvatar";
import { Stepper } from "@/components/Stepper";
import { plateIncrement } from "@/domain/progression";
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

  if (!hydrated) return <main className="p-4 text-white/50">Loading…</main>;
  if (!template) {
    return (
      <main className="mx-auto max-w-2xl space-y-3 p-4">
        <p className="text-white/50">Plan not found.</p>
        <Link href="/templates" className="text-blue-400 hover:text-blue-300">
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
    <main className="mx-auto max-w-2xl space-y-6 p-4 pb-20">
      <header className="flex items-center justify-between pt-2">
        <div>
          <Link
            href="/templates"
            className="text-sm text-white/50 hover:text-white/70 transition-colors"
          >
            ← Plans
          </Link>
          <h1 className="page-title">{template.name}</h1>
        </div>
        <button
          className="btn-primary py-3 px-6 text-base font-semibold"
          onClick={start}
        >
          Start
        </button>
      </header>

      {template.exercises.length === 0 ? (
        <div className="card text-center py-8 text-base text-white/50">
          No exercises yet.
        </div>
      ) : (
        <ul className="space-y-3">
          {template.exercises.map((te) => {
            const ex = exerciseById(te.exerciseId);
            const device = deviceById(te.deviceId ?? ex?.defaultDeviceId);
            const step = plateIncrement(units);
            return (
              <li key={te.id} className="card space-y-3">
                <div className="flex items-center gap-3">
                  <DeviceAvatar
                    device={device}
                    className="h-10 w-10 rounded-lg text-sm"
                  />
                  <div className="flex-1">
                    <p className="font-semibold text-base leading-tight">
                      {ex?.name ?? "Exercise"}
                    </p>
                    {device && (
                      <p className="text-sm text-white/50">
                        {device.name}
                        {device.machineNumber
                          ? ` · No.${device.machineNumber}`
                          : ""}
                      </p>
                    )}
                  </div>
                  <button
                    className="btn-danger px-3 py-2 text-sm"
                    onClick={() => removeTemplateExercise(template.id, te.id)}
                  >
                    ✕
                  </button>
                </div>

                {/* Per-round target weight (each round can differ — a ramp) */}
                <div className="space-y-2">
                  {te.sets.map((st, i) => (
                    <div key={i} className="space-y-1">
                      <p className="text-sm text-white/50">Round {i + 1}</p>
                      <Stepper
                        value={st.targetWeight ?? 0}
                        step={step}
                        unit={units}
                        onChange={(v) =>
                          updateTemplateSet(template.id, te.id, i, {
                            targetWeight: v || null,
                          })
                        }
                      />
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-center gap-3 text-base">
                  <button
                    className="btn-ghost px-4 py-2 text-sm font-semibold"
                    onClick={() =>
                      setTemplateSetCount(
                        template.id,
                        te.id,
                        te.sets.length - 1,
                      )
                    }
                  >
                    − round
                  </button>
                  <span className="text-white/50 font-medium">
                    {te.sets.length} rounds
                  </span>
                  <button
                    className="btn-ghost px-4 py-2 text-sm font-semibold"
                    onClick={() =>
                      setTemplateSetCount(
                        template.id,
                        te.id,
                        te.sets.length + 1,
                      )
                    }
                  >
                    + round
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <button
        className="btn-ghost w-full py-4 text-base font-semibold"
        onClick={() => setPicking(true)}
      >
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
