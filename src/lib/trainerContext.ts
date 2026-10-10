"use client";

import { useStore } from "@/lib/store";
import { recommendToday } from "@/domain/adaptive";
import { buildTrainerContext, type TrainerContext } from "@/domain/trainer";

/** Snapshot of the local store for the AI trainer. */
export function currentTrainerContext(): TrainerContext {
  const st = useStore.getState();
  const rec = recommendToday({ templates: st.templates, programs: st.programs, sessions: st.sessions, feedback: st.feedback });
  return buildTrainerContext({
    now: new Date(),
    units: st.units,
    profile: st.profile,
    programs: st.programs,
    templates: st.templates,
    sessions: st.sessions,
    sets: st.sets,
    prs: st.prs,
    feedback: st.feedback,
    exercises: st.exercises,
    nextTemplateId: rec?.templateId ?? null,
  });
}
