"use client";

import { normalizeCoaching, type CoachingProfile } from "@/domain/coachingProfile";
import { useEffect, useState } from "react";
import { create } from "zustand";
import { persist, createJSONStorage, type StateStorage } from "zustand/middleware";
import type {
  AuditEvent,
  BodyweightEntry,
  Device,
  Exercise,
  PersonalRecord,
  Program,
  SessionFeedback,
  RecoveryCheckIn,
  TemplateExercise,
  TemplateSet,
  Tombstone,
  Units,
  UserProfile,
  WorkoutSession,
  WorkoutSet,
  WorkoutTemplate,
} from "@/domain/types";
import { detectPrs, epley1rm } from "@/domain/progression";
import { rebuildPrs } from "@/domain/records";
import { stampChanges } from "@/domain/versioning";
import { MAX_PLAN_CHANGES, undoPlan, type PlanChange } from "@/domain/planChanges";
import type { LastPerformance } from "@/domain/progression";
import { bestWeight, totalVolume } from "@/domain/volume";
import { matchExercise } from "@/domain/exerciseMatch";
import { clearCoachChat } from "@/lib/coachChat";
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
import { blueprintById, buildFromBlueprint } from "@/data/programs";
import { SCHEMA_VERSION, upgradeWeights } from "@/domain/legacy";
import { exerciseTypeOf } from "@/domain/exerciseType";
import { uid } from "./id";

const LOCAL_OWNER = "local-user";

/** No-op storage used during SSR where window/localStorage is unavailable. */
const memoryStorage: StateStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

export interface AppSession {
  mode: "guest" | "account";
  email: string | null;
  role?: "user" | "trainer" | "admin";
}

/** A portable plan snapshot used for trainer assignments. */
export interface AssignedPlan {
  name: string;
  notes: string | null;
  exercises: {
    name: string;
    muscle: string | null;
    sets: { targetReps: number; targetWeight: number | null }[];
  }[];
}

export interface TrainovaState {
  session: AppSession | null;
  units: Units;
  profile: UserProfile;
  audit: AuditEvent[];
  /** AI-applied plan changes, newest first, with what's needed to undo them. */
  planChanges: PlanChange[];
  devices: Device[];
  exercises: Exercise[];
  programs: Program[];
  templates: WorkoutTemplate[];
  sessions: WorkoutSession[];
  sets: WorkoutSet[];
  feedback: SessionFeedback[];
  prs: PersonalRecord[];
  bodyLog: BodyweightEntry[];
  /** Daily recovery check-ins, oldest first. */
  checkIns: RecoveryCheckIn[];
  /** Deletion markers so sync never resurrects removed records. */
  tombstones: Tombstone[];

  enterGuest: () => void;
  enterAccount: (email: string, role?: AppSession["role"]) => void;
  /** Sign out. `wipe` also clears personal data so the next account starts clean. */
  leaveSession: (opts?: { wipe?: boolean }) => void;
  setUnits: (u: Units) => void;
  setLibrary: (devices: Device[], exercises: Exercise[]) => void;
  completeOnboarding: (p: Partial<UserProfile>) => void;
  updateProfile: (p: Partial<UserProfile>) => void;
  toggleFavoriteExercise: (exerciseId: string) => void;
  /** Merges into the coaching profile (validated). */
  updateCoaching: (p: Partial<CoachingProfile>) => void;
  editSet: (
    setId: string,
    patch: { actualWeight?: number | null; actualReps?: number | null },
    reason?: string
  ) => void;
  revertSet: (setId: string) => void;
  auditForSet: (setId: string) => AuditEvent[];
  recordPlanChange: (change: PlanChange) => void;
  undoPlanChange: (id: string) => { ok: true } | { ok: false; error: string };
  addDevice: (input: Omit<Device, "id" | "owner">) => Device;
  addExercise: (input: Omit<Exercise, "id" | "owner">) => Exercise;

  createProgram: (name: string, source?: Program["source"]) => string;
  deleteProgram: (id: string) => void;
  addDayToProgram: (programId: string, name: string) => string;
  removeDayFromProgram: (programId: string, templateId: string) => void;
  renameProgram: (id: string, name: string) => void;
  /** Copy a curated starter program into the user's programs. */
  installProgram: (blueprintId: string) => string | null;

