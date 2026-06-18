"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { cleanName, exerciseBadge, machineNo } from "@/lib/format";
import type { Exercise } from "@/domain/types";

/**
 * Fast device/exercise selector. Optimised for "tap the machine I always use":
 *  - Recently-used machines surface first as big buttons.
 *  - Muscle-group chips narrow the list in one tap.
 *  - Each row shows the machine number as a badge so it matches the gym floor.
 */
export function ExercisePicker({
  onPick,
  onClose,
}: {
  onPick: (exerciseId: string) => void;
  onClose: () => void;
}) {
  const exercises = useStore((s) => s.exercises);
  const addExercise = useStore((s) => s.addExercise);
  const recentIds = useStore((s) => s.recentExerciseIds(8));
  const [q, setQ] = useState("");
  const [muscle, setMuscle] = useState<string | null>(null);

  const muscles = useMemo(() => {
    const set = new Set<string>();
    for (const e of exercises) if (e.primaryMuscle) set.add(e.primaryMuscle);
    return [...set].sort();
  }, [exercises]);

  const recents = useMemo(
    () =>
      recentIds
        .map((id) => exercises.find((e) => e.id === id))
        .filter((e): e is Exercise => Boolean(e)),
    [recentIds, exercises]
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return exercises
      .filter((e) => !muscle || e.primaryMuscle === muscle)
      .filter((e) => !needle || e.name.toLowerCase().includes(needle))
      .sort((a, b) => cleanName(a.name).localeCompare(cleanName(b.name)));
  }, [exercises, q, muscle]);

  const createAndPick = () => {
    const name = q.trim();
    if (!name) return;
    const ex = addExercise({ name, primaryMuscle: muscle, equipment: null, isCompound: false });
    onPick(ex.id);
  };

  return (
    <div className="fixed inset-0 z-30 flex items-end bg-black/60" onClick={onClose}>
      <div
        className="mx-auto flex max-h-[85dvh] w-full max-w-md flex-col rounded-t-3xl border-t border-border bg-surface p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />

        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search machine or exercise…"
          className="input mb-3"
          inputMode="search"
        />

        {recents.length > 0 && !q.trim() && (
          <div className="mb-3">
            <p className="mb-1.5 text-xs uppercase tracking-wide text-muted">Recent</p>
            <div className="grid grid-cols-4 gap-2">
              {recents.map((e) => (
                <button
                  key={e.id}
                  onClick={() => onPick(e.id)}
                  className="flex flex-col items-center gap-1 rounded-xl border border-border bg-surface2 p-2 active:scale-95"
                >
                  <Badge ex={e} />
                  <span className="line-clamp-1 text-[10px] text-muted">{cleanName(e.name)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
          <Chip active={muscle === null} onClick={() => setMuscle(null)}>
            All
          </Chip>
          {muscles.map((m) => (
            <Chip key={m} active={muscle === m} onClick={() => setMuscle(m)}>
              {m}
            </Chip>
          ))}
        </div>

        <ul className="flex-1 space-y-1 overflow-y-auto">
          {filtered.map((e) => (
            <li key={e.id}>
              <button
                onClick={() => onPick(e.id)}
                className="flex w-full items-center gap-3 rounded-2xl bg-surface2 px-3 py-3 text-left active:scale-[0.99]"
              >
                <Badge ex={e} />
                <span className="flex-1">
                  <span className="block font-semibold leading-tight">{cleanName(e.name)}</span>
                  <span className="text-xs text-muted">
                    {e.primaryMuscle ?? "—"}
                    {e.isCompound ? " · compound" : ""}
                  </span>
                </span>
              </button>
            </li>
          ))}
          {q.trim() &&
            !filtered.some((e) => e.name.toLowerCase() === q.trim().toLowerCase()) && (
              <li>
                <button onClick={createAndPick} className="btn-ghost w-full">
                  + Create “{q.trim()}”
                </button>
              </li>
            )}
        </ul>
      </div>
    </div>
  );
}

function Badge({ ex }: { ex: Exercise }) {
  const no = machineNo(ex.name);
  return (
    <span
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-base font-bold ${
        no ? "bg-accent text-black" : "bg-border text-white"
      }`}
    >
      {exerciseBadge(ex)}
    </span>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs capitalize ${
        active ? "border-accent bg-accent text-black" : "border-border bg-surface2 text-muted"
      }`}
    >
      {children}
    </button>
  );
}
