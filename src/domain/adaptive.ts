import type { Program, SessionFeedback, WorkoutSession, WorkoutTemplate } from "./types";

export type TodayRecommendation = {
  templateId: string;
  planName: string;
  mode: "standard" | "recovery";
  headline: string;
  reason: string;
};

/**
 * Chooses the next plan and constrains intensity using the latest explicit
 * athlete signal. This stays deterministic so the UI can explain every choice.
 */
export function recommendToday(input: {
  templates: WorkoutTemplate[];
  programs: Program[];
  sessions: WorkoutSession[];
  feedback: SessionFeedback[];
}): TodayRecommendation | null {
  const { templates, programs, sessions, feedback } = input;
  if (templates.length === 0) return null;

  const completed = sessions
    .filter((session) => session.status === "completed")
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const latest = completed[0];
  let template = templates[0];

  if (latest?.templateId) {
    const program = programs.find((item) => item.dayTemplateIds.includes(latest.templateId!));
    const position = program?.dayTemplateIds.indexOf(latest.templateId) ?? -1;
    const nextId = program && position >= 0
      ? program.dayTemplateIds[(position + 1) % program.dayTemplateIds.length]
      : latest.templateId;
    template = templates.find((item) => item.id === nextId) ?? template;
  }

  const latestFeedback = latest
    ? feedback
        .filter((item) => item.sessionId === latest.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
    : undefined;
  const recovery = Boolean(
      latestFeedback?.pain ||
      latestFeedback?.difficulty === "hard" ||
      (latestFeedback?.energy ?? 5) <= 2,
  );

  if (recovery) {
    return {
      templateId: template.id,
      planName: template.name,
      mode: "recovery",
      headline: "Keep today controlled",
      reason: latestFeedback?.pain
        ? "You reported discomfort last session. Stop if symptoms worsen and choose pain-free variations."
        : "Your last check-in suggested higher fatigue. Keep 2–3 reps in reserve and skip optional rounds.",
    };
  }

  return {
    templateId: template.id,
    planName: template.name,
    mode: "standard",
    headline: "Your next best session",
    reason: latestFeedback
      ? "Your last check-in supports a normal progression session."
      : "Start with this plan, then rate the session so Trainova can adapt the next one.",
  };
}
