"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CalendarDays, Plus } from "lucide-react";
import { EmptySlot, IconButton, ListCard, ListRow, PageHeader, SectionHeader } from "@/components/kit";
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
      <PageHeader
        title="Plan"
        subtitle="The programs you follow and when you train."
        actions={<IconButton icon={Plus} label="New program" onClick={() => setCreating(!creating)} pressed={creating} />}
      />

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

      <ListCard>
        <ListRow
          href="/calendar"
          icon={CalendarDays}
          tone="accent"
          title="Calendar"
          meta="Days you trained, and log a workout you forgot."
        />
      </ListCard>

      <section className="space-y-3" aria-labelledby="your-programs">
        <SectionHeader id="your-programs" title="Your programs" />
        {programs.length > 0 ? <ProgramList /> : <EmptySlot>No program yet. Add one from the library below, or create your own.</EmptySlot>}
      </section>

      <ProgramLibrary />
    </main>
  );
}
