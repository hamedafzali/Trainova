"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  Dumbbell,
  Inbox,
  MoreVertical,
  Plus,
  SearchX,
  Share2,
  StickyNote,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { ExercisePicker } from "@/components/ExercisePicker";
import { SessionExercise } from "@/components/SessionExercise";
import { RestTimerBar } from "@/components/RestTimerBar";
import { SessionFeedbackForm } from "@/components/SessionFeedbackForm";
import { WorkoutRecap } from "@/components/WorkoutRecap";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CoachHeaderButton } from "@/components/coach/CoachAssistant";
import { CardSkeleton, ListSkeleton } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { haptic } from "@/lib/haptics";
import { trackEvent } from "@/lib/analytics";
import { toast } from "@/lib/toast";
import { useDialogA11y } from "@/lib/useDialogA11y";
import { useHydrated, useStore } from "@/lib/store";
import { formatVolume } from "@/lib/units";
import type { WorkoutSet } from "@/domain/types";

function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

function Elapsed({ since }: { since: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return <span className="tabular-nums">{clock(now - new Date(since).getTime())}</span>;
}

export default function SessionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const hydrated = useHydrated();

  const session = useStore((s) => s.sessions.find((x) => x.id === id));
  const allSets = useStore((s) => s.sets);
  const units = useStore((s) => s.units);
  const exerciseById = useStore((s) => s.exerciseById);
  const addSet = useStore((s) => s.addSet);
  const finishSession = useStore((s) => s.finishSession);
  const discardSession = useStore((s) => s.discardSession);
  const reopenSession = useStore((s) => s.reopenSession);
  const archiveSession = useStore((s) => s.archiveSession);
  const unarchiveSession = useStore((s) => s.unarchiveSession);
  const recordSessionFeedback = useStore((s) => s.recordSessionFeedback);
  const setSessionNotes = useStore((s) => s.setSessionNotes);

  const [picking, setPicking] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  // "finished": shown right after Finish (Done goes to Today); "view": opened from a past workout.
  const [recap, setRecap] = useState<"finished" | "view" | null>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    body?: string;
    confirmLabel?: string;
    onConfirm: () => void;
  } | null>(null);
  const feedbackPanelRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const sessionSets = useMemo(
    () => allSets.filter((s) => s.sessionId === id).sort((a, b) => a.setIndex - b.setIndex),
    [allSets, id],
  );

  const exerciseOrder = useMemo(() => {
    const seen: string[] = [];
    for (const s of sessionSets) if (!seen.includes(s.exerciseId)) seen.push(s.exerciseId);
    return seen;
  }, [sessionSets]);

  const setsByExercise = useMemo(() => {
    const m = new Map<string, WorkoutSet[]>();
    for (const exId of exerciseOrder) m.set(exId, []);
    for (const s of sessionSets) m.get(s.exerciseId)?.push(s);
    return m;
  }, [exerciseOrder, sessionSets]);

  // Focus the first exercise that still has open sets.
  const firstOpen =
    exerciseOrder.find((exId) => (setsByExercise.get(exId) ?? []).some((s) => !s.completed)) ??
    exerciseOrder[0] ??
    null;
  const focused = current && exerciseOrder.includes(current) ? current : firstOpen;
  const focusedIdx = focused ? exerciseOrder.indexOf(focused) : -1;

  const completedCount = sessionSets.filter((s) => s.completed).length;
  const volumeKg = sessionSets
    .filter((s) => s.completed && s.kind !== "warmup")
    .reduce((sum, s) => sum + (s.actualWeight ?? 0) * (s.actualReps ?? 0), 0);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [menuOpen]);

  const finish = () => {
    if (!session) return;
    const { discarded } = finishSession(session.id);
    trackEvent(discarded ? "workout_discarded" : "workout_finished", {
      session_id: session.id,
      completed_sets: completedCount,
    });
    if (!discarded) {
      haptic("finish");
      toast("Workout saved", { variant: "success" });
      setFeedbackOpen(false);
      setRecap("finished");
    } else router.push("/");
  };

  useDialogA11y(feedbackOpen, finish, feedbackPanelRef);

  if (!hydrated)
    return (
      <main className="mx-auto max-w-2xl space-y-8">
        <CardSkeleton />
        <ListSkeleton count={3} />
      </main>
    );
  if (!session) {
    return (
      <main className="mx-auto max-w-2xl">
        <EmptyState icon={SearchX} title="Workout not found" body="It may have been deleted on another device." />
        <Link href="/" className="btn-ghost mt-4 w-full">
          Back to home
        </Link>
      </main>
    );
  }

  const isActive = session.status === "active";
  const readOnly = !isActive;

  const showPr = (kinds: string[]) => {
    const label = kinds
      .map((k) => (k === "e1rm" ? "estimated 1RM" : k === "max_weight" ? "heaviest weight" : "most reps"))
      .join(" & ");
    toast(`New PR — ${label}!`, { variant: "success" });
  };

  const requestFinish = () => {
    const open = sessionSets.filter((s) => !s.completed).length;
    const go = () => (completedCount > 0 ? setFeedbackOpen(true) : finish());
    if (completedCount === 0) {
      setConfirmAction({
        title: "Nothing logged yet",
        body: "Finishing now discards this workout.",
        confirmLabel: "Discard",
        onConfirm: finish,
      });
    } else if (open > 0) {
      setConfirmAction({
        title: `Finish with ${open} open set${open === 1 ? "" : "s"}?`,
        body: "Unlogged sets will be removed.",
        confirmLabel: "Finish",
        onConfirm: go,
      });
    } else go();
  };

  const confirmDiscard = (to: string) =>
    setConfirmAction({
      title: isActive ? "Discard this workout?" : "Delete this workout?",
      body: isActive ? "All logged sets will be deleted." : "This can't be undone.",
      confirmLabel: isActive ? "Discard" : "Delete",
      onConfirm: () => {
        discardSession(session.id);
        router.push(to);
      },
    });

  const next = focusedIdx >= 0 ? exerciseOrder[focusedIdx + 1] : undefined;
  const prev = focusedIdx > 0 ? exerciseOrder[focusedIdx - 1] : undefined;
  const statusLabel = isActive ? "In progress" : session.status === "completed" ? "Completed" : "Archived";

  return (
    <main className={`mx-auto max-w-2xl ${isActive ? "pb-32" : ""}`}>
      {/* header */}
      <header className="sticky top-0 z-20 -mx-4 mb-5 border-b border-border/60 bg-bg/90 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
        <div className="flex items-center gap-2">
          <Link
            href={isActive ? "/" : "/history"}
            aria-label="Back"
            className="-ml-2 grid h-11 w-11 shrink-0 place-items-center rounded-control text-inkSoft hover:bg-surface2 hover:text-ink"
          >
            <ChevronLeft className="h-6 w-6" aria-hidden />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-h3 font-bold text-ink">{session.title}</h1>
            <p className="text-xs text-muted">
              {isActive ? <Elapsed since={session.startedAt} /> : statusLabel}
              {" · "}
              {isActive
                ? `${completedCount}/${sessionSets.length} sets`
                : new Date(session.startedAt).toLocaleDateString(undefined, {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })}
            </p>
          </div>
          <CoachHeaderButton />
          {isActive && (
            <button type="button" className="btn-primary px-4 py-2.5" onClick={requestFinish}>
              Finish
            </button>
          )}
          <div ref={menuRef} className="relative">
            <button
              type="button"
              aria-label="More actions"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
              className="grid h-11 w-11 place-items-center rounded-control text-inkSoft hover:bg-surface2 hover:text-ink"
            >
              <MoreVertical className="h-5 w-5" aria-hidden />
            </button>
            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-11 z-30 w-56 overflow-hidden rounded-card border border-border bg-surface py-1 shadow-elevated enter-fade"
              >
                {isActive && (
                  <MenuItem
                    icon={Plus}
                    onClick={() => {
                      setMenuOpen(false);
                      setPicking(true);
                    }}
                  >
                    Add exercise
                  </MenuItem>
                )}
                <MenuItem
                  icon={StickyNote}
                  onClick={() => {
                    setMenuOpen(false);
                    setNotesOpen(true);
                  }}
                >
                  {session.notes ? "Edit notes" : "Add notes"}
                </MenuItem>
                {session.status === "completed" && (
                  <MenuItem
                    onClick={() => {
                      setMenuOpen(false);
                      if (reopenSession(session.id)) toast("Re-opened for editing");
                      else toast("Finish your active workout first");
                    }}
                  >
                    Resume workout
                  </MenuItem>
                )}
                {session.status === "completed" && (
                  <MenuItem
                    onClick={() => {
                      archiveSession(session.id);
                      router.push("/history");
                    }}
                  >
                    Archive
                  </MenuItem>
                )}
                {session.status === "archived" && (
                  <MenuItem
                    onClick={() => {
                      unarchiveSession(session.id);
                      router.push("/history");
                    }}
                  >
                    Restore from archive
                  </MenuItem>
                )}
                <MenuItem
                  icon={Trash2}
                  danger
                  onClick={() => {
                    setMenuOpen(false);
                    confirmDiscard(isActive ? "/" : "/history");
                  }}
                >
                  {isActive ? "Discard workout" : "Delete workout"}
                </MenuItem>
              </div>
            )}
          </div>
        </div>
        {isActive && sessionSets.length > 0 && (
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-surface2" aria-hidden>
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-300"
              style={{ width: `${(completedCount / sessionSets.length) * 100}%` }}
            />
          </div>
        )}
      </header>

      {/* summary for finished workouts */}
      {!isActive && sessionSets.length > 0 && (
        <div className="mb-5 grid grid-cols-3 gap-2 text-center">
          <Stat label="Exercises" value={String(exerciseOrder.length)} />
          <Stat label="Sets" value={String(completedCount)} />
          <Stat label="Volume" value={formatVolume(volumeKg, units)} />
          {session.status === "completed" && completedCount > 0 && (
            <button type="button" className="btn-secondary col-span-3" onClick={() => setRecap("view")}>
              <Share2 className="h-4 w-4" aria-hidden /> Share recap
            </button>
          )}
        </div>
      )}

      {(notesOpen || session.notes) && (
        <div className="card mb-5 p-4">
          <label htmlFor="session-notes" className="section-label">
            Workout notes
          </label>
          <textarea
            id="session-notes"
            key={session.notes ?? ""}
            defaultValue={session.notes ?? ""}
            autoFocus={notesOpen && !session.notes}
            rows={2}
            placeholder="How did it feel? Seat settings, pain, sleep…"
            className="mt-2 w-full resize-y rounded-control bg-surface2 px-3 py-2 text-sm text-ink outline-none placeholder:text-muted focus:ring-1 focus:ring-accent/40"
            onBlur={(e) => {
              setSessionNotes(session.id, e.target.value);
              if (!e.target.value.trim()) setNotesOpen(false);
            }}
          />
        </div>
      )}

      {exerciseOrder.length === 0 && isActive && (
        <EmptyState
          icon={Dumbbell}
          title="Empty workout"
          body="Add your first exercise to start logging."
          action={
            <button type="button" className="btn-primary mt-2" onClick={() => setPicking(true)}>
              <Plus className="h-4 w-4" aria-hidden /> Add exercise
            </button>
          }
        />
      )}
      {exerciseOrder.length === 0 && !isActive && (
        <EmptyState icon={Inbox} title="No sets logged" body="This workout has no recorded sets." />
      )}

      {/* active: one exercise in focus, strip to jump between them */}
      {isActive && focused && (
        <div className="space-y-4">
          <nav aria-label="Exercises" className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0" style={{ scrollbarWidth: "none" }}>
            <ol className="flex w-max gap-2">
              {exerciseOrder.map((exId, i) => {
                const list = setsByExercise.get(exId) ?? [];
                const doneN = list.filter((s) => s.completed).length;
                const complete = list.length > 0 && doneN === list.length;
                const on = exId === focused;
                return (
                  <li key={exId}>
                    <button
                      type="button"
                      aria-current={on ? "step" : undefined}
                      onClick={() => setCurrent(exId)}
                      className={`flex min-h-11 max-w-[11rem] items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                        on
                          ? "border-accent bg-accent/10 text-ink"
                          : complete
                            ? "border-transparent bg-successSoft text-green"
                            : "border-border bg-surface text-inkSoft hover:text-ink"
                      }`}
                    >
                      {complete ? (
                        <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={3} aria-hidden />
                      ) : (
                        <span className="text-xs font-bold text-muted">{i + 1}</span>
                      )}
                      <span className="truncate font-medium">{exerciseById(exId)?.name ?? "Exercise"}</span>
                    </button>
                  </li>
                );
              })}
              <li>
                <button
                  type="button"
                  onClick={() => setPicking(true)}
                  className="flex min-h-11 items-center gap-1 rounded-full border border-dashed border-border px-3 py-1.5 text-sm font-medium text-accent"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden /> Add
                </button>
              </li>
            </ol>
          </nav>

          <SessionExercise
            key={focused}
            sessionId={session.id}
            exerciseId={focused}
            sets={setsByExercise.get(focused) ?? []}
            onPr={showPr}
          />

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className="btn-ghost justify-start disabled:opacity-0"
              disabled={!prev}
              onClick={() => prev && setCurrent(prev)}
            >
              <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate">Previous</span>
            </button>
            {next ? (
              <button type="button" className="btn-ghost justify-end" onClick={() => setCurrent(next)}>
                <span className="truncate">{exerciseById(next)?.name ?? "Next"}</span>
                <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
              </button>
            ) : (
              <button type="button" className="btn-secondary" onClick={requestFinish}>
                Finish workout
              </button>
            )}
          </div>
        </div>
      )}

      {/* finished: review every exercise */}
      {!isActive && exerciseOrder.length > 0 && (
        <div className="space-y-4">
          {exerciseOrder.map((exId) => (
            <SessionExercise
              key={exId}
              sessionId={session.id}
              exerciseId={exId}
              sets={setsByExercise.get(exId) ?? []}
              readOnly
              editable={session.status === "completed"}
              onPr={showPr}
            />
          ))}
        </div>
      )}

      {picking && (
        <ExercisePicker
          onClose={() => setPicking(false)}
          onPick={(exerciseId) => {
            addSet(session.id, exerciseId);
            setCurrent(exerciseId);
            setPicking(false);
          }}
        />
      )}

      <ConfirmDialog
        open={!!confirmAction}
        title={confirmAction?.title ?? ""}
        body={confirmAction?.body}
        confirmLabel={confirmAction?.confirmLabel}
        danger={confirmAction?.confirmLabel !== "Finish"}
        onConfirm={() => {
          const fn = confirmAction?.onConfirm;
          setConfirmAction(null);
          fn?.();
        }}
        onCancel={() => setConfirmAction(null)}
      />

      {isActive && <RestTimerBar />}

      {recap && session.status === "completed" && (
        <WorkoutRecap
          sessionId={session.id}
          onClose={() => {
            if (recap === "finished") router.push("/");
            setRecap(null);
          }}
        />
      )}

      {feedbackOpen && (
        <div className="sheet-enter-backdrop fixed inset-0 z-50 flex items-end bg-black/60 p-4 md:items-center md:justify-center">
          <div
            ref={feedbackPanelRef}
            className="sheet-enter-panel enter-fade w-full max-w-md"
            role="dialog"
            aria-modal="true"
            aria-label="Workout feedback"
            tabIndex={-1}
            data-testid="session-feedback-modal"
          >
            <SessionFeedbackForm
              onSkip={finish}
              onSubmit={(input) => {
                recordSessionFeedback(session.id, input);
                trackEvent("workout_feedback_submitted", {
                  session_id: session.id,
                  difficulty: input.difficulty,
                  energy: input.energy,
                  confidence: input.confidence,
                  reported_pain: Boolean(input.pain),
                });
                finish();
              }}
            />
          </div>
        </div>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-border bg-surface px-2 py-3">
      <p className="text-lg font-bold tabular-nums text-ink">{value}</p>
      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
    </div>
  );
}

function MenuItem({
  icon: Icon,
  danger,
  onClick,
  children,
}: {
  icon?: LucideIcon;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-surface2 ${
        danger ? "text-danger" : "text-ink"
      }`}
    >
      {Icon ? <Icon className="h-4 w-4" aria-hidden /> : <span className="w-4" />}
      {children}
    </button>
  );
}
