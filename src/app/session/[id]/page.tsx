"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ExercisePicker } from "@/components/ExercisePicker";
import { OnlineBadge } from "@/components/OnlineBadge";
import { SessionExercise } from "@/components/SessionExercise";
import { RestTimerBar } from "@/components/RestTimerBar";
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

  const [picking, setPicking] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const sessionSets = useMemo(
    () => allSets.filter((s) => s.sessionId === id).sort((a, b) => a.setIndex - b.setIndex),
    [allSets, id]
  );

  const exerciseOrder = useMemo(() => {
    const seen: string[] = [];
    for (const s of sessionSets) if (!seen.includes(s.exerciseId)) seen.push(s.exerciseId);
    return seen;
  }, [sessionSets]);

  if (!hydrated) return <main className="p-4 text-muted">Loading…</main>;
  if (!session) {
    return (
      <main className="space-y-3 p-4">
        <p className="text-muted">Session not found.</p>
        <Link href="/" className="text-accent">
          ← Home
        </Link>
      </main>
    );
  }

  const isActive = session.status === "active";
  const readOnly = !isActive;

  const showPr = (kinds: string[]) => {
    const label = kinds
      .map((k) => (k === "e1rm" ? "estimated 1RM" : k === "max_weight" ? "top weight" : "rep"))
      .join(" & ");
    setToast(`🏆 New ${label} PR!`);
    setTimeout(() => setToast(null), 2500);
  };

  const finish = () => {
    const { discarded } = finishSession(session.id);
    router.push(discarded ? "/" : "/history");
  };

  return (
    <main className="space-y-4 p-4">
      <header className="flex items-center justify-between pt-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">
            {session.status === "active"
              ? "In progress"
              : session.status === "completed"
                ? "Completed"
                : "Archived"}
            {" · "}
            {new Date(session.startedAt).toLocaleDateString()}
          </p>
          <h1 className="text-xl font-bold tracking-tight">{session.title}</h1>
        </div>
        <OnlineBadge />
      </header>

      {exerciseOrder.length === 0 && (
        <div className="card text-center text-muted">
          {isActive ? "Empty workout — add your first exercise below." : "No sets were logged."}
        </div>
      )}

      {exerciseOrder.map((exerciseId) => (
        <SessionExercise
          key={exerciseId}
          sessionId={session.id}
          exerciseId={exerciseId}
          sets={sessionSets.filter((s) => s.exerciseId === exerciseId)}
          readOnly={readOnly}
          onPr={showPr}
        />
      ))}

      {isActive && (
        <>
          <button className="btn-ghost w-full" onClick={() => setPicking(true)}>
            + Add exercise
          </button>
          <button className="btn-primary w-full py-4 text-base" onClick={finish}>
            Finish workout
          </button>
          <button
            className="btn-danger w-full"
            onClick={() => {
              if (confirm("Discard this workout? Logged sets will be deleted.")) {
                discardSession(session.id);
                router.push("/");
              }
            }}
          >
            Discard
          </button>
        </>
      )}

      {session.status === "completed" && (
        <div className="flex gap-2">
          <button
            className="btn-ghost flex-1"
            onClick={() => {
              if (reopenSession(session.id)) setToast("Re-opened for editing");
              else setToast("Finish the active workout first");
              setTimeout(() => setToast(null), 2000);
            }}
          >
            Edit workout
          </button>
          <button
            className="btn-ghost flex-1"
            onClick={() => {
              archiveSession(session.id);
              router.push("/history");
            }}
          >
            Archive
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
        <div className="fixed inset-x-0 bottom-28 z-40 mx-auto w-fit rounded-full bg-accent px-5 py-2.5 font-semibold text-black shadow-lg">
          {toast}
        </div>
      )}

      {isActive && <RestTimerBar />}
    </main>
  );
}
