"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronRight, Plus, Search, X } from "lucide-react";
import { DeviceAvatar } from "@/components/DeviceAvatar";
import { exerciseTypeOf } from "@/domain/exerciseType";
import {
  EQUIPMENT,
  EXERCISE_TYPES,
  MUSCLES,
  MUSCLE_GROUPS,
  label,
  muscleGroupOf,
  type Equipment,
  type ExerciseType,
  type Muscle,
  type MuscleGroup,
} from "@/domain/taxonomy";
import { useStore } from "@/lib/store";
import type { Device, Exercise } from "@/domain/types";

/** Library device a custom exercise defaults to, by equipment. */
const DEVICE_FOR_EQUIPMENT: Partial<Record<Equipment, string>> = {
  barbell: "d-bb",
  dumbbell: "d-db",
  kettlebell: "d-kb",
  cable: "d-cable",
  smith: "d-smith",
  ez_bar: "d-ez",
  trap_bar: "d-trap",
  band: "d-band",
};

const EQUIPMENT_FROM_DEVICE: Record<Device["category"], Equipment> = {
  machine: "machine",
  free_weight: "other",
  cable: "cable",
  bodyweight: "bodyweight",
  cardio: "cardio_machine",
};

export function equipmentOf(ex: Exercise, device?: Device): Equipment {
  return ex.equipment ?? (device ? EQUIPMENT_FROM_DEVICE[device.category] : "other");
}

/**
 * Searchable, filterable exercise list shared by the picker sheet and the
 * Exercises page. Recently used exercises float to the top when not searching.
 */
