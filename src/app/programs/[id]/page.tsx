"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, CalendarPlus, ChevronRight, FolderX, Pencil, Play, Plus, Trash2, X } from "lucide-react";
import { useHydrated, useStore } from "@/lib/store";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ListSkeleton } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { recommendToday } from "@/domain/adaptive";

export default function ProgramEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const hydrated = useHydrated();

  const program = useStore((s) => s.programs.find((p) => p.id === id));
  const templates = useStore((s) => s.templates);
  const programs = useStore((s) => s.programs);
  const sessions = useStore((s) => s.sessions);
  const feedback = useStore((s) => s.feedback);
  const exerciseById = useStore((s) => s.exerciseById);
  const daysForProgram = useStore((s) => s.daysForProgram);
  const addDayToProgram = useStore((s) => s.addDayToProgram);
  const removeDayFromProgram = useStore((s) => s.removeDayFromProgram);
  const renameProgram = useStore((s) => s.renameProgram);
  const deleteProgram = useStore((s) => s.deleteProgram);
  const startSession = useStore((s) => s.startSession);
  const getActiveSession = useStore((s) => s.getActiveSession);
  const [editingName, setEditingName] = useState(false);
  const [removeDay, setRemoveDay] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

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
      <main className="mx-auto max-w-3xl space-y-4">
        <ListSkeleton variant="row" />
      </main>
    );
  if (!program) {
    return (
      <EmptyState
        icon={FolderX}
        title="Program not found"
        body="It may have been deleted."
        action={
          <Link href="/programs" className="btn-primary mt-2">
            Back to Plan
          </Link>
        }
      />
    );
  }

  const days = daysForProgram(program.id);
  const nextId = recommendToday({ templates, programs, sessions, feedback })?.templateId;

  return (
    <main className="mx-auto max-w-3xl space-y-6 pb-16">
      <Link href="/programs" className="-my-3 -ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-control px-2 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Plan
      </Link>

      <header>
        {editingName ? (
          <input
            aria-label="Program name"
            className="input text-xl font-bold"
            defaultValue={program.name}
            autoFocus
            maxLength={60}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== program.name) renameProgram(program.id, v);
              setEditingName(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") setEditingName(false);
            }}
          />
        ) : (
          <h1 className="page-title flex flex-wrap items-center gap-2">
            <span className="min-w-0 break-words">{program.name}</span>
            <button
              type="button"
              aria-label="Rename program"
              onClick={() => setEditingName(true)}
              className="grid h-11 w-11 place-items-center rounded-control text-muted hover:bg-surface2 hover:text-ink"
            >
              <Pencil className="h-4 w-4" aria-hidden />
            </button>
            {program.source === "trainer" && <span className="badge-accent text-xs">Trainer</span>}
          </h1>
        )}
        <p className="page-subtitle">
          {program.notes ?? `${days.length} training day${days.length === 1 ? "" : "s"}, done in rotation — after the last day, start again from Day 1.`}
        </p>
      </header>

      {days.length === 0 ? (
        <EmptyState icon={CalendarPlus} title="No days yet" body="Add the first training day to start building this program." />
      ) : (
        <ol className="space-y-3">
          {days.map((d, i) => {
            const isNext = d.id === nextId;
            const names = d.exercises.map((te) => exerciseById(te.exerciseId)?.name).filter(Boolean) as string[];
            return (
              <li key={d.id} className={`card overflow-hidden ${isNext ? "border-accent/40" : ""}`}>
                <div className="flex items-center gap-3 p-4">
                  <span
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold ${
                      isNext ? "bg-accentFill text-onAccent" : "bg-surface2 text-inkSoft"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <Link href={`/templates/${d.id}`} className="-my-1 min-w-0 flex-1 py-1">
                    <p className="flex items-center gap-2 font-semibold text-ink">
                      <span className="truncate">{d.name}</span>
                      {isNext && <span className="badge-accent shrink-0 text-[10px]">Up next</span>}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {names.length ? names.join(" · ") : "No exercises yet — tap to add"}
                    </p>
                  </Link>
                  <Link href={`/templates/${d.id}`} aria-label={`Edit ${d.name}`} className="hidden h-11 w-11 place-items-center rounded-control text-muted hover:bg-surface2 hover:text-ink sm:grid">
                    <ChevronRight className="h-5 w-5" aria-hidden />
                  </Link>
                </div>
                <div className="flex border-t border-border">
                  <button
                    type="button"
                    className="flex min-h-11 flex-1 items-center justify-center gap-1.5 py-2.5 text-sm font-semibold text-accent hover:bg-accent/[0.05] disabled:text-muted"
                    disabled={d.exercises.length === 0}
                    onClick={() => start(d.id)}
                  >
                    <Play className="h-4 w-4" aria-hidden /> Start
                  </button>
                  <button
                    type="button"
                    className="flex min-h-11 items-center justify-center gap-1.5 border-l border-border px-5 py-2.5 text-sm text-muted hover:bg-danger/10 hover:text-danger"
                    onClick={() => setRemoveDay({ id: d.id, name: d.name })}
                    aria-label={`Remove ${d.name}`}
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <button
        className="flex w-full items-center justify-center gap-1.5 rounded-card border border-dashed border-border py-4 text-sm font-semibold text-accent hover:bg-accent/[0.05]"
        onClick={() => {
          const tid = addDayToProgram(program.id, `Day ${days.length + 1}`);
          router.push(`/templates/${tid}`);
        }}
      >
        <Plus className="h-4 w-4" aria-hidden /> Add day
      </button>

      <div className="border-t border-border pt-6">
        <button
          type="button"
          className="-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-control px-2 text-sm font-medium text-danger hover:bg-danger/10"
          onClick={() => setDeleting(true)}
        >
          <Trash2 className="h-4 w-4" aria-hidden /> Delete program
        </button>
      </div>

      <ConfirmDialog
        open={!!removeDay}
        title="Remove day?"
        body={removeDay ? `“${removeDay.name}” will be removed from this program. Past workouts stay in History.` : undefined}
        confirmLabel="Remove"
        danger
        onConfirm={() => {
          if (removeDay) removeDayFromProgram(program.id, removeDay.id);
          setRemoveDay(null);
        }}
        onCancel={() => setRemoveDay(null)}
      />
      <ConfirmDialog
        open={deleting}
        title="Delete program?"
        body="All of its days are deleted too. Past workouts stay in History."
        confirmLabel="Delete program"
        danger
        onConfirm={() => {
          deleteProgram(program.id);
          router.push("/programs");
        }}
        onCancel={() => setDeleting(false)}
      />
    </main>
  );
}