  createTemplate: (name: string) => string;
  serializeTemplate: (templateId: string) => AssignedPlan | null;
  importAssignedPlan: (payload: AssignedPlan) => string;
  deleteTemplate: (id: string) => void;
  updateTemplate: (id: string, patch: Partial<Pick<WorkoutTemplate, "name" | "notes">>) => void;
  updateTemplateExercise: (
    templateId: string,
    templateExerciseId: string,
    patch: Partial<Pick<TemplateExercise, "restSeconds" | "cue" | "deviceId" | "targetRpe" | "repMax">>
  ) => void;
  moveTemplateExercise: (templateId: string, templateExerciseId: string, delta: -1 | 1) => void;
  addTemplateExercise: (templateId: string, exerciseId: string) => void;
  /** Swap the movement in a slot; sets, rest and position are kept. */
  replaceTemplateExercise: (templateId: string, templateExerciseId: string, exerciseId: string) => void;
  removeTemplateExercise: (templateId: string, templateExerciseId: string) => void;
  setTemplateSetCount: (templateId: string, templateExerciseId: string, count: number) => void;
  updateTemplateSet: (
    templateId: string,
    templateExerciseId: string,
    setIndex: number,
    patch: Partial<TemplateSet>
  ) => void;

  // session lifecycle (see domain/session.ts)
  startSession: (
    templateId: string | null,
    dateKey?: string
  ) => { id: string | null; blocked: boolean };
  finishSession: (id: string) => { discarded: boolean };
  recordSessionFeedback: (
    sessionId: string,
    input: Omit<SessionFeedback, "id" | "owner" | "sessionId" | "createdAt">
  ) => void;
  discardSession: (id: string) => void;
  reopenSession: (id: string) => boolean;
  archiveSession: (id: string) => void;
  unarchiveSession: (id: string) => void;

  addSet: (sessionId: string, exerciseId: string) => string;
  updateSet: (setId: string, patch: Partial<WorkoutSet>) => void;
  setSessionNotes: (sessionId: string, notes: string) => void;
  addBodyweight: (date: string, weightKg: number) => void;
  removeBodyweight: (id: string) => void;
  /** Record today's (or `date`'s) check-in; re-checking in replaces it. */
  recordCheckIn: (date: string, values: Pick<RecoveryCheckIn, "sleep" | "energy" | "soreness" | "stress">) => void;
  /** Wipe personal data (sign-out / reset); keeps the shared library. */
  /**
   * Clear personal data. With `forget`, deletions are tombstoned so a synced
   * account doesn't pull the data back; without it (sign-out wipe) the device
   * is simply cleared.
   */
  resetUserData: (opts?: { forget?: boolean }) => void;
  /** Replace personal data with a previously exported backup. */
  importBackup: (data: Record<string, unknown>) => boolean;
  completeSet: (setId: string) => { newPrs: PersonalRecord["kind"][] };
  removeSet: (setId: string) => void;
  /** Log this exercise's sets in a workout against a different machine. */
  setExerciseDevice: (sessionId: string, exerciseId: string, deviceId: string | null) => void;
  /** Move a logged set to another exercise in the same workout (logged on the wrong card). */
  moveSet: (setId: string, toExerciseId: string) => void;
  /**
   * Swap an exercise for another in this workout only: its open sets move to
   * `toExerciseId`, logged sets stay where they were. Returns how many sets
   * moved (0 when nothing is open or the target is already in the workout).
   */
  swapSessionExercise: (sessionId: string, fromExerciseId: string, toExerciseId: string) => number;

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
  exercisesWithHistory: () => string[];
  exerciseHistory: (exerciseId: string) => {
    date: string;
    topWeight: number;
    e1rm: number;
    volume: number;
    durationMin: number;
    distance: number;
    durationSec: number; // longest hold
    maxReps: number;
    totalReps: number;
  }[];
}

const now = () => new Date().toISOString();
/** About a year of daily check-ins. */
const MAX_CHECK_INS = 400;

const isWarmup = (x: Pick<WorkoutSet, "kind">) => x.kind === "warmup";

/** Personal records for the given exercises, rebuilt from their logged sets. */
const withRebuiltPrs = rebuildPrs;

/** Append deletion markers for ids (keeps the most recent 10k). */
function tomb(list: Tombstone[], ids: Iterable<string>): Tombstone[] {
  const at = now();
  const fresh = [...new Set(ids)].map((id) => ({ id, at }));
  const ids2 = new Set(fresh.map((f) => f.id));
  return [...list.filter((t) => !ids2.has(t.id)), ...fresh].slice(-10000);
}

/** Sensible starting rep target for a newly added exercise. */
function defaultTargetReps(ex: Exercise | undefined): number {
  const type = exerciseTypeOf(ex);
  if (type === "duration") return 30; // seconds
  if (type === "cardio") return 15; // minutes
  return ex?.isCompound ? 8 : 12;
}

/**
 * Combine the bundled library, a newer central copy (fields it lacks fall back
 * to the bundled entry) and the user's own custom items (owner != null).
 */
