"use client";

import { useMemo, useRef, useState } from "react";
import { SessionExercise } from "@/components/SessionExercise";
import { useStore } from "@/lib/store";
import type { WorkoutSet } from "@/domain/types";

/**
 * One exercise per screen; swipe left/right between them (CSS scroll-snap). A
 * pager + ‹ › buttons + a contextual "Next" keep the flow fast and one-handed.
 */
export function WorkoutCarousel({
  sessionId,
  exerciseIds,
  sets,
  readOnly = false,
  editable = false,
  onPr,
}: {
  sessionId: string;
  exerciseIds: string[];
  sets: WorkoutSet[];
  readOnly?: boolean;
  editable?: boolean;
  onPr: (kinds: string[]) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);
  const exerciseById = useStore((s) => s.exerciseById);

  const setsByExercise = useMemo(() => {
    const m = new Map<string, WorkoutSet[]>();
    for (const id of exerciseIds) m.set(id, []);
    for (const s of sets) m.get(s.exerciseId)?.push(s);
    return m;
  }, [exerciseIds, sets]);

  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== idx) setIdx(i);
  };

  const go = (i: number) => {
    const el = ref.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(exerciseIds.length - 1, i));
    el.scrollTo({ left: clamped * el.clientWidth, behavior: "smooth" });
  };

  const currentSets = setsByExercise.get(exerciseIds[idx]) ?? [];
  const currentDone =
    currentSets.length > 0 && currentSets.every((s) => s.completed);
  const hasNext = idx < exerciseIds.length - 1;

  return (
    <div className="space-y-5">
      {/* pager */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => go(idx - 1)}
          disabled={idx === 0}
          className="flex h-14 w-14 items-center justify-center rounded-control bg-surface2 text-2xl text-ink transition-transform disabled:opacity-30 active:scale-95"
          aria-label="previous exercise"
        >
          ‹
        </button>
        <div className="flex items-center gap-2">
          {exerciseIds.map((id, i) => {
            const done =
              (setsByExercise.get(id) ?? []).every((s) => s.completed) &&
              (setsByExercise.get(id) ?? []).length > 0;
            return (
              <button
                key={id}
                onClick={() => go(i)}
                aria-label={`exercise ${i + 1}`}
                className={`h-2 rounded-full transition-all ${
                  i === idx
                    ? "w-8 bg-accent"
                    : done
                      ? "w-2 bg-green"
                      : "w-2 bg-border"
                }`}
              />
            );
          })}
        </div>
        <button
          onClick={() => go(idx + 1)}
          disabled={!hasNext}
          className="flex h-14 w-14 items-center justify-center rounded-control bg-surface2 text-2xl text-ink transition-transform disabled:opacity-30 active:scale-95"
          aria-label="next exercise"
        >
          ›
        </button>
      </div>

      <p className="text-center text-sm text-muted font-medium">
        {exerciseById(exerciseIds[idx])?.name} · {idx + 1} of{" "}
        {exerciseIds.length}
      </p>

      {/* slides */}
      <div
        ref={ref}
        onScroll={onScroll}
        className="flex snap-x snap-mandatory overflow-x-auto"
        style={{ touchAction: "pan-x", scrollbarWidth: "none" }}
      >
        {exerciseIds.map((exId) => (
          <div key={exId} className="w-full shrink-0 snap-center pr-0.5">
            <SessionExercise
              sessionId={sessionId}
              exerciseId={exId}
              sets={setsByExercise.get(exId) ?? []}
              readOnly={readOnly}
              editable={editable}
              onPr={onPr}
            />
          </div>
        ))}
      </div>

      {!readOnly && currentDone && hasNext && (
        <button
          className="btn-primary w-full py-4 text-base font-semibold transition-transform active:scale-[0.99]"
          onClick={() => go(idx + 1)}
        >
          Next exercise →
        </button>
      )}
    </div>
  );
}
