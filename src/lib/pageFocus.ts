"use client";

import { useStore } from "@/lib/store";
import { kgToUnits } from "@/domain/trainer";

export interface PageFocus {
  /** Sent to the coach as what the client has open; null when nothing specific. */
  viewing: string | null;
  /** Short label for the assistant header. */
  label: string | null;
  suggestions: string[];
}

const GENERAL = [
  "What should I train today?",
  "Give me targets for my next workout",
  "Review my last 4 weeks",
];

/** What the current page is about, so the assistant can answer "this workout" questions. */
export function pageFocus(pathname: string): PageFocus {
  const st = useStore.getState();
  const [, section, id] = pathname.split("/");
  const exName = (exerciseId: string) => st.exercises.find((e) => e.id === exerciseId)?.name ?? "Exercise";

  if (section === "session" && id) {
    const session = st.sessions.find((x) => x.id === id);
    if (session) {
      const sets = st.sets.filter((x) => x.sessionId === id && x.kind !== "warmup");
      const order: string[] = [];
      for (const x of sets) if (!order.includes(x.exerciseId)) order.push(x.exerciseId);
      const parts = order.map((exerciseId) => {
        const mine = sets.filter((x) => x.exerciseId === exerciseId);
        const done = mine.filter((x) => x.completed);
        const last = done.at(-1);
        const lastTxt =
          last?.actualWeight != null && last.actualReps != null
            ? `, last ${kgToUnits(last.actualWeight, st.units)}${st.units}×${last.actualReps}`
            : last?.actualReps != null
              ? `, last ${last.actualReps} reps`
              : "";
        return `${exName(exerciseId)} ${done.length}/${mine.length} sets done${lastTxt}`;
      });
      const state = session.status === "active" ? "is in the middle of the workout" : "is looking at the logged workout";
      return {
        viewing: `${state} "${session.title}" (${session.date}): ${parts.join("; ") || "no exercises yet"}`,
        label: session.title,
        suggestions:
          session.status === "active"
            ? ["What weight should I use on my next set?", "Swap an exercise in this workout", "Short on time — trim this workout"]
            : ["How did this workout go?", "What should I change next time?"],
      };
    }
  }
  if (section === "templates" && id) {
    const t = st.templates.find((x) => x.id === id);
    if (t) {
      return {
        viewing: `the plan editor for the workout "${t.name}"`,
        label: t.name,
        suggestions: ["Improve this workout", "Is this enough volume for my goal?", "Make this workout shorter"],
      };
    }
  }
  if (section === "programs" && id) {
    const p = st.programs.find((x) => x.id === id);
    if (p) {
      return {
        viewing: `the program "${p.name}" (${p.dayTemplateIds.length} workouts)`,
        label: p.name,
        suggestions: ["Is this program balanced?", "How many days a week should I run this?", "Improve this program"],
      };
    }
  }
  if (section === "exercises" && id) {
    const e = st.exercises.find((x) => x.id === id);
    if (e) {
      return {
        viewing: `the exercise "${e.name}" [${e.id}]`,
        label: e.name,
        suggestions: [`How do I do ${e.name} well?`, "What can I do instead?", "How should I progress on it?"],
      };
    }
  }
  const pages: Record<string, PageFocus> = {
    templates: { viewing: "their list of plans", label: "Train", suggestions: ["Build me a plan", "Improve my plan", ...GENERAL.slice(0, 1)] },
    programs: { viewing: "the program library", label: "Programs", suggestions: ["Which program suits me?", "Build me a plan"] },
    exercises: { viewing: "the exercise library", label: "Exercises", suggestions: ["Suggest exercises for a weak spot", "What's a good back exercise without a barbell?"] },
    history: { viewing: "their workout history", label: "History", suggestions: ["Review my last 4 weeks", "Am I training often enough?"] },
    calendar: { viewing: "their training calendar", label: "Calendar", suggestions: ["Am I training often enough?", "Plan my week"] },
    progress: { viewing: "their progress charts", label: "Progress", suggestions: ["Which lifts are stalling?", "Review my progress"] },
  };
  return pages[section] ?? { viewing: null, label: null, suggestions: GENERAL };
}