function mergeLibrary<T extends { id: string; owner: string | null }>(
  bundled: T[],
  central: T[],
  existing: T[]
): T[] {
  const byId = new Map<string, T>();
  for (const x of bundled) byId.set(x.id, x);
  for (const x of central) {
    const clean = Object.fromEntries(
      Object.entries(x).filter(([, v]) => v !== undefined)
    ) as Partial<T>;
    byId.set(x.id, { ...(byId.get(x.id) ?? ({} as T)), ...clean, owner: null } as T);
  }
  const custom = existing.filter((x) => x.owner != null && !byId.has(x.id));
  return [...byId.values(), ...custom];
}

export const useStore = create<TrainovaState>()(
  persist(
    (rawSet, get) => {
    // Every internal update stamps edited definitions (templates, programs,
    // custom exercises, profile) so sync can keep the newest edit. Snapshots
    // applied from the server go through useStore.setState and keep theirs.
    const set: typeof rawSet = ((partial: unknown, replace?: boolean) =>
      (rawSet as (p: unknown, r?: boolean) => void)(
        (state: TrainovaState) => {
          const next = typeof partial === "function" ? (partial as (s: TrainovaState) => Partial<TrainovaState>)(state) : partial;
          return stampChanges(state as unknown as Record<string, unknown>, next as Record<string, unknown>);
        },
        replace
      )) as typeof rawSet;
    return {
      session: null,
      units: "kg",
      profile: { displayName: null, role: "user", goal: null, experience: null, onboarded: false },
      audit: [],
      planChanges: [],
      devices: SEED_DEVICES,
      exercises: SEED_EXERCISES,
      programs: [],
      templates: [],
      sessions: [],
      sets: [],
      feedback: [],
      prs: [],
      bodyLog: [],
      checkIns: [],
      tombstones: [],

      enterGuest: () => set({ session: { mode: "guest", email: null } }),
      enterAccount: (email, role = "user") => set({ session: { mode: "account", email, role } }),
      leaveSession: (opts) => {
        if (opts?.wipe) get().resetUserData();
        set({ session: null });
      },

      setUnits: (u) => set({ units: u }),

      // Replace shared (owner === null) library items with the central copy,
      // keeping the user's own custom devices/exercises.
      setLibrary: (devices, exercises) =>
        set((s) => ({
          devices: mergeLibrary(SEED_DEVICES, devices, s.devices),
          exercises: mergeLibrary(SEED_EXERCISES, exercises, s.exercises),
        })),

      completeOnboarding: (p) =>
        set((s) => ({ profile: { ...s.profile, ...p, onboarded: true } })),

      updateProfile: (p) => set((s) => ({ profile: { ...s.profile, ...p } })),

      toggleFavoriteExercise: (exerciseId) =>
        set((s) => {
          const ids = s.profile.favoriteExerciseIds ?? [];
          const next = ids.includes(exerciseId) ? ids.filter((x) => x !== exerciseId) : [...ids, exerciseId];
          return { profile: { ...s.profile, favoriteExerciseIds: next, updatedAt: now() } };
        }),

      updateCoaching: (p) =>
        set((s) => ({ profile: { ...s.profile, coaching: normalizeCoaching({ ...normalizeCoaching(s.profile.coaching), ...p }) } })),

      editSet: (setId, patch, reason) => {
        const st = get();
        const target = st.sets.find((x) => x.id === setId);
        if (!target) return;
        const before = { actualWeight: target.actualWeight, actualReps: target.actualReps };
        const after = { ...before, ...patch };
        if (before.actualWeight === after.actualWeight && before.actualReps === after.actualReps)
          return;
        const event: AuditEvent = {
          id: uid(),
          actor: LOCAL_OWNER,
          entity: "workout_set",
          entityId: setId,
          action: "edit",
          before,
          after,
          reason: reason ?? null,
          at: now(),
        };
        set((s) => {
          const sets = s.sets.map((x) => (x.id === setId ? { ...x, ...patch, editedAt: now() } : x));
          return {
            sets,
            audit: [event, ...s.audit],
            prs: target.completed ? withRebuiltPrs({ ...s, sets }, [target.exerciseId]) : s.prs,
          };
        });
      },

      revertSet: (setId) => {
        const st = get();
        const events = st.audit
          .filter((e) => e.entityId === setId && e.action === "edit")
          .sort((a, b) => a.at.localeCompare(b.at));
        const original = events[0]?.before;
        if (!original) return;
        const target = st.sets.find((x) => x.id === setId);
        if (!target) return;
        const event: AuditEvent = {
          id: uid(),
          actor: LOCAL_OWNER,
          entity: "workout_set",
          entityId: setId,
          action: "revert",
          before: { actualWeight: target.actualWeight, actualReps: target.actualReps },
          after: original,
          reason: "revert to original",
          at: now(),
        };
        set((s) => {
          const sets = s.sets.map((x) =>
            x.id === setId
              ? { ...x, actualWeight: original.actualWeight, actualReps: original.actualReps, editedAt: null }
              : x
          );
          return { sets, audit: [event, ...s.audit], prs: withRebuiltPrs({ ...s, sets }, [target.exerciseId]) };
        });
      },

      recordPlanChange: (change) =>
        set((s) => ({ planChanges: [change, ...s.planChanges].slice(0, MAX_PLAN_CHANGES) })),

      undoPlanChange: (id) => {
        const st = get();
        const change = st.planChanges.find((c) => c.id === id);
        if (!change) return { ok: false, error: "That change is no longer in the history." };
        const at = now();
        const r = undoPlan(st, change, at);
        if (!r.ok) return r;
        set((s) => ({
          templates: r.templates,
          programs: r.programs,
          tombstones: r.deleted.length ? tomb(s.tombstones, r.deleted) : s.tombstones,
          planChanges: s.planChanges.map((c) => (c.id === id ? { ...c, undoneAt: at, updatedAt: at } : c)),
        }));
        return { ok: true };
      },

      auditForSet: (setId) =>
        get()
          .audit.filter((e) => e.entityId === setId)
          .sort((a, b) => b.at.localeCompare(a.at)),

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
        set((s) => {
          const program = s.programs.find((p) => p.id === id);
          if (!program) return {};
          // Day templates belong to the program; past sessions keep their snapshot title.
          const dayIds = new Set(program.dayTemplateIds);
          return {
            programs: s.programs.filter((p) => p.id !== id),
            templates: s.templates.filter((t) => !dayIds.has(t.id)),
            tombstones: tomb(s.tombstones, [id, ...dayIds]),
          };
        }),

      renameProgram: (id, name) =>
        set((s) => ({
          programs: s.programs.map((p) =>
            p.id === id ? { ...p, name: stripDate(name) || p.name } : p
          ),
        })),

      installProgram: (blueprintId) => {
        const bp = blueprintById(blueprintId);
        if (!bp) return null;
        const st = get();
        const { program, templates } = buildFromBlueprint(
          bp,
          LOCAL_OWNER,
          uid,
          (exId) => st.exercises.find((e) => e.id === exId)?.defaultDeviceId ?? null
        );
        set((s) => ({
          programs: [...s.programs, program],
          templates: [...s.templates, ...templates],
        }));
        return program.id;
      },

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
          tombstones: tomb(s.tombstones, [templateId]),
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

      serializeTemplate: (templateId) => {
        const t = get().templates.find((x) => x.id === templateId);
        if (!t) return null;
        return {
          name: t.name,
          notes: t.notes,
          exercises: t.exercises.map((te) => {
            const ex = get().exercises.find((e) => e.id === te.exerciseId);
            return {
              name: ex?.name ?? "Exercise",
              muscle: ex?.primaryMuscle ?? null,
              sets: te.sets.map((s) => ({ targetReps: s.targetReps, targetWeight: s.targetWeight })),
            };
          }),
        };
      },

      importAssignedPlan: (payload) => {
        const id = uid();
        const exercises = payload.exercises.map((ex, i) => {
          let exer = matchExercise(ex.name, get().exercises) ?? undefined;
          if (!exer) {
            exer = get().addExercise({
              name: ex.name.trim(),
              defaultDeviceId: null,
              isCompound: false,
              primaryMuscle: ex.muscle ?? null,
            });
          }
          const sets =
            Array.isArray(ex.sets) && ex.sets.length
              ? ex.sets.map((s) => ({ targetReps: s.targetReps ?? 10, targetWeight: s.targetWeight ?? null }))
              : [{ targetReps: 10, targetWeight: null }];
          return {
            id: `${id}-${i}`,
            exerciseId: exer.id,
            deviceId: exer.defaultDeviceId,
            position: i,
            restSeconds: 90,
            sets,
          };
        });
        const tpl: WorkoutTemplate = {
          id,
          owner: LOCAL_OWNER,
          name: stripDate(payload.name) || "Assigned plan",
          notes: payload.notes ?? null,
          exercises,
        };
        set((s) => ({ templates: [...s.templates, tpl] }));
        return id;
      },

      deleteTemplate: (id) =>
        set((s) => ({
          templates: s.templates.filter((t) => t.id !== id),
          programs: s.programs.map((p) =>
            p.dayTemplateIds.includes(id)
              ? { ...p, dayTemplateIds: p.dayTemplateIds.filter((d) => d !== id) }
              : p
          ),
          tombstones: tomb(s.tombstones, [id]),
        })),

      updateTemplate: (id, patch) =>
        set((s) => ({
          templates: s.templates.map((t) =>
            t.id !== id
              ? t
              : {
                  ...t,
                  ...patch,
                  name: patch.name !== undefined ? stripDate(patch.name) || t.name : t.name,
                }
          ),
        })),

      updateTemplateExercise: (templateId, templateExerciseId, patch) =>
        set((s) => ({
          templates: s.templates.map((t) =>
            t.id !== templateId
              ? t
              : {
                  ...t,
                  exercises: t.exercises.map((te) =>
                    te.id === templateExerciseId ? { ...te, ...patch } : te
                  ),
                }
          ),
        })),

      moveTemplateExercise: (templateId, templateExerciseId, delta) =>
        set((s) => ({
          templates: s.templates.map((t) => {
            if (t.id !== templateId) return t;
            const list = [...t.exercises].sort((a, b) => a.position - b.position);
            const i = list.findIndex((te) => te.id === templateExerciseId);
            const j = i + delta;
            if (i < 0 || j < 0 || j >= list.length) return t;
            [list[i], list[j]] = [list[j], list[i]];
            return { ...t, exercises: list.map((te, position) => ({ ...te, position })) };
          }),
        })),

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
                      sets: Array.from({ length: 3 }, () => ({
                        targetReps: defaultTargetReps(ex),
                        targetWeight: null,
                      })),
                      restSeconds: ex?.isCompound ? 120 : 90,
                    },
                  ],
                }
          ),
        }));
      },

      replaceTemplateExercise: (templateId, templateExerciseId, exerciseId) => {
        const ex = get().exercises.find((e) => e.id === exerciseId);
        if (!ex) return;
        set((s) => ({
          templates: s.templates.map((t) =>
            t.id !== templateId
              ? t
              : {
                  ...t,
                  exercises: t.exercises.map((te) =>
                    te.id === templateExerciseId
                      ? { ...te, exerciseId, deviceId: ex.defaultDeviceId ?? null, cue: null, substitution: null }
                      : te
                  ),
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

      startSession: (templateId, dateKey) => {
        if (!canCreateSession(get().sessions)) return { id: null, blocked: true };
        const id = uid();
        const tpl = templateId ? get().templates.find((t) => t.id === templateId) : null;
        const today = dayKey(new Date());
        const date = dateKey ?? today;
        // Backdated entries get a noon timestamp on that day so they sort correctly.
        const ts = date === today ? now() : `${date}T12:00:00.000Z`;
        const session: WorkoutSession = {
          id,
          owner: LOCAL_OWNER,
          templateId: templateId ?? null,
          title: tpl?.name ?? "Quick workout",
          date,
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
        // A backdated session finishes on its own day (≈30 min), not "now".
        const backdated = session.date !== dayKey(new Date());
        const completedAt = backdated
          ? new Date(new Date(session.startedAt).getTime() + 30 * 60000).toISOString()
          : now();
        // Planned-but-never-logged sets don't belong in history.
        const unlogged = st.sets.filter((x) => x.sessionId === id && !x.completed).map((x) => x.id);
        set((s) => ({
          sessions: s.sessions.map((ss) =>
            ss.id === id ? { ...ss, status: "completed", completedAt, updatedAt: now() } : ss
          ),
          sets: unlogged.length ? s.sets.filter((x) => !unlogged.includes(x.id)) : s.sets,
          tombstones: unlogged.length ? tomb(s.tombstones, unlogged) : s.tombstones,
        }));
        return { discarded: false };
      },

      recordSessionFeedback: (sessionId, input) => {
        const feedback: SessionFeedback = {
          id: uid(),
          owner: LOCAL_OWNER,
          sessionId,
          ...input,
          createdAt: now(),
        };
        set((s) => ({
          feedback: [feedback, ...s.feedback.filter((item) => item.sessionId !== sessionId)],
        }));
      },

      discardSession: (id) =>
        set((s) => ({
          sessions: s.sessions.filter((ss) => ss.id !== id),
          sets: s.sets.filter((x) => x.sessionId !== id),
          tombstones: tomb(s.tombstones, [
            id,
            ...s.sets.filter((x) => x.sessionId === id).map((x) => x.id),
          ]),
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

        // Carry over what was just lifted; the plan's numbers are only a fallback.
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
          targetWeight: prev?.actualWeight ?? prev?.targetWeight ?? templateSet?.targetWeight ?? null,
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
        set((s) => {
          const target = s.sets.find((x) => x.id === setId);
          const sets = s.sets.map((x) => (x.id === setId ? { ...x, ...patch } : x));
          // Undoing a logged set takes back any record it set.
          const undone = target?.completed && patch.completed === false;
          return { sets, prs: undone ? withRebuiltPrs({ ...s, sets }, [target.exerciseId]) : s.prs };
        }),

      setSessionNotes: (sessionId, notes) =>
        set((s) => ({
          sessions: s.sessions.map((ss) =>
            ss.id === sessionId ? { ...ss, notes: notes.trim() || null, updatedAt: now() } : ss
          ),
        })),

      addBodyweight: (date, weightKg) =>
        set((s) => {
          // One entry per day — re-logging a day replaces it.
          const existing = s.bodyLog.find((b) => b.date === date);
          const entry: BodyweightEntry = { id: existing?.id ?? uid(), date, weightKg };
          const bodyLog = [...s.bodyLog.filter((b) => b.date !== date), entry].sort((a, b) =>
            a.date.localeCompare(b.date)
          );
          const latest = bodyLog[bodyLog.length - 1];
          return { bodyLog, profile: { ...s.profile, weightKg: latest.weightKg } };
        }),

      removeBodyweight: (id) =>
        set((s) => ({
          bodyLog: s.bodyLog.filter((b) => b.id !== id),
          tombstones: tomb(s.tombstones, [id]),
        })),

      recordCheckIn: (date, values) =>
        set((s) => {
          const existing = s.checkIns.find((c) => c.date === date);
          const entry: RecoveryCheckIn = { id: existing?.id ?? uid(), date, ...values, updatedAt: now() };
          return {
            checkIns: [...s.checkIns.filter((c) => c.date !== date), entry]
              .sort((a, b) => a.date.localeCompare(b.date))
              .slice(-MAX_CHECK_INS),
          };
        }),

      resetUserData: (opts) => {
        clearCoachChat();
        set((s) => ({
          tombstones: opts?.forget
            ? tomb(s.tombstones, [
                ...s.programs.map((x) => x.id),
                ...s.templates.map((x) => x.id),
                ...s.sessions.map((x) => x.id),
                ...s.sets.map((x) => x.id),
                ...s.bodyLog.map((x) => x.id),
                ...s.checkIns.map((x) => x.id),
                ...s.exercises.filter((e) => e.owner != null).map((x) => x.id),
                ...s.devices.filter((d) => d.owner != null).map((x) => x.id),
              ])
            : [],
          profile: { displayName: null, role: "user", goal: null, experience: null, onboarded: false },
          audit: [],
          planChanges: [],
          devices: s.devices.filter((d) => d.owner == null),
          exercises: s.exercises.filter((e) => e.owner == null),
          programs: [],
          templates: [],
          sessions: [],
          sets: [],
          feedback: [],
          prs: [],
          bodyLog: [],
          checkIns: [],
        }));
      },

      importBackup: (data) => {
        const d = upgradeWeights(data as Record<string, any>);
        const list = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
        if (!Array.isArray(d.sessions) || !Array.isArray(d.sets)) return false;
        set((s) => ({
          units: d.units === "lb" ? "lb" : "kg",
          profile: d.profile && typeof d.profile === "object" ? { ...s.profile, ...d.profile } : s.profile,
          audit: list<AuditEvent>(d.audit),
          planChanges: list<PlanChange>(d.planChanges),
          devices: mergeLibrary(SEED_DEVICES, s.devices.filter((x) => x.owner == null), list<Device>(d.devices)),
          exercises: mergeLibrary(
            SEED_EXERCISES,
            s.exercises.filter((x) => x.owner == null),
            list<Exercise>(d.exercises)
          ),
          programs: list<Program>(d.programs),
          templates: list<WorkoutTemplate>(d.templates),
          sessions: list<WorkoutSession>(d.sessions),
          sets: list<WorkoutSet>(d.sets),
          feedback: list<SessionFeedback>(d.feedback),
          prs: list<PersonalRecord>(d.prs),
          bodyLog: list<BodyweightEntry>(d.bodyLog),
          checkIns: list<RecoveryCheckIn>(d.checkIns),
          tombstones: list<Tombstone>(d.tombstones),
        }));
        return true;
      },

      completeSet: (setId) => {
        const st = get();
        const target = st.sets.find((x) => x.id === setId);
        if (!target) return { newPrs: [] };
        const bests = st.bestsFor(target.exerciseId);
        const ex = st.exercises.find((e) => e.id === target.exerciseId);
        const type = exerciseTypeOf(ex, st.devices.find((d) => d.id === target.deviceId));
        const prs =
          target.kind === "warmup" || type === "duration" || type === "cardio"
            ? []
            : detectPrs({ actualReps: target.actualReps, actualWeight: target.actualWeight }, bests, {
                assisted: type === "assisted_bodyweight",
              });
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

      removeSet: (setId) =>
        set((s) => {
          const target = s.sets.find((x) => x.id === setId);
          if (!target) return {};
          const remaining = s.sets.filter((x) => x.id !== setId);
          const tombstones = target.completed ? tomb(s.tombstones, [setId]) : s.tombstones;
          // Re-number the remaining rounds of the same exercise so labels stay 1..N.
          const siblings = remaining
            .filter((x) => x.sessionId === target.sessionId && x.exerciseId === target.exerciseId)
            .sort((a, b) => a.setIndex - b.setIndex);
          const sets = remaining.map((x) => {
            if (x.sessionId !== target.sessionId || x.exerciseId !== target.exerciseId) return x;
            return { ...x, setIndex: siblings.findIndex((y) => y.id === x.id) };
          });
          return {
            tombstones,
            sets,
            prs: target.completed ? withRebuiltPrs({ ...s, sets }, [target.exerciseId]) : s.prs,
          };
        }),

      setExerciseDevice: (sessionId, exerciseId, deviceId) =>
        set((s) => {
          const sets = s.sets.map((x) =>
            x.sessionId === sessionId && x.exerciseId === exerciseId ? { ...x, deviceId } : x
          );
          return { sets, prs: withRebuiltPrs({ ...s, sets }, [exerciseId]) };
        }),

      moveSet: (setId, toExerciseId) =>
        set((s) => {
          const target = s.sets.find((x) => x.id === setId);
          if (!target || target.exerciseId === toExerciseId) return {};
          const dest = s.sets.filter((x) => x.sessionId === target.sessionId && x.exerciseId === toExerciseId);
          const destDevice =
            dest[0]?.deviceId ?? s.exercises.find((e) => e.id === toExerciseId)?.defaultDeviceId ?? null;
          // Logged sets go after the destination's logged ones; renumber both cards.
          const moved = { ...target, exerciseId: toExerciseId, deviceId: destDevice, editedAt: now() };
          const order = (ex: string, list: WorkoutSet[]) =>
            list
              .filter((x) => x.sessionId === target.sessionId && x.exerciseId === ex)
              .sort((a, b) => Number(b.completed) - Number(a.completed) || a.setIndex - b.setIndex);
          const next = s.sets.map((x) => (x.id === setId ? { ...moved, setIndex: Number.MAX_SAFE_INTEGER } : x));
          const index = new Map<string, number>();
          for (const ex of [target.exerciseId, toExerciseId]) order(ex, next).forEach((x, i) => index.set(x.id, i));
          const sets = next.map((x) => (index.has(x.id) ? { ...x, setIndex: index.get(x.id)! } : x));
          return { sets, prs: withRebuiltPrs({ ...s, sets }, [target.exerciseId, toExerciseId]) };
        }),

      swapSessionExercise: (sessionId, fromExerciseId, toExerciseId) => {
        const s = get();
        if (fromExerciseId === toExerciseId) return 0;
        const inWorkout = s.sets.filter((x) => x.sessionId === sessionId);
        if (inWorkout.some((x) => x.exerciseId === toExerciseId)) return 0;
        const open = inWorkout
          .filter((x) => x.exerciseId === fromExerciseId && !x.completed)
          .sort((a, b) => a.setIndex - b.setIndex);
        if (open.length === 0) return 0;
        const deviceId = s.exercises.find((e) => e.id === toExerciseId)?.defaultDeviceId ?? null;
        // The old exercise's target load means nothing on the new one; reps carry over.
        const index = new Map(open.map((x, i) => [x.id, i]));
        set({
          sets: s.sets.map((x) =>
            index.has(x.id)
              ? { ...x, exerciseId: toExerciseId, deviceId, targetWeight: null, actualWeight: null, setIndex: index.get(x.id)! }
              : x,
          ),
        });
        return open.length;
      },

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
            (x) => x.sessionId === s.id && x.exerciseId === exerciseId && x.completed && !isWarmup(x)
          );
          if (sets.length > 0) {
            return {
              targetReps: sets[0].targetReps ?? 8,
              sets: sets.map((x) => ({
                actualReps: x.actualReps,
                actualWeight: x.actualWeight,
                rpe: x.rpe,
                completed: x.completed,
                durationSec: x.durationSec,
                durationMin: x.durationMin,
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
            (x) => x.sessionId === s.id && x.exerciseId === exerciseId && x.completed && !isWarmup(x)
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
          (x) => x.exerciseId === exerciseId && x.completed && !isWarmup(x)
        );
        let e1rm = 0;
        let maxReps = 0;
        for (const x of sets) {
          if (x.actualReps != null) {
            if (x.actualWeight != null) e1rm = Math.max(e1rm, epley1rm(x.actualWeight, x.actualReps));
            maxReps = Math.max(maxReps, x.actualReps);
          }
        }
        return { e1rm, maxWeight: bestWeight(sets), maxReps };
      },

      exercisesWithHistory: () => {
        const st = get();
        const seen: string[] = [];
        for (const x of st.sets) {
          const hasData =
            x.actualWeight != null ||
            x.actualReps != null ||
            x.durationMin != null ||
            x.durationSec != null;
          if (x.completed && hasData && !seen.includes(x.exerciseId)) seen.push(x.exerciseId);
        }
        return seen;
      },

      exerciseHistory: (exerciseId) => {
        const st = get();
        const sessions = st.sessions
          .filter((s) => s.status !== "archived")
          .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
        const out = [];
        for (const s of sessions) {
          const sets = st.sets.filter(
            (x) => x.sessionId === s.id && x.exerciseId === exerciseId && x.completed
          );
          if (sets.length === 0) continue;
          let e1rm = 0;
          let durationMin = 0;
          let distance = 0;
          let durationSec = 0;
          let maxReps = 0;
          let totalReps = 0;
          const working = sets.filter((x) => !isWarmup(x));
          for (const x of working) {
            if (x.actualWeight != null && x.actualReps) {
              e1rm = Math.max(e1rm, epley1rm(x.actualWeight, x.actualReps));
            }
            durationMin += x.durationMin ?? 0;
            distance += x.distance ?? 0;
            durationSec = Math.max(durationSec, x.durationSec ?? 0);
            maxReps = Math.max(maxReps, x.actualReps ?? 0);
            totalReps += x.actualReps ?? 0;
          }
          out.push({
            date: s.date,
            topWeight: bestWeight(working),
            e1rm: Math.round(e1rm * 10) / 10,
            volume: totalVolume(working),
            durationMin: Math.round(durationMin * 10) / 10,
            distance: Math.round(distance * 100) / 100,
            durationSec,
            maxReps,
            totalReps,
          });
        }
        return out;
      },
    };
    },
    {
      // New key = hard reset of all existing data (local-first has no server DB).
      // Old "trainova-v1" data is abandoned; the app starts from the seed below.
      name: "trainova-2026-06",
      version: SCHEMA_VERSION,
      migrate: migrateState,
      skipHydration: true,
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? window.localStorage : memoryStorage
      ),
      partialize: (s) => ({
        session: s.session,
        units: s.units,
        profile: s.profile,
        audit: s.audit,
        planChanges: s.planChanges,
        devices: s.devices,
        exercises: s.exercises,
        programs: s.programs,
        templates: s.templates,
        sessions: s.sessions,
        sets: s.sets,
        feedback: s.feedback,
        prs: s.prs,
        bodyLog: s.bodyLog,
        checkIns: s.checkIns,
        tombstones: s.tombstones,
      }),
    }
  )
);

// ---------------------------------------------------------------------------
// Migration to v4: introduce Device/status/per-set targets, enforce one active
// session, and reset the definitions layer to the clean seed. Best-effort and
// idempotent; preserves logged sessions/sets/PRs and custom exercises.
// ---------------------------------------------------------------------------
function migrateState(persisted: unknown, version: number): TrainovaState {
  let s = persisted as Record<string, any> | undefined;
  if (!s) return persisted as TrainovaState;
  if (version < 2) s = migrateV2(s);
  return migrateV3(s);
}

/**
 * v3: shared library refresh (new devices/exercises + richer metadata),
 * canonical-kg weights, bodyweight log and sync tombstones. Non-destructive —
 * every program, template, session and set the user has is kept.
 */
function migrateV3(s: Record<string, any>): TrainovaState {
  const up = upgradeWeights({ ...s, schema: 0 });
  return {
    ...up,
    devices: mergeLibrary(SEED_DEVICES, [], (s.devices ?? []) as Device[]),
    exercises: mergeLibrary(SEED_EXERCISES, [], (s.exercises ?? []) as Exercise[]),
    bodyLog: s.bodyLog ?? [],
    checkIns: s.checkIns ?? [],
    tombstones: s.tombstones ?? [],
  } as unknown as TrainovaState;
}

function migrateV2(s: Record<string, any>): Record<string, any> {

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
    feedback: (s.feedback ?? []).filter((item: SessionFeedback) => liveSessionIds.has(item.sessionId)),
    prs: s.prs ?? [],
  };
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
