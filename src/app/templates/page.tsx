"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, ChevronRight, Clock, Play, Plus, Sparkles } from "lucide-react";
import { useHydrated, useStore } from "@/lib/store";
import { AssignmentsInbox } from "@/components/AssignmentsInbox";
import { ListSkeleton } from "@/components/Skeleton";
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

export default function PlansPage() {
  const hydrated = useHydrated();
  const router = useRouter();
  const programs = useStore((s) => s.programs);
  const templates = useStore((s) => s.templates);
  const sessions = useStore((s) => s.sessions);
  const feedback = useStore((s) => s.feedback);
  const daysForProgram = useStore((s) => s.daysForProgram);
  const createProgram = useStore((s) => s.createProgram);
  const createTemplate = useStore((s) => s.createTemplate);
  const installProgram = useStore((s) => s.installProgram);
  const startSession = useStore((s) => s.startSession);
  const getActiveSession = useStore((s) => s.getActiveSession);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState<null | "plan" | "program">(null);

  const start = (templateId: string) => {
    const { id, blocked } = startSession(templateId);
    if (blocked) {
      const a = getActiveSession();
      if (a) router.push(`/session/${a.id}`);
      return;
    }
    if (id) router.push(`/session/${id}`);
  };

  const create = () => {
    const n = name.trim();
    if (!n || !creating) return;
    setName("");
    setCreating(null);
    if (creating === "plan") router.push(`/templates/${createTemplate(n)}`);
    else router.push(`/programs/${createProgram(n, "self")}`);
  };

  if (!hydrated)
    return (
      <main className="mx-auto max-w-3xl space-y-6">
        <h1 className="page-title">Plans</h1>
        <ListSkeleton />
      </main>
    );

  const inProgram = new Set(programs.flatMap((p) => p.dayTemplateIds));
  const standalone = templates.filter((t) => !inProgram.has(t.id));
  const active = getActiveSession();
  const nextId = recommendToday({ templates, programs, sessions, feedback })?.templateId;
  const installed = new Set(programs.map((p) => p.blueprintId).filter(Boolean));
  const lastDone = new Map<string, string>();
  for (const s of sessions)
    if (s.templateId && s.status === "completed" && (lastDone.get(s.templateId) ?? "") < s.date)
      lastDone.set(s.templateId, s.date);

  const dayRow = (t: WorkoutTemplate, prefix?: string) => {
    const isNext = !active && t.id === nextId;
    const last = lastDone.get(t.id);
    return (
      <li key={t.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
        <Link href={`/templates/${t.id}`} className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-medium text-ink">
            <span className="truncate">
              {prefix && <span className="text-muted">{prefix} · </span>}
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
          className={`shrink-0 ${isNext ? "btn-primary" : "btn-secondary"} px-4 py-2 text-sm`}
        >
          <Play className="h-3.5 w-3.5" aria-hidden /> Start
        </button>
      </li>
    );
  };

  return (
    <main className="mx-auto max-w-3xl space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Plans</h1>
          <p className="page-subtitle">Your programs and routines, plus proven programs to start from.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary px-4 py-2.5 text-sm" onClick={() => setCreating(creating === "plan" ? null : "plan")}>
            <Plus className="h-4 w-4" aria-hidden /> Workout
          </button>
          <button className="btn-secondary px-4 py-2.5 text-sm" onClick={() => setCreating(creating === "program" ? null : "program")}>
            <Plus className="h-4 w-4" aria-hidden /> Program
          </button>
        </div>
      </header>

      {creating && (
        <form
          className="card flex flex-col gap-3 p-4 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            create();
          }}
        >
          <label htmlFor="new-plan-name" className="sr-only">
            {creating === "plan" ? "Workout name" : "Program name"}
          </label>
          <input
            id="new-plan-name"
            autoFocus
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            placeholder={creating === "plan" ? "Workout name, e.g. Arms & Abs" : "Program name, e.g. My 4-day split"}
            className="input flex-1"
          />
          <div className="flex gap-2">
            <button type="button" className="btn-ghost flex-1 sm:flex-none" onClick={() => setCreating(null)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary flex-1 sm:flex-none" disabled={!name.trim()}>
              Create
            </button>
          </div>
        </form>
      )}

      {active && (
        <Link
          href={`/session/${active.id}`}
          className="card flex items-center gap-4 border-accent/30 bg-accent/[0.06] p-4 transition-colors hover:bg-accent/[0.1] sm:p-5"
        >
          <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-accent" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="section-label text-accent">In progress</p>
            <p className="truncate font-semibold text-ink">{active.title}</p>
          </div>
          <span className="btn-primary px-4 py-2 text-sm">Resume</span>
        </Link>
      )}

      <AssignmentsInbox />

      {programs.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-h2 text-ink">Programs</h2>
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
                  <ul className="divide-y divide-border">{days.map((d, i) => dayRow(d, `Day ${i + 1}`))}</ul>
                ) : (
                  <p className="px-5 py-4 text-sm text-muted">No days yet — open the program to add one.</p>
                )}
              </div>
            );
          })}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-h2 text-ink">Single workouts</h2>
        {standalone.length === 0 ? (
          <button
            type="button"
            onClick={() => setCreating("plan")}
            className="flex w-full items-center justify-center gap-1.5 rounded-card border border-dashed border-border py-5 text-sm font-semibold text-accent hover:bg-accent/[0.05]"
          >
            <Plus className="h-4 w-4" aria-hidden /> Create a workout
          </button>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
            {standalone.map((t) => dayRow(t))}
          </ul>
        )}
        <Link
          href={`/coach?ask=${encodeURIComponent("Build me a workout for today")}`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline"
        >
          <Sparkles className="h-4 w-4" aria-hidden /> Ask your coach to build one
        </Link>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-h2 text-ink">Program library</h2>
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
    </main>
  );
}
