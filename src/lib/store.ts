"use client";

import { useEffect, useState } from "react";
import { create } from "zustand";
import { persist, createJSONStorage, type StateStorage } from "zustand/middleware";
import type {
  Device,
  Exercise,
  PersonalRecord,
  Program,
  TemplateSet,
  Units,
  WorkoutSession,
  WorkoutSet,
  WorkoutTemplate,
} from "@/domain/types";
import { detectPrs, epley1rm } from "@/domain/progression";
import type { LastPerformance } from "@/domain/progression";
import {
  activeSession,
  canCreateSession,
  canReopen,
  dayKey,
  isAbandoned,
} from "@/domain/session";
import {
  SEED_DEVICES,
  SEED_EXERCISES,
  SEED_PLAN,
  SEED_PLAN_ID,
  SEED_PROGRAM,
  SEED_PROGRAM_ID,
  SEED_SESSION,
  SEED_SESSION_SETS,
} from "./seed";
import { stripDate } from "./format";
import { uid } from "./id";

const LOCAL_OWNER = "local-user";

/** No-op storage used during SSR where window/localStorage is unavailable. */
const memoryStorage: StateStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

export interface TrainovaState {
  units: Units;
  devices: Device[];
  exercises: Exercise[];
  programs: Program[];
  templates: WorkoutTemplate[];
  sessions: WorkoutSession[];
  sets: WorkoutSet[];
  prs: PersonalRecord[];

  setUnits: (u: Units) => void;
  addDevice: (input: Omit<Device, "id" | "owner">) => Device;
  addExercise: (input: Omit<Exercise, "id" | "owner">) => Exercise;

  createProgram: (name: string, source?: Program["source"]) => string;
  deleteProgram: (id: string) => void;
  addDayToProgram: (programId: string, name: string) => string;
  removeDayFromProgram: (programId: string, templateId: string) => void;

  createTemplate: (name: string) => string;
  deleteTemplate: (id: string) => void;
  addTemplateExercise: (templateId: string, exerciseId: string) => void;
  removeTemplateExercise: (templateId: string, templateExerciseId: string) => void;
  setTemplateSetCount: (templateId: string, templateExerciseId: string, count: number) => void;
  updateTemplateSet: (
    templateId: string,
    templateExerciseId: string,
    setIndex: number,
    patch: Partial<TemplateSet>
  ) => void;

  // session lifecycle (see domain/session.ts)
  startSession: (templateId: string | null) => { id: string | null; blocked: boolean };
  finishSession: (id: string) => { discarded: boolean };
  discardSession: (id: string) => void;
  reopenSession: (id: string) => boolean;
  archiveSession: (id: string) => void;
  unarchiveSession: (id: string) => void;

  addSet: (sessionId: string, exerciseId: string) => string;
  updateSet: (setId: string, patch: Partial<WorkoutSet>) => void;
  completeSet: (setId: string) => { newPrs: PersonalRecord["kind"][] };
  removeSet: (setId: string) => void;

  // selectors
  getActiveSession: () => WorkoutSession | null;
  deviceById: (id: string | null | undefined) => Device | undefined;
  exerciseById: (id: string) => Exercise | undefined;
  deviceForExercise: (exerciseId: string) => Device | undefined;
  programById: (id: string) => Program | undefined;
  daysForProgram: (id: string) => WorkoutTemplate[];
  trainedDays: () => Set<string>;
  recentExerciseIds: (limit?: number) => string[];
  setsForSession: (sessionId: string) => WorkoutSet[];
  lastPerformance: (exerciseId: string, beforeSessionId?: string) => LastPerformance | null;
  missStreak: (exerciseId: string, targetReps: number) => number;
  bestsFor: (exerciseId: string) => { e1rm: number; maxWeight: number; maxReps: number };
}

const now = () => new Date().toISOString();

