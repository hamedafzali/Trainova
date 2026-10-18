// Audit trail + undo for plan changes the AI coach applied. Every applied
// action records what the affected workouts and programs looked like before,
// which records it created, and their edit stamps right after. Undo restores
// the "before" copies and deletes what was created — but only while nothing
// was edited since, so undo can never silently throw away the user's own work.

import type { Program, WorkoutTemplate } from "./types";

export interface PlanChange {
  id: string;
  at: string;
  /** Who made the change. Only the AI coach records changes today. */
  source: "ai_coach";
  actionType: string;
  title: string;
  detail: string;
  before: { templates: WorkoutTemplate[]; programs: Program[] };
  created: { templateIds: string[]; programIds: string[] };
  /** Edit stamp of every touched record right after the change was applied. */
  stamps: Record<string, string | null>;
  undoneAt: string | null;
  /** Sync keeps the newer copy (an undo stamps it). */
  updatedAt?: string | null;
}

/** Keep the audit trail bounded. */
export const MAX_PLAN_CHANGES = 100;

type Plan = { templates: WorkoutTemplate[]; programs: Program[] };

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/** Deep copies of the given records, so later edits can't mutate the snapshot. */
export function capturePlan(plan: Plan, templateIds: string[], programIds: string[]): PlanChange["before"] {
  return {
    templates: plan.templates.filter((t) => templateIds.includes(t.id)).map(clone),
    programs: plan.programs.filter((p) => programIds.includes(p.id)).map(clone),
  };
}

/** Ids that appear in `after` but not in `before`. */
export function createdIds(before: Plan, after: Plan): PlanChange["created"] {
  const t = new Set(before.templates.map((x) => x.id));
  const p = new Set(before.programs.map((x) => x.id));
  return {
    templateIds: after.templates.filter((x) => !t.has(x.id)).map((x) => x.id),
    programIds: after.programs.filter((x) => !p.has(x.id)).map((x) => x.id),
  };
}

/** Current edit stamps of the records a change touched. */
export function stampsOf(plan: Plan, change: Pick<PlanChange, "before" | "created">): Record<string, string | null> {
  const ids = [
    ...change.before.templates.map((x) => x.id),
    ...change.before.programs.map((x) => x.id),
    ...change.created.templateIds,
    ...change.created.programIds,
  ];
  const out: Record<string, string | null> = {};
  for (const id of ids) {
    const rec = plan.templates.find((x) => x.id === id) ?? plan.programs.find((x) => x.id === id);
    out[id] = rec?.updatedAt ?? null;
  }
  return out;
}

export type UndoResult =
  | { ok: true; templates: WorkoutTemplate[]; programs: Program[]; deleted: string[] }
  | { ok: false; error: string };

/**
 * The plan with `change` reverted. Refuses when it was already undone or when
 * any touched record was edited (or deleted) after the change.
 */
export function undoPlan(plan: Plan, change: PlanChange, at = new Date().toISOString()): UndoResult {
  if (change.undoneAt) return { ok: false, error: "This change was already undone." };
  for (const [id, stamp] of Object.entries(change.stamps)) {
    const rec = plan.templates.find((x) => x.id === id) ?? plan.programs.find((x) => x.id === id);
    if (!rec) return { ok: false, error: "A workout this change touched was deleted since." };
    if ((rec.updatedAt ?? null) !== stamp) {
      return { ok: false, error: "You've edited this since — undo it by hand so your edits aren't lost." };
    }
  }
  const deleted = [...change.created.templateIds, ...change.created.programIds];
  const gone = new Set(deleted);
  // Restored copies are a new edit: a fresh stamp so sync doesn't prefer the changed copy.
  const restoreT = new Map(change.before.templates.map((x) => [x.id, { ...clone(x), updatedAt: at }]));
  const restoreP = new Map(change.before.programs.map((x) => [x.id, { ...clone(x), updatedAt: at }]));
  return {
    ok: true,
    templates: plan.templates.filter((t) => !gone.has(t.id)).map((t) => restoreT.get(t.id) ?? t),
    programs: plan.programs
      .filter((p) => !gone.has(p.id))
      .map((p) => restoreP.get(p.id) ?? p)
      // A created day template may still be listed on a surviving program.
      .map((p) =>
        p.dayTemplateIds.some((d) => gone.has(d)) ? { ...p, dayTemplateIds: p.dayTemplateIds.filter((d) => !gone.has(d)) } : p
      ),
    deleted,
  };
}
