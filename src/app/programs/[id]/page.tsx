"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useHydrated, useStore } from "@/lib/store";

export default function ProgramEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const hydrated = useHydrated();

  const program = useStore((s) => s.programs.find((p) => p.id === id));
  const daysForProgram = useStore((s) => s.daysForProgram);
  const addDayToProgram = useStore((s) => s.addDayToProgram);
  const removeDayFromProgram = useStore((s) => s.removeDayFromProgram);
  const startSession = useStore((s) => s.startSession);

  if (!hydrated) return <main className="p-4 text-muted">Loading…</main>;
  if (!program) {
    return (
      <main className="space-y-3 p-4">
        <p className="text-muted">Program not found.</p>
        <Link href="/templates" className="text-accent">
          ← Back to plans
        </Link>
      </main>
    );
  }

  const days = daysForProgram(program.id);

  return (
    <main className="space-y-4 p-4">
      <header className="pt-2">
        <Link href="/templates" className="text-sm text-muted">
          ← Plans
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">
          {program.name}
          {program.source === "trainer" && (
            <span className="ml-2 rounded-full bg-accentDim/40 px-2 py-0.5 text-[10px] uppercase text-accent align-middle">
              Trainer
            </span>
          )}
        </h1>
        {program.notes && <p className="text-sm text-muted">{program.notes}</p>}
      </header>

      {days.length === 0 ? (
        <div className="card text-center text-muted">No days yet — add the first one.</div>
      ) : (
        <ul className="space-y-2">
          {days.map((d, i) => (
            <li key={d.id} className="card">
              <div className="flex items-center justify-between">
                <Link href={`/templates/${d.id}`} className="flex-1">
                  <p className="font-semibold">
                    <span className="text-muted">Day {i + 1}:</span> {d.name}
                  </p>
                  <p className="text-xs text-muted">{d.exercises.length} exercises · tap to edit</p>
                </Link>
                <button
                  className="btn-primary px-3 py-1.5"
                  onClick={() => {
                    const sid = startSession(d.id);
                    router.push(`/session/${sid}`);
                  }}
                >
                  Start
                </button>
                <button
                  className="btn-danger"
                  onClick={() => {
                    if (confirm(`Remove “${d.name}” from this program?`))
                      removeDayFromProgram(program.id, d.id);
                  }}
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
    </main>
  );
}