export const useStore = create<TrainovaState>()(
  persist(
    (set, get) => ({
      units: "kg",
      devices: SEED_DEVICES,
      exercises: SEED_EXERCISES,
      programs: [SEED_PROGRAM],
      templates: [SEED_PLAN],
      sessions: [SEED_SESSION],
      sets: [...SEED_SESSION_SETS],
      prs: [],

      setUnits: (u) => set({ units: u }),

      addDevice: (input) => {
        const d: Device = { ...input, id: uid(), owner: LOCAL_OWNER };
        set((s) => ({ devices: [...s.devices, d] }));
        return d;
      },

      addExercise: (input) => {
        const ex: Exercise = { ...input, id: uid(), owner: LOCAL_OWNER };
        set((s) => ({ exercises: [...s.exercises, ex] }));
        return ex;
      },

      createProgram: (name, source = "trainer") => {
        const id = uid();
        const program: Program = {
          id,
          owner: LOCAL_OWNER,
          name: stripDate(name) || "New program",
          source,
          notes: null,
          dayTemplateIds: [],
        };
        set((s) => ({ programs: [...s.programs, program] }));
        return id;
      },

      deleteProgram: (id) =>
        set((s) => ({ programs: s.programs.filter((p) => p.id !== id) })),

      addDayToProgram: (programId, name) => {
        const templateId = get().createTemplate(name);
        set((s) => ({
          programs: s.programs.map((p) =>
            p.id === programId
              ? { ...p, dayTemplateIds: [...p.dayTemplateIds, templateId] }
              : p
          ),
        }));
        return templateId;
      },

      removeDayFromProgram: (programId, templateId) =>
        set((s) => ({
          programs: s.programs.map((p) =>
            p.id === programId
              ? { ...p, dayTemplateIds: p.dayTemplateIds.filter((d) => d !== templateId) }
              : p
          ),
          templates: s.templates.filter((t) => t.id !== templateId),
        })),

      createTemplate: (name) => {
        const id = uid();
        // INVARIANT: templates are undated.
        const tpl: WorkoutTemplate = {
          id,
          owner: LOCAL_OWNER,
          name: stripDate(name) || "Untitled plan",
          notes: null,
          exercises: [],
        };
        set((s) => ({ templates: [...s.templates, tpl] }));
        return id;
      },

      deleteTemplate: (id) =>
        set((s) => ({ templates: s.templates.filter((t) => t.id !== id) })),

      addTemplateExercise: (templateId, exerciseId) => {
        const ex = get().exercises.find((e) => e.id === exerciseId);
        set((s) => ({
          templates: s.templates.map((t) =>
            t.id !== templateId
              ? t
              : {
                  ...t,
                  exercises: [
                    ...t.exercises,
                    {
                      id: uid(),
                      exerciseId,
                      deviceId: ex?.defaultDeviceId ?? null,
                      position: t.exercises.length,
                      sets: [
                        { targetReps: 10, targetWeight: null },
                        { targetReps: 10, targetWeight: null },
                        { targetReps: 10, targetWeight: null },
                      ],
                      restSeconds: 90,
                    },
                  ],
                }
          ),
        }));
      },

      removeTemplateExercise: (templateId, templateExerciseId) =>
        set((s) => ({
          templates: s.templates.map((t) =>
            t.id !== templateId
              ? t
              : { ...t, exercises: t.exercises.filter((e) => e.id !== templateExerciseId) }
          ),
        })),

      setTemplateSetCount: (templateId, templateExerciseId, count) =>
        set((s) => ({
          templates: s.templates.map((t) =>
            t.id !== templateId
              ? t
              : {
                  ...t,
                  exercises: t.exercises.map((te) => {
                    if (te.id !== templateExerciseId) return te;
                    const n = Math.max(1, Math.min(10, count));
                    const last = te.sets[te.sets.length - 1] ?? { targetReps: 10, targetWeight: null };
                    const sets = [...te.sets];
                    while (sets.length < n) sets.push({ ...last });
                    sets.length = n;
                    return { ...te, sets };
                  }),
                }
          ),
        })),

      updateTemplateSet: (templateId, templateExerciseId, setIndex, patch) =>
        set((s) => ({
          templates: s.templates.map((t) =>
            t.id !== templateId
              ? t
              : {
                  ...t,
                  exercises: t.exercises.map((te) =>
                    te.id !== templateExerciseId
                      ? te
                      : {
                          ...te,
                          sets: te.sets.map((st, i) => (i === setIndex ? { ...st, ...patch } : st)),
                        }
                  ),
                }
          ),
        })),

      startSession: (templateId) => {
        if (!canCreateSession(get().sessions)) return { id: null, blocked: true };
        const id = uid();
        const tpl = templateId ? get().templates.find((t) => t.id === templateId) : null;
        const ts = now();
        const session: WorkoutSession = {
          id,
          owner: LOCAL_OWNER,
          templateId: templateId ?? null,
          title: tpl?.name ?? "Quick workout",
          date: dayKey(new Date()),
          status: "active",
          startedAt: ts,
          completedAt: null,
          reopenedAt: null,
          updatedAt: ts,
        };

        // Seed only the FIRST set per exercise; the user adds the rest one by one
        // (and can exceed the template's set count). Targets come from the plan.
        const seeded: WorkoutSet[] = [];
        if (tpl) {
          for (const te of tpl.exercises) {
            const first = te.sets[0];
            seeded.push({
              id: uid(),
              owner: LOCAL_OWNER,
              sessionId: id,
              exerciseId: te.exerciseId,
              deviceId: te.deviceId,
              setIndex: 0,
              targetReps: first?.targetReps ?? null,
              targetWeight: first?.targetWeight ?? null,
              actualReps: null,
              actualWeight: null,
              rpe: null,
              completed: false,
              completedAt: null,
            });
          }
        }

        set((s) => ({ sessions: [session, ...s.sessions], sets: [...s.sets, ...seeded] }));
        return { id, blocked: false };
      },

      finishSession: (id) => {
        const st = get();
        const session = st.sessions.find((s) => s.id === id);
        if (!session) return { discarded: false };
        // Abandoned (no logged sets) → discard rather than persist an empty record.
        if (isAbandoned(session, st.sets)) {
          get().discardSession(id);
          return { discarded: true };
        }
        set((s) => ({
          sessions: s.sessions.map((ss) =>
            ss.id === id
              ? { ...ss, status: "completed", completedAt: now(), updatedAt: now() }
              : ss
          ),
        }));
        return { discarded: false };
      },

      discardSession: (id) =>
        set((s) => ({
          sessions: s.sessions.filter((ss) => ss.id !== id),
          sets: s.sets.filter((x) => x.sessionId !== id),
        })),

      reopenSession: (id) => {
        const st = get();
        const session = st.sessions.find((s) => s.id === id);
        if (!session || !canReopen(session, st.sessions)) return false;
        set((s) => ({
          sessions: s.sessions.map((ss) =>
            ss.id === id
              ? { ...ss, status: "active", reopenedAt: now(), completedAt: null, updatedAt: now() }
              : ss
          ),
        }));
        return true;
      },

      archiveSession: (id) =>
        set((s) => ({
          sessions: s.sessions.map((ss) =>
            ss.id === id ? { ...ss, status: "archived", updatedAt: now() } : ss
          ),
        })),

      unarchiveSession: (id) =>
        set((s) => ({
          sessions: s.sessions.map((ss) =>
            ss.id === id ? { ...ss, status: "completed", updatedAt: now() } : ss
          ),
        })),

      addSet: (sessionId, exerciseId) => {
        const id = uid();
        const st = get();
        const existing = st.sets.filter(
          (x) => x.sessionId === sessionId && x.exerciseId === exerciseId
        );
        const prev = existing[existing.length - 1];
        const index = existing.length;

        // Prefer the next ramp target from the session's template (e.g. set 3 of
        // Row → 42.5), falling back to the previous logged set.
        const session = st.sessions.find((s) => s.id === sessionId);
        const tpl = session?.templateId
          ? st.templates.find((t) => t.id === session.templateId)
          : undefined;
        const templateSet = tpl?.exercises.find((te) => te.exerciseId === exerciseId)?.sets[index];
        const device = st.exercises.find((e) => e.id === exerciseId)?.defaultDeviceId ?? null;

        const newSet: WorkoutSet = {
          id,
          owner: LOCAL_OWNER,
          sessionId,
          exerciseId,
          deviceId: prev?.deviceId ?? device,
          setIndex: index,
          targetReps: templateSet?.targetReps ?? prev?.targetReps ?? null,
          targetWeight: templateSet?.targetWeight ?? prev?.actualWeight ?? prev?.targetWeight ?? null,
          actualReps: null,
          actualWeight: null,
          rpe: null,
          completed: false,
          completedAt: null,
        };
        set((s) => ({ sets: [...s.sets, newSet] }));
        return id;
      },

      updateSet: (setId, patch) =>
        set((s) => ({ sets: s.sets.map((x) => (x.id === setId ? { ...x, ...patch } : x)) })),

      completeSet: (setId) => {
        const st = get();
        const target = st.sets.find((x) => x.id === setId);
        if (!target) return { newPrs: [] };
        const bests = st.bestsFor(target.exerciseId);
        const prs = detectPrs(
          { actualReps: target.actualReps, actualWeight: target.actualWeight },
          bests
        );
        set((s) => {
          const sets = s.sets.map((x) =>
            x.id === setId ? { ...x, completed: true, completedAt: now() } : x
          );
          let nextPrs = s.prs;
          for (const pr of prs) {
            nextPrs = [
              ...nextPrs.filter(
                (p) => !(p.exerciseId === target.exerciseId && p.kind === pr.kind)
              ),
              { exerciseId: target.exerciseId, kind: pr.kind, value: pr.value, achievedAt: now() },
            ];
          }
          return { sets, prs: nextPrs };
        });
        return { newPrs: prs.map((p) => p.kind) };
      },

      removeSet: (setId) => set((s) => ({ sets: s.sets.filter((x) => x.id !== setId) })),

      getActiveSession: () => activeSession(get().sessions),

      deviceById: (id) => (id ? get().devices.find((d) => d.id === id) : undefined),

      exerciseById: (id) => get().exercises.find((e) => e.id === id),

      deviceForExercise: (exerciseId) => {
        const ex = get().exercises.find((e) => e.id === exerciseId);
        return ex?.defaultDeviceId ? get().devices.find((d) => d.id === ex.defaultDeviceId) : undefined;
      },

      programById: (id) => get().programs.find((p) => p.id === id),

      daysForProgram: (id) => {
        const st = get();
        const program = st.programs.find((p) => p.id === id);
        if (!program) return [];
        return program.dayTemplateIds
          .map((tid) => st.templates.find((t) => t.id === tid))
          .filter((t): t is WorkoutTemplate => Boolean(t));
      },

      trainedDays: () => {
        const days = new Set<string>();
        for (const s of get().sessions) if (s.status !== "archived") days.add(s.date);
        return days;
      },

      recentExerciseIds: (limit = 8) => {
        const st = get();
        const sessions = [...st.sessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
        const ordered: string[] = [];
        for (const s of sessions) {
          for (const x of st.sets.filter((set) => set.sessionId === s.id)) {
            if (!ordered.includes(x.exerciseId)) ordered.push(x.exerciseId);
            if (ordered.length >= limit) return ordered;
          }
        }
        return ordered;
      },

      setsForSession: (sessionId) =>
        get()
          .sets.filter((x) => x.sessionId === sessionId)
          .sort((a, b) => a.setIndex - b.setIndex),

      lastPerformance: (exerciseId, beforeSessionId) => {
        const st = get();
        const sessions = st.sessions
          .filter((s) => s.id !== beforeSessionId && s.status !== "active")
          .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
        for (const s of sessions) {
          const sets = st.sets.filter(
            (x) => x.sessionId === s.id && x.exerciseId === exerciseId && x.completed
          );
          if (sets.length > 0) {
            return {
              targetReps: sets[0].targetReps ?? 8,
              sets: sets.map((x) => ({
                actualReps: x.actualReps,
                actualWeight: x.actualWeight,
                rpe: x.rpe,
                completed: x.completed,
              })),
            };
          }
        }
        return null;
      },

      missStreak: (exerciseId, targetReps) => {
        const st = get();
        const sessions = st.sessions
          .filter((s) => s.status === "completed")
          .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
        let streak = 0;
        for (const s of sessions) {
          const sets = st.sets.filter(
            (x) => x.sessionId === s.id && x.exerciseId === exerciseId && x.completed
          );
          if (sets.length === 0) continue;
          const missed = sets.some((x) => (x.actualReps ?? 0) < targetReps);
          if (missed) streak++;
          else break;
        }
        return streak;
      },

      bestsFor: (exerciseId) => {
        const st = get();
        const sets = st.sets.filter(
          (x) =>
            x.exerciseId === exerciseId &&
            x.completed &&
            x.actualReps != null &&
            x.actualWeight != null
        );
        let e1rm = 0;
        let maxWeight = 0;
        let maxReps = 0;
        for (const x of sets) {
          e1rm = Math.max(e1rm, epley1rm(x.actualWeight as number, x.actualReps as number));
          maxWeight = Math.max(maxWeight, x.actualWeight as number);
          maxReps = Math.max(maxReps, x.actualReps as number);
        }
        return { e1rm, maxWeight, maxReps };
      },
    }),
    {
      // New key = hard reset of all existing data (local-first has no server DB).
      // Old "trainova-v1" data is abandoned; the app starts from the seed below.
      name: "trainova-2026-06",
      version: 1,
      migrate: migrateState,
      skipHydration: true,
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? window.localStorage : memoryStorage
      ),
      partialize: (s) => ({
        units: s.units,
        devices: s.devices,
        exercises: s.exercises,
        programs: s.programs,
        templates: s.templates,
        sessions: s.sessions,
        sets: s.sets,
        prs: s.prs,
      }),
    }
  )
);

