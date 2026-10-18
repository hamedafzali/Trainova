"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CalendarDays, ChevronRight, Plus } from "lucide-react";
import { useHydrated, useStore } from "@/lib/store";
import { AssignmentsInbox } from "@/components/AssignmentsInbox";
import { ListSkeleton } from "@/components/Skeleton";
import { ProgramLibrary, ProgramList } from "@/components/plan/PlanSections";

/** Plan tab: the programs you follow, the calendar, and programs to add. */
export default function PlanPage() {
  const hydrated = useHydrated();
  const router = useRouter();
  const programs = useStore((s) => s.programs);
  const createProgram = useStore((s) => s.createProgram);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

  if (!hydrated)
    return (
      <main className="mx-auto max-w-3xl space-y-6">
        <h1 className="page-title">Plan</h1>
        <ListSkeleton />
      </main>
    );

  const create = () => {
    const n = name.trim();
    if (!n) return;
    setName("");
    setCreating(false);
    router.push(`/programs/${createProgram(n, "self")}`);
  };

  return (
    <main className="mx-auto max-w-3xl space-y-8 pb-20 md:pb-0">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Plan</h1>
          <p className="page-subtitle">The programs you follow and when you train.</p>
        </div>
        <button className="btn-secondary px-4 py-2.5 text-sm" onClick={() => setCreating(!creating)}>
          <Plus className="h-4 w-4" aria-hidden /> Program
        </button>
      </header>

      {creating && (
        <form
          className="card flex flex-col gap-3 p-4 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            create();
          }}
        >
          <label htmlFor="new-program-name" className="sr-only">
            Program name
          </label>
          <input
            id="new-program-name"
            autoFocus
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            placeholder="Program name, e.g. My 4-day split"
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

      <AssignmentsInbox />

      <Link
        href="/calendar"
        className="card flex items-center gap-4 p-4 transition-colors hover:bg-surface2/60 sm:p-5"
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
          <CalendarDays className="h-5 w-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-ink">Calendar</span>
          <span className="block text-sm text-muted">Days you trained, and log a workout you forgot.</span>
        </span>
        <ChevronRight className="h-4 w-4 text-muted" aria-hidden />
      </Link>

      <section className="space-y-3" aria-labelledby="your-programs">
        <h2 id="your-programs" className="text-h2 text-ink">
          Your programs
        </h2>
        {programs.length > 0 ? (
          <ProgramList />
        ) : (
          <p className="rounded-card border border-dashed border-border px-5 py-6 text-center text-sm text-muted">
            No program yet. Add one from the library below, or create your own.
          </p>
        )}
      </section>

      <ProgramLibrary />
    </main>
  );
}
