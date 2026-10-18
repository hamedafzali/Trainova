"use client";

// Pieces shared by Plan (/programs) and Workouts (/templates): a startable
// workout row, the user's programs with their days, and the program library.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, Clock, Play, Plus } from "lucide-react";
import { useStore } from "@/lib/store";
import { recommendToday } from "@/domain/adaptive";
import { PROGRAM_BLUEPRINTS, type ProgramBlueprint } from "@/data/programs";
import { SEED_PLAN_ID, SEED_PROGRAM_ID } from "@/lib/seed";
import { label } from "@/domain/taxonomy";
import type { WorkoutTemplate } from "@/domain/types";

const SETTING_LABEL: Record<ProgramBlueprint["setting"], string> = {
  gym: "Full gym",
  machines: "Machines",
  dumbbells: "Dumbbells",
  bodyweight: "Bodyweight",
};

function minutesFor(t: WorkoutTemplate): number {
  const sec = t.exercises.reduce((n, te) => n + te.sets.length * (40 + te.restSeconds), 0);
  return Math.max(5, Math.round(sec / 60 / 5) * 5);
}

/** Starts a workout, or resumes the one already running. */
export function useStartWorkout() {
  const router = useRouter();
  const startSession = useStore((s) => s.startSession);
  const getActiveSession = useStore((s) => s.getActiveSession);
  return (templateId: string) => {
    const { id, blocked } = startSession(templateId);
    if (blocked) {
      const a = getActiveSession();
      if (a) router.push(`/session/${a.id}`);
      return;
    }
    if (id) router.push(`/session/${id}`);
  };
}

/** What the rows need to mark "Up next" and "last done". */
function useRowInfo() {
  const programs = useStore((s) => s.programs);
  const templates = useStore((s) => s.templates);
  const sessions = useStore((s) => s.sessions);
  const feedback = useStore((s) => s.feedback);
  const getActiveSession = useStore((s) => s.getActiveSession);
  const active = getActiveSession();
  const nextId = active ? null : recommendToday({ templates, programs, sessions, feedback })?.templateId;
  const lastDone = new Map<string, string>();
  for (const s of sessions)
    if (s.templateId && s.status === "completed" && (lastDone.get(s.templateId) ?? "") < s.date)
      lastDone.set(s.templateId, s.date);
  return { nextId, lastDone };
}

export function WorkoutRows({ templates, prefix }: { templates: WorkoutTemplate[]; prefix?: (i: number) => string }) {
  const start = useStartWorkout();
  const { nextId, lastDone } = useRowInfo();
  return (
    <ul className="divide-y divide-border">
      {templates.map((t, i) => {
        const isNext = t.id === nextId;
        const last = lastDone.get(t.id);
        return (
          <li key={t.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
            <Link href={`/templates/${t.id}`} className="-my-1 min-w-0 flex-1 py-1">
              <p className="flex items-center gap-2 font-medium text-ink">
                <span className="truncate">
                  {prefix && <span className="text-muted">{prefix(i)} · </span>}
                  {t.name}
                </span>
                {isNext && <span className="badge-accent shrink-0 text-[10px]">Up next</span>}
                {t.id === SEED_PLAN_ID && <span className="badge-neutral shrink-0 text-[10px]">Sample</span>}
              </p>
              <p className="mt-0.5 truncate text-xs text-muted">
                {t.exercises.length} exercise{t.exercises.length === 1 ? "" : "s"}
                {t.exercises.length > 0 && ` · ~${minutesFor(t)} min`}
                {last && ` · last ${new Date(last + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}`}
              </p>
            </Link>
            <button
              type="button"
              aria-label={`Start ${t.name}`}
              disabled={t.exercises.length === 0}
              onClick={() => start(t.id)}
              className={`shrink-0 ${isNext ? "btn-primary" : "btn-secondary"} min-h-11 px-4 py-2 text-sm`}
            >
              <Play className="h-3.5 w-3.5" aria-hidden /> Start
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** The user's programs, each with its days. */
export function ProgramList() {
  const programs = useStore((s) => s.programs);
  const daysForProgram = useStore((s) => s.daysForProgram);
  return (
    <>
      {programs.map((p) => {
        const days = daysForProgram(p.id);
        return (
          <div key={p.id} className="overflow-hidden rounded-card border border-border bg-surface">
            <Link
              href={`/programs/${p.id}`}
              className="flex items-center gap-3 border-b border-border px-4 py-3.5 transition-colors hover:bg-surface2/60 sm:px-5"
            >
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                  {p.name}
                  {p.source === "trainer" && <span className="badge-accent text-[10px]">Trainer</span>}
                  {p.id === SEED_PROGRAM_ID && <span className="badge-neutral text-[10px]">Sample</span>}
                </p>
                <p className="text-xs text-muted">
                  {days.length} day{days.length === 1 ? "" : "s"} · rotate in order
                </p>
              </div>
              <span className="text-sm font-medium text-accent">Edit</span>
              <ChevronRight className="h-4 w-4 text-muted" aria-hidden />
            </Link>
            {days.length > 0 ? (
              <WorkoutRows templates={days} prefix={(i) => `Day ${i + 1}`} />
            ) : (
              <p className="px-5 py-4 text-sm text-muted">No days yet — open the program to add one.</p>
            )}
          </div>
        );
      })}
    </>
  );
}

/** Ready-made programs the user can add. */
export function ProgramLibrary() {
  const router = useRouter();
  const programs = useStore((s) => s.programs);
  const installProgram = useStore((s) => s.installProgram);
  const installed = new Set(programs.map((p) => p.blueprintId).filter(Boolean));
  return (
    <section className="space-y-3" aria-labelledby="program-library">
      <div>
        <h2 id="program-library" className="text-h2 text-ink">
          Program library
        </h2>
        <p className="text-sm text-muted">Evidence-based programs with sets, reps and rest already set up. Edit anything after adding.</p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {PROGRAM_BLUEPRINTS.map((bp) => {
          const has = installed.has(bp.id);
          return (
            <li key={bp.id} className="card flex flex-col gap-3 p-4 sm:p-5">
              <div>
                <p className="font-semibold text-ink">{bp.name}</p>
                <p className="mt-1 text-sm text-inkSoft">{bp.summary}</p>
              </div>
              <div className="flex flex-wrap gap-1.5 text-xs">
                <span className="badge-neutral">{bp.daysPerWeek}× / week</span>
                <span className="badge-neutral">{label(bp.level)}</span>
                <span className="badge-neutral">{SETTING_LABEL[bp.setting]}</span>
                <span className="badge-neutral inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" aria-hidden /> ~{bp.minutes} min
                </span>
              </div>
              <p className="text-xs text-muted">{bp.days.map((d) => d.name).join(" · ")}</p>
              <button
                type="button"
                className={`${has ? "btn-ghost" : "btn-secondary"} mt-auto w-full py-2.5 text-sm`}
                onClick={() => {
                  const id = installProgram(bp.id);
                  if (id) router.push(`/programs/${id}`);
                }}
              >
                {has ? (
                  <>
                    <Check className="h-4 w-4" aria-hidden /> Added · add another copy
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" aria-hidden /> Add program
                  </>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
