"use client";

import { useEffect, useState } from "react";
import { create } from "zustand";
import { persist, createJSONStorage, type StateStorage } from "zustand/middleware";
import type {
  Exercise,
  PersonalRecord,
  Units,
  WorkoutSession,
  WorkoutSet,
  WorkoutTemplate,
} from "@/domain/types";
import { detectPrs, epley1rm } from "@/domain/progression";
import type { LastPerformance } from "@/domain/progression";
import { SEED_EXERCISES, SEED_PLAN, SEED_PLAN_ID } from "./seed";
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
  exercises: Exercise[];
  templates: WorkoutTemplate[];
  sessions: WorkoutSession[];
  sets: WorkoutSet[];
  prs: PersonalRecord[];
  activeSessionId: string | null;

  setUnits: (u: Units) => void;
  addExercise: (input: Omit<Exercise, "id" | "owner">) => Exercise;

  createTemplate: (name: string) => string;
  deleteTemplate: (id: string) => void;
  addTemplateExercise: (
    templateId: string,
    exerciseId: string,
    opts?: Partial<{ targetSets: number; targetReps: number; targetWeight: number | null }>
  ) => void;
  removeTemplateExercise: (templateId: string, templateExerciseId: string) => void;

  startSession: (templateId: string | null, name?: string) => string;
  endSession: (id: string) => void;

  addSet: (sessionId: string, exerciseId: string) => string;
  updateSet: (setId: string, patch: Partial<WorkoutSet>) => void;
  completeSet: (setId: string) => { newPrs: PersonalRecord["kind"][] };
  removeSet: (setId: string) => void;

  // selectors
  exerciseById: (id: string) => Exercise | undefined;
  recentExerciseIds: (limit?: number) => string[];
  setsForSession: (sessionId: string) => WorkoutSet[];
  lastPerformance: (exerciseId: string, beforeSessionId?: string) => LastPerformance | null;
  missStreak: (exerciseId: string, targetReps: number) => number;
  bestsFor: (exerciseId: string) => { e1rm: number; maxWeight: number; maxReps: number };
}

