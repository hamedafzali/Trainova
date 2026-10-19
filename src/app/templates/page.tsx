"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ClipboardList, Dumbbell, History, ListChecks, Play, Plus } from "lucide-react";
import { CoachCard, EmptySlot, HeroCard, IconButton, ListCard, ListRow, PageHeader, SectionHeader } from "@/components/kit";
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
      <PageHeader
        title="Workouts"
        subtitle="Start a workout from your program or one of your own."
        actions={
          <>
            <IconButton href="/exercises" icon={ListChecks} label="Exercises" />
            <IconButton href="/history" icon={History} label="History" />
            <IconButton icon={Plus} label="New workout" onClick={() => setCreating(!creating)} pressed={creating} />
          </>
        }
      />

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
        <HeroCard
          title={active.title}
          watermark={Dumbbell}
          eyebrow={
            <>
              <span className="h-2 w-2 rounded-full bg-volt motion-safe:animate-pulse" aria-hidden /> In progress
            </>
          }
        >
          <p className="mb-6 text-sm text-white/60">Pick up where you left off.</p>
          <Link href={`/session/${active.id}`} className="btn-volt-glow">
            <Play className="h-[18px] w-[18px] fill-current" aria-hidden /> Resume workout
          </Link>
        </HeroCard>
      )}

      {programs.length > 0 && (
        <section className="space-y-3" aria-labelledby="from-programs">
          <SectionHeader id="from-programs" title="From your programs" />
          <ProgramList />
        </section>
      )}

      <section aria-labelledby="single-workouts">
        <SectionHeader id="single-workouts" title="Single workouts" />
        {standalone.length === 0 ? (
          <EmptySlot
            action={
              <button type="button" onClick={() => setCreating(true)} className="btn-secondary px-4 py-2.5 text-sm">
                <Plus className="h-4 w-4" aria-hidden /> Create a workout
              </button>
            }
          >
            Workouts outside a program live here.
          </EmptySlot>
        ) : (
          <div className="card overflow-hidden p-0">
            <WorkoutRows templates={standalone} />
          </div>
        )}
      </section>

      <CoachCard
        text="Tell your coach how long you have and what equipment is free, and it builds today's workout."
        href={`/coach?ask=${encodeURIComponent("Build me a workout for today")}`}
        cta="Build me a workout"
      />

      <ListCard>
        <ListRow href="/programs" icon={ClipboardList} tone="accent" title="Browse programs" meta="Ready-made programs in your Plan tab." />
      </ListCard>
    </main>
  );
}
