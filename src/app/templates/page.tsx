"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronRight, ClipboardList, History, ListChecks, Plus, Sparkles } from "lucide-react";
import { useHydrated, useStore } from "@/lib/store";
import { ListSkeleton } from "@/components/Skeleton";
import { ProgramList, WorkoutRows } from "@/components/plan/PlanSections";

/** Workouts tab: what you can start now, single workouts, and the way to exercises and history. */
export default function WorkoutsPage() {
  const hydrated = useHydrated();
  const router = useRouter();
  const programs = useStore((s) => s.programs);
  const templates = useStore((s) => s.templates);
  const createTemplate = useStore((s) => s.createTemplate);
  const getActiveSession = useStore((s) => s.getActiveSession);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  const create = () => {
    const n = name.trim();
    if (!n) return;
    setName("");
    setCreating(false);
    router.push(`/templates/${createTemplate(n)}`);
  };

  if (!hydrated)
    return (
      <main className="mx-auto max-w-3xl space-y-6">
        <h1 className="page-title">Workouts</h1>
        <ListSkeleton />
      </main>
    );

  const inProgram = new Set(programs.flatMap((p) => p.dayTemplateIds));
  const standalone = templates.filter((t) => !inProgram.has(t.id));
  const active = getActiveSession();

  return (
    <main className="mx-auto max-w-3xl space-y-8 pb-20 md:pb-0">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Workouts</h1>
          <p className="page-subtitle">Start a workout from your program or one of your own.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/exercises" className="btn-ghost px-4 py-2.5 text-sm">
            <ListChecks className="h-4 w-4" aria-hidden /> Exercises
          </Link>
          <Link href="/history" className="btn-ghost px-4 py-2.5 text-sm">
            <History className="h-4 w-4" aria-hidden /> History
          </Link>
          <button className="btn-secondary px-4 py-2.5 text-sm" onClick={() => setCreating(!creating)}>
            <Plus className="h-4 w-4" aria-hidden /> Workout
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
            Workout name
          </label>
          <input
            id="new-plan-name"
            autoFocus
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            placeholder="Workout name, e.g. Arms & Abs"
            className="input flex-1"
          />
          <div className="flex gap-2">
            <button type="button" className="btn-ghost flex-1 sm:flex-none" onClick={() => setCreating(false)}>
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

      {programs.length > 0 && (
        <section className="space-y-3" aria-labelledby="from-programs">
          <h2 id="from-programs" className="text-h2 text-ink">
            From your programs
          </h2>
          <ProgramList />
        </section>
      )}

      <section className="space-y-3" aria-labelledby="single-workouts">
        <h2 id="single-workouts" className="text-h2 text-ink">
          Single workouts
        </h2>
        {standalone.length === 0 ? (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex w-full items-center justify-center gap-1.5 rounded-card border border-dashed border-border py-5 text-sm font-semibold text-accent hover:bg-accent/[0.05]"
          >
            <Plus className="h-4 w-4" aria-hidden /> Create a workout
          </button>
        ) : (
          <div className="overflow-hidden rounded-card border border-border bg-surface">
            <WorkoutRows templates={standalone} />
          </div>
        )}
        <Link
          href={`/coach?ask=${encodeURIComponent("Build me a workout for today")}`}
          className="-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-control px-2 text-sm font-semibold text-accent hover:underline"
        >
          <Sparkles className="h-4 w-4" aria-hidden /> Ask your coach to build one
        </Link>
      </section>

      <Link href="/programs" className="card flex items-center gap-4 p-4 transition-colors hover:bg-surface2/60 sm:p-5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
          <ClipboardList className="h-5 w-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-ink">Browse programs</span>
          <span className="block text-sm text-muted">Ready-made programs in your Plan tab.</span>
        </span>
        <ChevronRight className="h-4 w-4 text-muted" aria-hidden />
      </Link>
    </main>
  );
}
