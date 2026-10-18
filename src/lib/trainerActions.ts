"use client";

import { describeAction, type PlanItem, type TrainerAction } from "@/domain/trainer";
import { capturePlan, createdIds, stampsOf } from "@/domain/planChanges";
import { useStore } from "@/lib/store";
import { uid } from "@/lib/id";

export type ApplyResult = { ok: true; href: string; changeId: string } | { ok: false; error: string };

type Store = ReturnType<typeof useStore.getState>;

/** Fill a template with plan items (sets × reps per item). */
function fill(st: Store, templateId: string, items: (Omit<PlanItem, "restSeconds"> & { restSeconds?: number })[]) {
  for (const it of items) {
    st.addTemplateExercise(templateId, it.exerciseId);
    const tpl = useStore.getState().templates.find((t) => t.id === templateId);
    const te = tpl?.exercises.reduce((a, b) => (b.position > a.position ? b : a));
    if (!te) continue;
    st.setTemplateSetCount(templateId, te.id, it.sets);
    for (let i = 0; i < it.sets; i++) st.updateTemplateSet(templateId, te.id, i, { targetReps: it.reps });
    if (it.restSeconds) st.updateTemplateExercise(templateId, te.id, { restSeconds: it.restSeconds });
  }
}

/**
 * Applies a validated coach action to the local plan and records it in the
 * plan-change history (what changed, from what), so it can be undone.
 */
export function applyTrainerAction(a: TrainerAction): ApplyResult {
  const before = useStore.getState();
  const touched = "templateId" in a ? [a.templateId] : [];
  const snapshot = capturePlan(before, touched, []);
  const r = apply(a);
  if (!r.ok) return r;
  const after = useStore.getState();
  const base = { before: snapshot, created: createdIds(before, after) };
  const { title, detail } = describeAction(a);
  const changeId = uid();
  after.recordPlanChange({
    id: changeId,
    at: new Date().toISOString(),
    source: "ai_coach",
    actionType: a.type,
    title,
    detail,
    ...base,
    stamps: stampsOf(after, base),
    undoneAt: null,
  });
  return { ...r, changeId };
}

/** Undo an applied coach action; refuses if the plan was edited since. */
export function undoTrainerAction(changeId: string) {
  return useStore.getState().undoPlanChange(changeId);
}

/**
 * Re-checks that the workout and slot still exist — the plan may have changed
 * since the reply.
 */
function apply(a: TrainerAction): { ok: true; href: string } | { ok: false; error: string } {
  const st = useStore.getState();
  if (a.type === "create_workout") {
    const id = st.createTemplate(a.name);
    fill(st, id, a.exercises);
    return { ok: true, href: `/templates/${id}` };
  }
  if (a.type === "create_program") {
    const programId = st.createProgram(a.name, "self");
    for (const d of a.days) fill(st, st.addDayToProgram(programId, d.name), d.exercises);
    return { ok: true, href: `/programs/${programId}` };
  }

  const tpl = st.templates.find((t) => t.id === a.templateId);
  if (!tpl) return { ok: false, error: "That workout no longer exists." };
  const href = `/templates/${tpl.id}`;
  if (a.type === "add_exercise") {
    fill(st, tpl.id, [{ exerciseId: a.exerciseId, name: a.name, sets: a.sets, reps: a.reps }]);
    return { ok: true, href };
  }
  const te = tpl.exercises.find((x) => x.id === a.teId);
  if (!te) return { ok: false, error: "That exercise is no longer in the workout." };
  switch (a.type) {
    case "swap_exercise":
      st.replaceTemplateExercise(tpl.id, te.id, a.exerciseId);
      break;
    case "set_volume":
      st.setTemplateSetCount(tpl.id, te.id, a.sets);
      for (let i = 0; i < a.sets; i++) st.updateTemplateSet(tpl.id, te.id, i, { targetReps: a.reps });
      break;
    case "remove_exercise":
      st.removeTemplateExercise(tpl.id, te.id);
      break;
  }
  return { ok: true, href };
}
