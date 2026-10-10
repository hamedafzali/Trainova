import type {
  BodyweightEntry,
  Exercise,
  WorkoutSession,
  WorkoutSet,
} from "@/domain/types";

/** Persisted personal data, as stored by the app (weights in kg). */
export type BackupSource = Record<string, unknown> & {
  sessions: WorkoutSession[];
  sets: WorkoutSet[];
  exercises: Exercise[];
  bodyLog: BodyweightEntry[];
};

/**
 * Full JSON backup. `schema` marks weights as already canonical kg so
 * `importBackup` (via upgradeWeights) never converts them a second time.
 */
export function buildBackup(state: Record<string, unknown>, schema: number) {
  return {
    ...state,
    app: "trainova",
    schema,
    exportedAt: new Date().toISOString(),
    weightUnit: "kg",
  };
}

function cell(v: string | number | null | undefined): string {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const CSV_HEADER = [
  "date",
  "workout",
  "exercise",
  "set",
  "set_type",
  "weight_kg",
  "reps",
  "rpe",
  "duration_sec",
  "duration_min",
  "distance_km",
  "notes",
];

/** One row per logged set, oldest first — opens cleanly in any spreadsheet. */
export function buildSetsCsv(src: Pick<BackupSource, "sessions" | "sets" | "exercises">): string {
  const sessions = new Map(src.sessions.map((s) => [s.id, s]));
  const names = new Map(src.exercises.map((e) => [e.id, e.name]));
  const rows = src.sets
    .filter((x) => x.completed && sessions.get(x.sessionId)?.status !== "archived" && sessions.has(x.sessionId))
    .sort((a, b) => {
      const sa = sessions.get(a.sessionId)!;
      const sb = sessions.get(b.sessionId)!;
      return sa.startedAt.localeCompare(sb.startedAt) || a.exerciseId.localeCompare(b.exerciseId) || a.setIndex - b.setIndex;
    })
    .map((x) => {
      const s = sessions.get(x.sessionId)!;
      return [
        s.date,
        s.title,
        names.get(x.exerciseId) ?? x.exerciseId,
        x.setIndex + 1,
        x.kind ?? "normal",
        x.actualWeight,
        x.actualReps,
        x.rpe,
        x.durationSec,
        x.durationMin,
        x.distance,
        s.notes,
      ]
        .map(cell)
        .join(",");
    });
  return [CSV_HEADER.join(","), ...rows].join("\n") + "\n";
}

/** Trigger a browser download of text content. */
export function download(filename: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
