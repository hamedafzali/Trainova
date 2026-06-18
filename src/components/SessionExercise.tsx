"use client";

import { useMemo } from "react";
import { SetRow } from "@/components/SetRow";
import { suggestNextLoad } from "@/domain/progression";
import { useStore } from "@/lib/store";
import { DeviceAvatar } from "@/components/DeviceAvatar";
import type { WorkoutSet } from "@/domain/types";

/** All sets for a single exercise within a session, plus its suggestion. */
export function SessionExercise({
  sessionId,
  exerciseId,
  sets,
  readOnly = false,
  onPr,
}: {
  sessionId: string;
  exerciseId: string;
  sets: WorkoutSet[];
  readOnly?: boolean;
  onPr: (kinds: string[]) => void;
}) {
  const units = useStore((s) => s.units);
  const exerciseById = useStore((s) => s.exerciseById);
  const deviceById = useStore((s) => s.deviceById);
  const addSet = useStore((s) => s.addSet);
  const updateSet = useStore((s) => s.updateSet);
  const lastPerformance = useStore((s) => s.lastPerformance);
  const missStreak = useStore((s) => s.missStreak);

  const ex = exerciseById(exerciseId);
  const device = deviceById(sets[0]?.deviceId ?? ex?.defaultDeviceId);

  const last = useMemo(
    () => lastPerformance(exerciseId, sessionId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [exerciseId, sessionId]
  );

  const suggestion = useMemo(() => {
    const targetReps = sets[0]?.targetReps ?? last?.targetReps ?? 8;
    return suggestNextLoad(last, units, {
      isCompound: ex?.isCompound ?? true,
      templateWeight: sets[0]?.targetWeight ?? null,
      missStreak: missStreak(exerciseId, targetReps),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseId, sessionId, units, sets.length]);

  const restSeconds = ex?.isCompound ? 120 : 90;
  const done = sets.filter((s) => s.completed).length;

  const fillEmpty = () => {
    for (const s of sets) {
      if (s.completed) continue;
      updateSet(s.id, {
        actualWeight: s.actualWeight ?? (suggestion.weight || null),
        actualReps: s.actualReps ?? suggestion.reps,
      });
    }
  };

  return (
    <section className="card space-y-2">
      <div className="flex items-center gap-2.5">
        <DeviceAvatar device={device} className="h-10 w-10 rounded-lg text-sm" />
        <div className="flex-1">
          <h3 className="font-semibold leading-tight">{ex?.name ?? "Exercise"}</h3>
          {device && (
            <p className="text-[11px] text-muted">
              {device.name}
              {device.machineNumber ? ` · No.${device.machineNumber}` : ""}
            </p>
          )}
        </div>
        <span className="text-xs text-muted">
          {done}/{sets.length}
        </span>
      </div>

      {!readOnly && (
        <button
          onClick={fillEmpty}
          className="w-full rounded-lg bg-accentDim/30 px-3 py-2 text-left text-xs text-accent active:scale-[0.99]"
        >
          💡 <b>{suggestion.weight || "—"}{suggestion.weight ? units : ""}</b> × {suggestion.reps}
          <span className="text-accent/70"> — tap to fill · {suggestion.reason}</span>
        </button>
      )}

      <div className="flex items-center gap-2 px-1 text-[10px] uppercase tracking-wide text-muted">
        <span className="w-5 text-center">#</span>
        <span className="w-14 shrink-0 text-center">Prev</span>
        <span className="flex-1 text-center">{units}</span>
        <span className="w-3" />
        <span className="flex-1 text-center">Reps</span>
        <span className="w-[88px]" />
      </div>

      <div className="divide-y divide-border/60">
        {sets.map((s) => (
          <SetRow
            key={s.id}
            set={s}
            restSeconds={restSeconds}
            previous={
              last?.sets[s.setIndex]
                ? {
                    weight: last.sets[s.setIndex].actualWeight,
                    reps: last.sets[s.setIndex].actualReps,
                  }
                : undefined
            }
            onPr={onPr}
          />
        ))}
      </div>

      {!readOnly && (
        <button className="btn-ghost w-full" onClick={() => addSet(sessionId, exerciseId)}>
          + Add set
        </button>
      )}
    </section>
  );
}