// ---------------------------------------------------------------------------
// Migration to v4: introduce Device/status/per-set targets, enforce one active
// session, and reset the definitions layer to the clean seed. Best-effort and
// idempotent; preserves logged sessions/sets/PRs and custom exercises.
// ---------------------------------------------------------------------------
function migrateState(persisted: unknown, _version: number): TrainovaState {
  const s = persisted as Record<string, any> | undefined;
  if (!s) return persisted as TrainovaState;

  const mergeById = <T extends { id: string }>(seed: T[], existing: T[]): T[] => {
    const have = new Set(seed.map((x) => x.id));
    return [...seed, ...existing.filter((x) => !have.has(x.id))];
  };

  // Devices: seed library + any custom.
  const devices = mergeById(SEED_DEVICES, (s.devices ?? []) as Device[]);

  // Exercises: clean seed + custom (owner != null), remapped to the new shape.
  const customExercises: Exercise[] = (s.exercises ?? [])
    .filter((e: any) => e.owner && !String(e.id).startsWith("seed-") && !String(e.id).startsWith("m-"))
    .map((e: any) => ({
      id: e.id,
      owner: e.owner,
      name: stripDate(e.name ?? "Exercise"),
      defaultDeviceId: e.defaultDeviceId ?? null,
      isCompound: Boolean(e.isCompound),
      primaryMuscle: e.primaryMuscle ?? null,
    }));
  const exercises = mergeById(SEED_EXERCISES, customExercises);

  // Templates: drop the old dated seed plan; map any user templates to per-set shape.
  const userTemplates: WorkoutTemplate[] = (s.templates ?? [])
    .filter((t: any) => t.id !== "plan-gymplan-1606" && t.id !== SEED_PLAN_ID)
    .map((t: any) => ({
      id: t.id,
      owner: t.owner ?? LOCAL_OWNER,
      name: stripDate(t.name ?? "Plan"),
      notes: t.notes ?? null,
      exercises: (t.exercises ?? []).map((te: any, i: number) => ({
        id: te.id ?? `${t.id}-${i}`,
        exerciseId: te.exerciseId,
        deviceId: te.deviceId ?? null,
        position: te.position ?? i,
        restSeconds: te.restSeconds ?? 90,
        sets: Array.isArray(te.sets)
          ? te.sets
          : Array.from({ length: te.targetSets ?? 3 }, () => ({
              targetReps: te.targetReps ?? 10,
              targetWeight: te.targetWeight ?? null,
            })),
      })),
    }));
  const templates = [SEED_PLAN, ...userTemplates];

  // Programs: drop old seed program; keep user programs; ensure seed program.
  const userPrograms: Program[] = (s.programs ?? []).filter(
    (p: any) => p.id !== "program-trainer-1606" && p.id !== SEED_PROGRAM_ID
  );
  const programs = [SEED_PROGRAM, ...userPrograms];

  // Sets: rename planned → target, add device/completedAt.
  const sets: WorkoutSet[] = (s.sets ?? []).map((x: any) => ({
    id: x.id,
    owner: x.owner ?? LOCAL_OWNER,
    sessionId: x.sessionId,
    exerciseId: x.exerciseId,
    deviceId: x.deviceId ?? null,
    setIndex: x.setIndex ?? 0,
    targetReps: x.targetReps ?? x.plannedReps ?? null,
    targetWeight: x.targetWeight ?? x.plannedWeight ?? null,
    actualReps: x.actualReps ?? null,
    actualWeight: x.actualWeight ?? null,
    rpe: x.rpe ?? null,
    completed: Boolean(x.completed),
    completedAt: x.completedAt ?? null,
  }));

  // Sessions: derive status from endedAt; enforce a single active session.
  let mapped: WorkoutSession[] = (s.sessions ?? []).map((x: any) => {
    const started = x.startedAt ?? now();
    const status: WorkoutSession["status"] =
      x.status ?? (x.endedAt ? "completed" : "active");
    return {
      id: x.id,
      owner: x.owner ?? LOCAL_OWNER,
      templateId: x.templateId ?? null,
      title: stripDate(x.title ?? x.name ?? "Workout"),
      date: x.date ?? dayKey(new Date(started)),
      status,
      startedAt: started,
      completedAt: x.completedAt ?? x.endedAt ?? null,
      reopenedAt: x.reopenedAt ?? null,
      updatedAt: x.updatedAt ?? x.endedAt ?? started,
    };
  });

  // Discard abandoned actives (no completed sets); keep only the newest active.
  const hasCompletedSet = (sid: string) => sets.some((x) => x.sessionId === sid && x.completed);
  mapped = mapped.filter((m) => !(m.status === "active" && !hasCompletedSet(m.id)));
  const actives = mapped
    .filter((m) => m.status === "active")
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  if (actives.length > 1) {
    const keep = actives[0].id;
    mapped = mapped.map((m) =>
      m.status === "active" && m.id !== keep
        ? { ...m, status: "completed", completedAt: m.completedAt ?? m.startedAt }
        : m
    );
  }
  const liveSessionIds = new Set(mapped.map((m) => m.id));
  const liveSets = sets.filter((x) => liveSessionIds.has(x.sessionId));

  return {
    ...(s as object),
    units: s.units ?? "kg",
    devices,
    exercises,
    programs,
    templates,
    sessions: mapped,
    sets: liveSets,
    prs: s.prs ?? [],
  } as TrainovaState;
}

/**
 * Rehydrates the persisted store on the client and reports when it's ready.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    void useStore.persist.rehydrate();
    setHydrated(true);
  }, []);
  return hydrated;
}