export const useStore = create<TrainovaState>()(
  persist(
    (set, get) => ({
      units: "kg",
      exercises: SEED_EXERCISES,
      templates: [SEED_PLAN],
      sessions: [],
      sets: [],
      prs: [],
      activeSessionId: null,

      setUnits: (u) => set({ units: u }),

      addExercise: (input) => {
        const ex: Exercise = { ...input, id: uid(), owner: LOCAL_OWNER };
        set((s) => ({ exercises: [...s.exercises, ex] }));
        return ex;
      },

      createTemplate: (name) => {
        const id = uid();
        const tpl: WorkoutTemplate = {
          id,
          owner: LOCAL_OWNER,
          name: name.trim() || "Untitled workout",
          notes: null,
          exercises: [],
        };
        set((s) => ({ templates: [...s.templates, tpl] }));
        return id;
      },

      deleteTemplate: (id) =>
        set((s) => ({ templates: s.templates.filter((t) => t.id !== id) })),

      addTemplateExercise: (templateId, exerciseId, opts) =>
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
                      position: t.exercises.length,
                      targetSets: opts?.targetSets ?? 3,
                      targetReps: opts?.targetReps ?? 8,
                      targetWeight: opts?.targetWeight ?? null,
                      restSeconds: 120,
                    },
                  ],
                }
          ),
        })),

      removeTemplateExercise: (templateId, templateExerciseId) =>
        set((s) => ({
          templates: s.templates.map((t) =>
            t.id !== templateId
              ? t
              : { ...t, exercises: t.exercises.filter((e) => e.id !== templateExerciseId) }
          ),
        })),

      startSession: (templateId, name) => {
        const id = uid();
        const tpl = templateId ? get().templates.find((t) => t.id === templateId) : null;
        const session: WorkoutSession = {
          id,
          owner: LOCAL_OWNER,
          templateId: templateId ?? null,
          name: name ?? tpl?.name ?? "Quick workout",
          startedAt: new Date().toISOString(),
          endedAt: null,
        };

        // Pre-populate planned sets from the template, seeding suggested loads
        // from each exercise's last performance.
        const seededSets: WorkoutSet[] = [];
        if (tpl) {
          for (const te of tpl.exercises) {
            for (let i = 0; i < te.targetSets; i++) {
              seededSets.push({
                id: uid(),
                owner: LOCAL_OWNER,
                sessionId: id,
                exerciseId: te.exerciseId,
                setIndex: i,
                plannedReps: te.targetReps,
                plannedWeight: te.targetWeight,
                actualReps: null,
                actualWeight: null,
                rpe: null,
                completed: false,
              });
            }
          }
        }

        set((s) => ({
          sessions: [session, ...s.sessions],
          sets: [...s.sets, ...seededSets],
          activeSessionId: id,
        }));
        return id;
      },

      endSession: (id) =>
        set((s) => ({
          sessions: s.sessions.map((ss) =>
            ss.id === id ? { ...ss, endedAt: new Date().toISOString() } : ss
          ),
          activeSessionId: s.activeSessionId === id ? null : s.activeSessionId,
        })),

      addSet: (sessionId, exerciseId) => {
        const id = uid();
        const existing = get().sets.filter(
          (x) => x.sessionId === sessionId && x.exerciseId === exerciseId
        );
        const newSet: WorkoutSet = {
          id,
          owner: LOCAL_OWNER,
          sessionId,
          exerciseId,
          setIndex: existing.length,
          plannedReps: existing[existing.length - 1]?.plannedReps ?? null,
          plannedWeight: existing[existing.length - 1]?.actualWeight ?? null,
          actualReps: null,
          actualWeight: null,
          rpe: null,
          completed: false,
        };
        set((s) => ({ sets: [...s.sets, newSet] }));
        return id;
      },

      updateSet: (setId, patch) =>
        set((s) => ({
          sets: s.sets.map((x) => (x.id === setId ? { ...x, ...patch } : x)),
        })),

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
          const sets = s.sets.map((x) => (x.id === setId ? { ...x, completed: true } : x));
          let nextPrs = s.prs;
          for (const pr of prs) {
            nextPrs = [
              ...nextPrs.filter(
                (p) => !(p.exerciseId === target.exerciseId && p.kind === pr.kind)
              ),
              {
                exerciseId: target.exerciseId,
                kind: pr.kind,
                value: pr.value,
                achievedAt: new Date().toISOString(),
              },
            ];
          }
          return { sets, prs: nextPrs };
        });
        return { newPrs: prs.map((p) => p.kind) };
      },

      removeSet: (setId) =>
        set((s) => ({ sets: s.sets.filter((x) => x.id !== setId) })),

      exerciseById: (id) => get().exercises.find((e) => e.id === id),

      recentExerciseIds: (limit = 8) => {
        const st = get();
        const sessions = [...st.sessions].sort((a, b) =>
          b.startedAt.localeCompare(a.startedAt)
        );
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
        // Sessions ordered most-recent first, optionally excluding the current one.
        const sessions = st.sessions
          .filter((s) => s.id !== beforeSessionId && s.endedAt)
          .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
        for (const s of sessions) {
          const sets = st.sets.filter(
            (x) => x.sessionId === s.id && x.exerciseId === exerciseId && x.completed
          );
          if (sets.length > 0) {
            return {
              targetReps: sets[0].plannedReps ?? 8,
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
          .filter((s) => s.endedAt)
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
      name: "trainova-v1",
      version: 2,
      // Backfill the seed plan + its machines into browsers that persisted state
      // before the plan existed. Idempotent via the stable SEED_PLAN_ID.
      migrate: (persisted, _version) => {
        const s = persisted as Partial<TrainovaState> | undefined;
        if (!s) return persisted as TrainovaState;
        const exercises = s.exercises ?? [];
        const haveIds = new Set(exercises.map((e) => e.id));
        const mergedExercises = [
          ...exercises,
          ...SEED_EXERCISES.filter((e) => !haveIds.has(e.id)),
        ];
        const templates = s.templates ?? [];
        const mergedTemplates = templates.some((t) => t.id === SEED_PLAN_ID)
          ? templates
          : [SEED_PLAN, ...templates];
        return { ...s, exercises: mergedExercises, templates: mergedTemplates } as TrainovaState;
      },
      skipHydration: true,
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? window.localStorage : memoryStorage
      ),
      partialize: (s) => ({
        units: s.units,
        exercises: s.exercises,
        templates: s.templates,
        sessions: s.sessions,
        sets: s.sets,
        prs: s.prs,
        activeSessionId: s.activeSessionId,
      }),
    }
  )
);

/**
 * Rehydrates the persisted store on the client and reports when it's ready.
 * Because `skipHydration: true`, persistence never runs on the server, so SSR
 * prerendering is safe; we trigger `rehydrate()` exactly once after mount.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    void useStore.persist.rehydrate();
    setHydrated(true);
  }, []);
  return hydrated;
}
