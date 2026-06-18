"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";

/** Bottom-sheet style exercise picker with search and quick-add of custom exercises. */
export function ExercisePicker({
  onPick,
  onClose,
}: {
  onPick: (exerciseId: string) => void;
  onClose: () => void;
}) {
  const exercises = useStore((s) => s.exercises);
  const addExercise = useStore((s) => s.addExercise);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return exercises
      .filter((e) => !needle || e.name.toLowerCase().includes(needle))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [exercises, q]);

  const createAndPick = () => {
    const name = q.trim();
    if (!name) return;
    const ex = addExercise({
      name,
      primaryMuscle: null,
      equipment: null,
      isCompound: false,
    });
    onPick(ex.id);
  };

  return (
    <div className="fixed inset-0 z-30 flex items-end bg-black/60" onClick={onClose}>
      <div
        className="mx-auto w-full max-w-md rounded-t-3xl border-t border-border bg-surface p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search or add an exercise…"
          className="input mb-3"
        />
        <ul className="max-h-[50dvh] space-y-1 overflow-y-auto">
          {filtered.map((e) => (
            <li key={e.id}>
              <button
                onClick={() => onPick(e.id)}
                className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left hover:bg-surface2"
              >
                <span className="font-medium">{e.name}</span>
                <span className="text-xs text-muted">
                  {e.primaryMuscle ?? ""} {e.isCompound ? "· compound" : ""}
                </span>
              </button>
            </li>
          ))}
          {q.trim() && !filtered.some((e) => e.name.toLowerCase() === q.trim().toLowerCase()) && (
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