export function ExerciseBrowser({
  onSelect,
  onCreated,
  hrefFor,
  autoFocus,
  allowCreate = true,
}: {
  onSelect?: (exerciseId: string) => void;
  onCreated?: (exerciseId: string) => void;
  hrefFor?: (exerciseId: string) => string;
  autoFocus?: boolean;
  allowCreate?: boolean;
}) {
  const exercises = useStore((s) => s.exercises);
  const devices = useStore((s) => s.devices);
  const sessions = useStore((s) => s.sessions);
  const sets = useStore((s) => s.sets);
  const recentExerciseIds = useStore((s) => s.recentExerciseIds);
  // Selector returns a fresh array, so derive it from the data it depends on.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const recentIds = useMemo(() => recentExerciseIds(6), [sessions, sets]);
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<MuscleGroup | "all">("all");
  const [equipment, setEquipment] = useState<Equipment | "all">("all");
  const [creating, setCreating] = useState(false);

  const deviceOf = useMemo(() => {
    const map = new Map(devices.map((d) => [d.id, d]));
    return (ex: Exercise) => (ex.defaultDeviceId ? map.get(ex.defaultDeviceId) : undefined);
  }, [devices]);

  const needle = q.trim().toLowerCase();
  const filtered = useMemo(() => {
    const words = needle.split(/\s+/).filter(Boolean);
    return exercises
      .filter((e) => group === "all" || muscleGroupOf(e.primaryMuscle) === group)
      .filter((e) => equipment === "all" || equipmentOf(e, deviceOf(e)) === equipment)
      .filter((e) => {
        if (!words.length) return true;
        const hay = `${e.name} ${e.primaryMuscle ?? ""} ${(e.secondaryMuscles ?? []).join(" ")} ${deviceOf(e)?.name ?? ""}`.toLowerCase();
        return words.every((w) => hay.includes(w));
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [exercises, needle, group, equipment, deviceOf]);

  const recents = useMemo(
    () =>
      needle || group !== "all" || equipment !== "all"
        ? []
        : (recentIds.map((id) => exercises.find((e) => e.id === id)).filter(Boolean) as Exercise[]),
    [recentIds, exercises, needle, group, equipment],
  );

  const usedEquipment = useMemo(() => {
    const seen = new Set(exercises.map((e) => equipmentOf(e, deviceOf(e))));
    return EQUIPMENT.filter((x) => seen.has(x.key));
  }, [exercises, deviceOf]);

  if (creating) {
    return (
      <CreateExerciseForm
        initialName={q.trim()}
        onCancel={() => setCreating(false)}
        onCreated={(id) => {
          setCreating(false);
          (onCreated ?? onSelect)?.(id);
        }}
      />
    );
  }

  const row = (e: Exercise) => (
    <ExerciseRow key={e.id} exercise={e} device={deviceOf(e)} onSelect={onSelect} href={hrefFor?.(e.id)} />
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
        <input
          aria-label="Search exercises"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Search ${exercises.length} exercises…`}
          className="input pl-10 pr-10"
          inputMode="search"
          autoFocus={autoFocus}
        />
        {q && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => setQ("")}
            className="absolute right-1 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-control text-muted hover:text-ink"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="-mx-1 flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-1 pb-1" style={{ scrollbarWidth: "none" }}>
          {[{ key: "all" as const, label: "All" }, ...MUSCLE_GROUPS].map((g) => (
            <button
              key={g.key}
              type="button"
              aria-pressed={group === g.key}
              onClick={() => setGroup(g.key)}
              className={`min-h-11 shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                group === g.key
                  ? "border-accentFill bg-accentFill text-onAccent"
                  : "border-border bg-surface2 text-inkSoft hover:text-ink"
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
        <select
          aria-label="Equipment"
          value={equipment}
          onChange={(e) => setEquipment(e.target.value as Equipment | "all")}
          className="min-h-11 shrink-0 rounded-control border border-border bg-surface2 px-3 py-1.5 text-sm text-inkSoft"
        >
          <option value="all">All equipment</option>
          {usedEquipment.map((x) => (
            <option key={x.key} value={x.key}>
              {x.label}
            </option>
          ))}
        </select>
      </div>

      <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
        {recents.length > 0 && (
          <>
            <p className="section-label mb-1 mt-1">Recent</p>
            <ul className="mb-3 divide-y divide-border">{recents.map(row)}</ul>
            <p className="section-label mb-1">All exercises</p>
          </>
        )}
        <ul className="divide-y divide-border">{filtered.map(row)}</ul>
        {filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-muted">No exercises match these filters.</p>
        )}
        {allowCreate && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-control border border-dashed border-border py-3 text-sm font-semibold text-accent hover:bg-accent/[0.05]"
          >
            <Plus className="h-4 w-4" aria-hidden />
            {needle ? `Create “${q.trim()}”` : "Create custom exercise"}
          </button>
        )}
      </div>
    </div>
  );
}

function ExerciseRow({
  exercise: e,
  device,
  onSelect,
  href,
}: {
  exercise: Exercise;
  device?: Device;
  onSelect?: (id: string) => void;
  href?: string;
}) {
  const eq = EQUIPMENT.find((x) => x.key === equipmentOf(e, device))?.label;
  const content = (
    <>
      <DeviceAvatar device={device} className="h-10 w-10 rounded-control text-sm" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-ink">
          {e.name}
          {e.owner && <span className="badge-neutral ml-2 align-middle text-[10px]">Custom</span>}
        </span>
        <span className="block truncate text-xs text-muted">
          {[e.primaryMuscle && label(e.primaryMuscle), eq, device?.machineNumber && `No. ${device.machineNumber}`]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </span>
      {onSelect ? (
        <Plus className="h-5 w-5 shrink-0 text-accent" aria-hidden />
      ) : (
        <ChevronRight className="h-5 w-5 shrink-0 text-muted" aria-hidden />
      )}
    </>
  );
  const cls = "flex w-full items-center gap-3 px-1 py-2.5 text-left transition-colors hover:bg-surface2/60 rounded-control";
  if (onSelect)
    return (
      <li>
        <button type="button" className={cls} onClick={() => onSelect(e.id)}>
          {content}
        </button>
      </li>
    );
  return (
    <li>
      <Link href={href ?? "#"} className={cls}>
        {content}
      </Link>
    </li>
  );
}

export function CreateExerciseForm({
  initialName = "",
  onCreated,
  onCancel,
}: {
  initialName?: string;
  onCreated: (exerciseId: string) => void;
  onCancel: () => void;
}) {
  const addExercise = useStore((s) => s.addExercise);
  const exercises = useStore((s) => s.exercises);
  const [name, setName] = useState(initialName);
  const [type, setType] = useState<ExerciseType>("weight_reps");
  const [equipment, setEquipment] = useState<Equipment>("machine");
  const [muscle, setMuscle] = useState<Muscle>("chest");
  const [compound, setCompound] = useState(false);
  const trimmed = name.trim();
  const duplicate = exercises.some((e) => e.name.toLowerCase() === trimmed.toLowerCase());

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!trimmed || duplicate) return;
    const ex = addExercise({
      name: trimmed,
      type,
      equipment,
      defaultDeviceId: DEVICE_FOR_EQUIPMENT[equipment] ?? null,
      isCompound: compound,
      primaryMuscle: muscle,
      secondaryMuscles: [],
      mode: type === "duration" ? "time" : undefined,
    });
    onCreated(ex.id);
  };

  const field = "w-full rounded-control border border-border bg-surface2 px-3 py-2.5 text-sm text-ink";
  return (
    <form onSubmit={submit} className="space-y-4">
      <h3 className="text-h3 text-ink">New exercise</h3>
      <div className="space-y-1.5">
        <label htmlFor="new-ex-name" className="text-xs font-medium text-muted">
          Name
        </label>
        <input
          id="new-ex-name"
          className="input"
          value={name}
          autoFocus
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Single-arm Cable Row"
        />
        {duplicate && <p className="text-xs text-danger">An exercise with this name already exists.</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1.5 text-xs font-medium text-muted">
          <span>Logged as</span>
          <select className={field} value={type} onChange={(e) => setType(e.target.value as ExerciseType)}>
            {EXERCISE_TYPES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5 text-xs font-medium text-muted">
          <span>Equipment</span>
          <select className={field} value={equipment} onChange={(e) => setEquipment(e.target.value as Equipment)}>
            {EQUIPMENT.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5 text-xs font-medium text-muted">
          <span>Main muscle</span>
          <select className={field} value={muscle} onChange={(e) => setMuscle(e.target.value as Muscle)}>
            {MUSCLES.map((m) => (
              <option key={m} value={m}>
                {label(m)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-end gap-2 pb-2.5 text-sm text-inkSoft">
          <input
            type="checkbox"
            checked={compound}
            onChange={(e) => setCompound(e.target.checked)}
            className="h-4 w-4 accent-accent"
          />
          Multi-joint lift
        </label>
      </div>
      <div className="flex gap-2">
        <button type="button" className="btn-ghost flex-1" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn-primary flex-1" disabled={!trimmed || duplicate}>
          Create
        </button>
      </div>
    </form>
  );
}

/** Logging-type label for an exercise, for detail pages. */
export function exerciseTypeLabel(ex: Exercise | undefined, device?: Device): string {
  const t = exerciseTypeOf(ex, device);
  return EXERCISE_TYPES.find((x) => x.key === t)?.label ?? "";
}
