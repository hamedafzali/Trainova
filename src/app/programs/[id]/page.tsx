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

  if (!hydrated) return <main className="p-4 text-white/50">Loading…</main>;
  if (!program) {
    return (
      <main className="mx-auto max-w-2xl space-y-3 p-4">
        <p className="text-white/50">Program not found.</p>
        <Link href="/templates" className="text-blue-400 hover:text-blue-300">
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
            <span className="ml-2 rounded-full bg-accent/20 px-3 py-1 text-xs uppercase text-accent align-middle">
              Trainer
            </span>
          )}
        </h1>
        {program.notes && <p className="page-subtitle">{program.notes}</p>}
      </header>

      {days.length === 0 ? (
        <div className="card text-center text-white/50">No days yet — add the first one.</div>
      ) : (
        <ul className="space-y-2">
          {days.map((d, i) => (
            <li key={d.id} className="card">
              <div className="flex items-center justify-between">
                <Link href={`/templates/${d.id}`} className="flex-1">
                  <p className="font-semibold text-white">
                    <span className="text-white/50">Day {i + 1}:</span> {d.name}
                  </p>
                  <p className="text-xs text-white/50">{d.exercises.length} exercises · tap to edit</p>
                </Link>
                <button className="btn-primary px-3 py-1.5" onClick={() => start(d.id)}>
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
