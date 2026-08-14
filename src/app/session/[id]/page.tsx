"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ExercisePicker } from "@/components/ExercisePicker";
import { OnlineBadge } from "@/components/OnlineBadge";
import { WorkoutCarousel } from "@/components/WorkoutCarousel";
import { RestTimerBar } from "@/components/RestTimerBar";
import { SessionFeedbackForm } from "@/components/SessionFeedbackForm";
import { haptic } from "@/lib/haptics";
import { trackEvent } from "@/lib/analytics";
import { useHydrated, useStore } from "@/lib/store";

export default function SessionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const hydrated = useHydrated();

  const session = useStore((s) => s.sessions.find((x) => x.id === id));
  const allSets = useStore((s) => s.sets);
  const addSet = useStore((s) => s.addSet);
  const finishSession = useStore((s) => s.finishSession);
  const discardSession = useStore((s) => s.discardSession);
  const reopenSession = useStore((s) => s.reopenSession);
  const archiveSession = useStore((s) => s.archiveSession);
  const unarchiveSession = useStore((s) => s.unarchiveSession);
  const recordSessionFeedback = useStore((s) => s.recordSessionFeedback);

  const [picking, setPicking] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const sessionSets = useMemo(
    () =>
      allSets
        .filter((s) => s.sessionId === id)
        .sort((a, b) => a.setIndex - b.setIndex),
    [allSets, id],
  );

  const exerciseOrder = useMemo(() => {
    const seen: string[] = [];
    for (const s of sessionSets)
      if (!seen.includes(s.exerciseId)) seen.push(s.exerciseId);
    return seen;
  }, [sessionSets]);

  if (!hydrated) return <main className="p-4 text-white/50">Loading…</main>;
  if (!session) {
    return (
      <main className="mx-auto max-w-2xl space-y-3 p-4">
        <p className="text-white/50">Session not found.</p>
        <Link href="/" className="text-blue-400 hover:text-blue-300">
          ← Home
        </Link>
      </main>
    );
  }

  const isActive = session.status === "active";
  const readOnly = !isActive;

  const showPr = (kinds: string[]) => {
    const label = kinds
      .map((k) =>
        k === "e1rm"
          ? "estimated 1RM"
          : k === "max_weight"
            ? "top weight"
            : "rep",
      )
      .join(" & ");
    setToast(`🏆 New ${label} PR!`);
    setTimeout(() => setToast(null), 2500);
  };

  const finish = () => {
    const { discarded } = finishSession(session.id);
    trackEvent(discarded ? "workout_discarded" : "workout_finished", {
      session_id: session.id,
      completed_sets: sessionSets.filter((set) => set.completed).length,
    });
    if (!discarded) haptic("finish");
    router.push(discarded ? "/" : "/history");
  };

  const requestFinish = () => {
    const hasCompletedSet = sessionSets.some((set) => set.completed);
    if (hasCompletedSet) setFeedbackOpen(true);
    else finish();
  };

  return (
    <main className="mx-auto max-w-2xl space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <p className="section-label">
            {session.status === "active"
              ? "In progress"
              : session.status === "completed"
                ? "Completed"
                : "Archived"}
            {" · "}
            {new Date(session.startedAt).toLocaleDateString()}
          </p>
          <h1 className="page-title mt-1">{session.title}</h1>
        </div>
        <OnlineBadge />
      </header>

      {exerciseOrder.length === 0 && (
        <div className="card text-center py-12 text-base text-white/50">
          {isActive
            ? "Empty workout — add your first exercise below."
            : "No sets were logged."}
        </div>
      )}

      {exerciseOrder.length > 0 && (
        <WorkoutCarousel
          sessionId={session.id}
          exerciseIds={exerciseOrder}
          sets={sessionSets}
          readOnly={readOnly}
          editable={session.status === "completed"}
          onPr={showPr}
        />
      )}

      {isActive && (
        <div className="space-y-2">
          <button
            className="btn-primary w-full py-4 text-base font-semibold transition-transform active:scale-[0.99]"
            onClick={requestFinish}
          >
            Finish workout
          </button>
          <button
            className="btn-ghost w-full py-4 text-base font-semibold transition-transform active:scale-[0.99]"
            onClick={() => setPicking(true)}
          >
            + Add exercise
          </button>
          <button
            className="w-full py-2 text-sm font-semibold text-danger transition-opacity active:opacity-60"
            onClick={() =>
              setConfirmAction({
                title: "Discard this workout?",
                body: "Logged sets will be deleted.",
                onConfirm: () => {
                  discardSession(session.id);
                  router.push("/");
                },
              })
            }
          >
            Discard workout
          </button>
        </div>
      )}

      {session.status === "completed" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <button
              className="btn-ghost py-4 text-base font-semibold"
              onClick={() => {
                if (reopenSession(session.id))
                  setToast("Re-opened for editing");
                else setToast("Finish the active workout first");
                setTimeout(() => setToast(null), 2000);
              }}
            >
              Edit workout
            </button>
            <button
              className="btn-ghost py-4 text-base font-semibold"
              onClick={() => {
                archiveSession(session.id);
                router.push("/history");
              }}
            >
              Archive
            </button>
          </div>
          <button
            className="btn-danger w-full py-4 text-base font-semibold"
            onClick={() =>
              setConfirmAction({
                title: "Delete this workout permanently?",
                body: "This can't be undone.",
                onConfirm: () => {
                  discardSession(session.id);
                  router.push("/history");
                },
              })
            }
          >
            Delete workout
          </button>
        </div>
      )}

      {session.status === "archived" && (
        <div className="grid grid-cols-2 gap-3">
          <button
            className="btn-ghost py-4 text-base font-semibold"
            onClick={() => {
              unarchiveSession(session.id);
              router.push("/history");
            }}
          >
            Unarchive
          </button>
          <button
            className="btn-danger py-4 text-base font-semibold"
            onClick={() =>
              setConfirmAction({
                title: "Delete this workout permanently?",
                body: "This can't be undone.",
                onConfirm: () => {
                  discardSession(session.id);
                  router.push("/history");
                },
              })
            }
          >
            Delete
          </button>
        </div>
      )}

      {picking && (
        <ExercisePicker
          onClose={() => setPicking(false)}
          onPick={(exerciseId) => {
            addSet(session.id, exerciseId);
            setPicking(false);
          }}
        />
      )}

      {toast && (
        <div className="fixed inset-x-0 bottom-28 z-40 mx-auto w-fit rounded-full bg-gold px-5 py-2.5 font-semibold text-onAccent shadow-lg animate-popIn">
          {toast}
        </div>
      )}

      {isActive && <RestTimerBar />}

      {feedbackOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60 p-4 md:items-center md:justify-center" role="dialog" aria-modal="true" aria-label="Workout feedback">
          <div className="w-full max-w-md">
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
