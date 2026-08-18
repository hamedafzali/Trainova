"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useHydrated, useStore } from "@/lib/store";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ListSkeleton } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";

export default function ProgramEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const hydrated = useHydrated();

  const program = useStore((s) => s.programs.find((p) => p.id === id));
  const daysForProgram = useStore((s) => s.daysForProgram);
  const addDayToProgram = useStore((s) => s.addDayToProgram);
  const removeDayFromProgram = useStore((s) => s.removeDayFromProgram);
  const startSession = useStore((s) => s.startSession);
  const getActiveSession = useStore((s) => s.getActiveSession);
  const [confirmRemoveDay, setConfirmRemoveDay] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const start = (templateId: string) => {
    const { id: sid, blocked } = startSession(templateId);
    if (blocked) {
      const a = getActiveSession();
      if (a) router.push(`/session/${a.id}`);
      return;
    }
    if (sid) router.push(`/session/${sid}`);
  };

  if (!hydrated)
    return (
      <main className="mx-auto max-w-2xl space-y-4 p-4">
        <ListSkeleton variant="row" />
      </main>
    );
  if (!program) {
    return (
      <main className="mx-auto max-w-2xl space-y-3 p-4">
        <p className="text-muted">Program not found.</p>
        <Link href="/templates" className="text-accent hover:text-accentHover">
          ← Back to plans
        </Link>
      </main>
    );
  }

  const days = daysForProgram(program.id);

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4">
      <header className="pt-2">
        <Link
          href="/templates"
          className="text-sm text-muted hover:text-inkSoft transition-colors"
        >
          ← Plans
        </Link>
        <h1 className="page-title">
          {program.name}
          {program.source === "trainer" && (
            <span className="badge-accent ml-2 uppercase align-middle">
              Trainer
            </span>
          )}
        </h1>
        {program.notes && <p className="page-subtitle">{program.notes}</p>}
      </header>

      {days.length === 0 ? (
        <EmptyState
          icon="📅"
          title="No days yet"
          body="Add the first one to start building this program."
        />
      ) : (
        <ul className="space-y-2">
          {days.map((d, i) => (
            <li key={d.id} className="card">
              <div className="flex items-center justify-between">
                <Link href={`/templates/${d.id}`} className="flex-1">
                  <p className="font-semibold text-h3 text-ink">
                    <span className="text-muted">Day {i + 1}:</span> {d.name}
                  </p>
                  <p className="text-xs text-muted">{d.exercises.length} exercises · tap to edit</p>
                </Link>
                <button className="btn-primary px-3 py-1.5" onClick={() => start(d.id)}>
                  Start
                </button>
                <button
                  className="btn-danger"
                  onClick={() =>
                    setConfirmRemoveDay({ id: d.id, name: d.name })
                  }
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <button
        className="btn-ghost w-full"
        onClick={() => {
          const tid = addDayToProgram(program.id, `Day ${days.length + 1}`);
          router.push(`/templates/${tid}`);
        }}
      >
        + Add day
      </button>

      <ConfirmDialog
        open={!!confirmRemoveDay}
        title="Remove day"
        body={
          confirmRemoveDay
            ? `Remove "${confirmRemoveDay.name}" from this program?`
            : undefined
        }
        confirmLabel="Remove"
        danger
        onConfirm={() => {
          if (confirmRemoveDay)
            removeDayFromProgram(program.id, confirmRemoveDay.id);
          setConfirmRemoveDay(null);
        }}
        onCancel={() => setConfirmRemoveDay(null)}
      />
    </main>
  );
}
