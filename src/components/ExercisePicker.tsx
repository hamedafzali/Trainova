"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { DeviceAvatar } from "@/components/DeviceAvatar";
import { muscleColor } from "@/lib/format";
import type { Device, DeviceCategory, Exercise } from "@/domain/types";

const CATEGORIES: { key: DeviceCategory | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "machine", label: "Machines" },
  { key: "free_weight", label: "Free weight" },
  { key: "cable", label: "Cable" },
  { key: "bodyweight", label: "Bodyweight" },
];

/**
 * Structured device/exercise library. Visual cards (badge + name + category),
 * searchable, with recents up top. Returns an exerciseId; the device comes from
 * the exercise's structured link, never typed text.
 */
export function ExercisePicker({
  onPick,
  onClose,
}: {
  onPick: (exerciseId: string) => void;
  onClose: () => void;
}) {
  const exercises = useStore((s) => s.exercises);
  const devices = useStore((s) => s.devices);
  const addExercise = useStore((s) => s.addExercise);
  const recentIds = useStore((s) => s.recentExerciseIds(8));
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<DeviceCategory | "all">("all");

  const deviceOf = useMemo(() => {
    const map = new Map<string, Device>();
    for (const d of devices) map.set(d.id, d);
    return (ex: Exercise) => (ex.defaultDeviceId ? map.get(ex.defaultDeviceId) : undefined);
  }, [devices]);

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
      .filter((e) => cat === "all" || deviceOf(e)?.category === cat)
      .filter((e) => !needle || e.name.toLowerCase().includes(needle))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [exercises, q, cat, deviceOf]);

  const createAndPick = () => {
    const name = q.trim();
    if (!name) return;
    const ex = addExercise({
      name,
      defaultDeviceId: null,
      isCompound: false,
      primaryMuscle: null,
    });
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
          placeholder="Search device or exercise…"
          className="input mb-3"
          inputMode="search"
        />

        {recents.length > 0 && !q.trim() && (
          <div className="mb-3">
            <p className="mb-1.5 text-xs uppercase tracking-wide text-muted">Recently used</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {recents.map((e) => (
                <button
                  key={e.id}
                  onClick={() => onPick(e.id)}
                  className="flex w-16 shrink-0 flex-col items-center gap-1 rounded-xl border border-border bg-surface2 p-2 active:scale-95"
                >
                  <DeviceAvatar device={deviceOf(e)} />
                  <span className="line-clamp-1 text-[10px] text-inkSoft">{e.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              onClick={() => setCat(c.key)}
              className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs ${
                cat === c.key ? "border-accent bg-accent text-onAccent" : "border-border bg-surface2 text-inkSoft"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Swipe carousel of device cards (drag left/right with a finger). */}
        <div
          className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2"
          style={{ touchAction: "pan-x" }}
        >
          {filtered.map((e) => {
            const d = deviceOf(e);
            return (
              <button
                key={e.id}
                onClick={() => onPick(e.id)}
                className="flex w-32 shrink-0 snap-start flex-col gap-2 rounded-2xl border border-border bg-surface2 p-3 text-left active:scale-[0.98]"
              >
                <DeviceAvatar device={d} className="h-20 w-full rounded-xl text-3xl" />
                <span className="block truncate font-semibold leading-tight text-ink">{e.name}</span>
                <span className="flex items-center gap-1.5 text-[11px] text-muted">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: muscleColor(e.primaryMuscle) }}
                  />
                  {d?.machineNumber ? `No.${d.machineNumber}` : e.primaryMuscle ?? d?.category.replace("_", " ") ?? "—"}
                </span>
              </button>
            );
          })}
          {q.trim() && !filtered.some((e) => e.name.toLowerCase() === q.trim().toLowerCase()) && (
            <button
              onClick={createAndPick}
              className="flex w-32 shrink-0 snap-start flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-border bg-surface p-3 text-center text-sm text-inkSoft active:scale-[0.98]"
            >
              <span className="text-2xl">＋</span>
              Create “{q.trim()}”
            </button>
          )}
          {filtered.length === 0 && !q.trim() && (
            <p className="px-2 py-6 text-sm text-muted">No devices in this group.</p>
          )}
        </div>
        <p className="pt-1 text-center text-[11px] text-muted">← swipe to browse →</p>
      </div>
    </div>
  );
}
