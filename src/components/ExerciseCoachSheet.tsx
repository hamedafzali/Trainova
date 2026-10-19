"use client";

import { useMemo, useRef, useState } from "react";
import { ArrowLeftRight, Sparkles, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { postAi, useAiStatus } from "@/lib/ai";
import { pushState } from "@/lib/sync";
import { toast } from "@/lib/toast";
import { useDialogA11y } from "@/lib/useDialogA11y";
import { matchExercise } from "@/domain/exerciseMatch";
import {
  buildCoachEvidence,
  ruleReading,
  type CoachReading,
  type CoachStatus,
  type ExerciseCoachEvidence,
  type NextAction,
  type SetVerdict,
} from "@/domain/exerciseCoach";
import { Skeleton } from "@/components/Skeleton";
import { AiConsentCard } from "@/components/coach/AiConsentCard";

type AiResult = {
  evidence: ExerciseCoachEvidence;
  reading: CoachReading;
  fallback: "ai_off" | "invalid" | "unavailable" | "red_flag" | null;
};

const MAX_QUESTION = 300;

const STATUS: Record<CoachStatus, { text: string; badge: string }> = {
  not_started: { text: "Not started", badge: "badge-neutral" },
  on_track: { text: "On track", badge: "badge-accent" },
  ahead: { text: "Ahead of plan", badge: "badge-success" },
  struggling: { text: "Struggling", badge: "badge-warning" },
  done: { text: "Done", badge: "badge-success" },
};

const ACTION: Record<NextAction, string> = {
  start: "First set",
  keep: "Same again",
  increase: "Go heavier",
  reduce: "Go lighter",
  finish: "You're done",
};

const VERDICT: Record<SetVerdict, { text: string; cls: string }> = {
  on_target: { text: "On target", cls: "text-accent" },
  above_target: { text: "Above", cls: "text-green" },
  below_target: { text: "Below", cls: "text-amber" },
  near_max: { text: "Near max", cls: "text-flame" },
};

/**
 * In-workout coach for one exercise. The check of today's sets, the next set
 * and the stand-ins are computed on this device from the log; the AI (when
 * allowed) only explains them or answers a question, kept visibly apart.
 */
export function ExerciseCoachSheet({
  open,
  sessionId,
  exerciseId,
  onClose,
  onSwapped,
}: {
  open: boolean;
  sessionId: string;
  exerciseId: string;
  onClose: () => void;
  onSwapped?: (exerciseId: string) => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogA11y(open, onClose, panelRef);
  if (!open) return null;
  return (
    <div className="sheet-enter-backdrop fixed inset-0 z-50 flex items-end bg-black/60 md:items-center md:justify-center md:p-4" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="coach-sheet-title"
        tabIndex={-1}
        data-testid="exercise-coach-sheet"
        onClick={(e) => e.stopPropagation()}
        className="sheet-enter-panel max-h-[88vh] w-full overflow-y-auto rounded-t-sheet border border-border bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-elevated md:max-w-lg md:rounded-sheet"
      >
        <CoachBody sessionId={sessionId} exerciseId={exerciseId} onClose={onClose} onSwapped={onSwapped} />
      </div>
    </div>
  );
}

function CoachBody({
  sessionId,
  exerciseId,
  onClose,
  onSwapped,
}: {
  sessionId: string;
  exerciseId: string;
  onClose: () => void;
  onSwapped?: (exerciseId: string) => void;
}) {
  const sessions = useStore((s) => s.sessions);
  const sets = useStore((s) => s.sets);
  const exercises = useStore((s) => s.exercises);
  const devices = useStore((s) => s.devices);
  const templates = useStore((s) => s.templates);
  const units = useStore((s) => s.units);
  const coaching = useStore((s) => s.profile.coaching);
  const swap = useStore((s) => s.swapSessionExercise);

  const evidence = useMemo(
    () =>
      buildCoachEvidence({ sessions, sets, exercises, devices, templates, units, coaching: coaching ?? null }, sessionId, exerciseId, {
        planMatch: (name) => matchExercise(name, exercises),
      }),
    [sessions, sets, exercises, devices, templates, units, coaching, sessionId, exerciseId],
  );

  const ai = useAiStatus();
  const aiReady = ai.available === true && ai.signedIn && ai.consented === true;
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<AiResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!evidence) {
    return (
      <>
        <SheetHeader title="Coach" onClose={onClose} />
        <p className="text-sm text-muted">This exercise isn&apos;t in the workout any more.</p>
      </>
    );
  }

  const { context: c, assessment: a, substitutions } = evidence;
  const reading = result?.reading ?? ruleReading(evidence);
  const hasOpen = c.today.some((s) => !s.completed);

  const ask = async (q: string | null) => {
    setLoading(true);
    setError(null);
    try {
      // The server reads the synced log, so send today's sets first.
      await pushState();
      setResult(await postAi<AiResult>("/api/ai/exercise-coach", { sessionId, exerciseId, question: q }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "The coach couldn't answer. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const doSwap = (toId: string, name: string) => {
    const moved = swap(sessionId, exerciseId, toId);
    if (moved === 0) {
      toast("Nothing left to swap on this exercise.");
      return;
    }
    toast(`Swapped to ${name} for this workout`);
    onSwapped?.(toId);
    onClose();
  };

  const next = a.next;
  const nextLoad = next?.weight != null && next.weight > 0 ? `${next.weight} ${c.units}` : null;
  const nextReps = next?.reps != null ? `${next.reps} reps` : null;

  return (
    <div className="space-y-5">
      <SheetHeader title={c.exercise.name} onClose={onClose} />

      {/* Measured: today's sets against the plan, computed from the log. */}
      <section className="space-y-3" aria-label="Today's sets" data-testid="coach-measured">
        <div className="flex flex-wrap items-center gap-2">
          <span className={STATUS[a.status].badge}>{STATUS[a.status].text}</span>
          <span className="text-xs tabular-nums text-muted">
            Target {a.repMin === a.repMax ? a.repMin : `${a.repMin}–${a.repMax}`} reps
            {c.plan?.targetRpe ? ` · RPE ${c.plan.targetRpe}` : ""}
          </span>
        </div>

        {next && (
          <div className="rounded-control bg-surface2 p-4">
            <p className="eyebrow mb-1 text-muted">Next set · {ACTION[next.action]}</p>
            {(nextLoad || nextReps) && next.action !== "finish" && (
              <p className="font-display text-2xl font-bold tabular-nums text-ink">{[nextLoad, nextReps].filter(Boolean).join(" × ")}</p>
            )}
            <p className="mt-1 text-sm text-inkSoft">{next.reason}</p>
          </div>
        )}

        {a.sets.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label="Set check">
            {a.sets.map((s) => (
              <li key={s.index} className="chip gap-1 text-xs">
                <span className="text-muted">Set {s.index + 1}</span>
                <span className={`font-semibold ${VERDICT[s.verdict].cls}`}>{VERDICT[s.verdict].text}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Reading: visibly apart from the numbers above. */}
      <section
        className={`space-y-3 rounded-card border p-4 ${
          result?.fallback === "red_flag" ? "border-danger/40 bg-danger/[0.06]" : "border-ai/30 bg-ai/[0.06]"
        }`}
        aria-label="Coach"
        data-testid="coach-reading"
      >
        <div className="flex flex-wrap items-center gap-2">
          <p className="eyebrow text-ai">
            <Sparkles className="h-3.5 w-3.5 fill-current" aria-hidden /> {reading.source === "ai" ? "AI coach" : "Coach"}
          </p>
          <span className="text-xs text-muted">
            {reading.source === "ai"
              ? "Uses only the numbers above"
              : result?.fallback === "invalid"
                ? "The AI's answer didn't match your numbers, so this is the rule-based reading"
                : result?.fallback === "unavailable"
                  ? "AI unavailable right now — rule-based reading"
                  : result?.fallback === "red_flag"
                    ? "Safety first"
                    : "Rule-based reading"}
          </span>
        </div>

        {loading ? (
          <div className="space-y-2" aria-label="Thinking">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-full" />
          </div>
        ) : (
          <>
            <p className="text-[15px] leading-snug text-ink">{reading.answer}</p>
            {reading.cues.length > 0 && (
              <ul className="space-y-1">
                {reading.cues.map((cue) => (
                  <li key={cue} className="flex gap-2 text-sm text-inkSoft">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ai" aria-hidden />
                    {cue}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}

        {ai.available === true && ai.signedIn && ai.consented === false ? (
          <AiConsentCard compact />
        ) : aiReady ? (
          <form
            className="space-y-2 border-t border-ai/20 pt-3"
            onSubmit={(e) => {
              e.preventDefault();
              void ask(question.trim() || null);
            }}
          >
            <label htmlFor="coach-question" className="sr-only">
              Ask about this exercise
            </label>
            <input
              id="coach-question"
              className="input"
              value={question}
              maxLength={MAX_QUESTION}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask, e.g. my lower back feels it — what should I change?"
            />
            <button type="submit" className="btn-secondary min-h-11 w-full text-sm" disabled={loading}>
              <Sparkles className="h-4 w-4" aria-hidden /> {question.trim() ? "Ask coach" : "Explain this set"}
            </button>
          </form>
        ) : null}
      </section>

      {/* Stand-ins: library exercises for the same muscle, within your equipment. */}
      {substitutions.length > 0 && (
        <section aria-labelledby="coach-swaps">
          <h3 id="coach-swaps" className="section-label mb-2 px-1">
            Taken or not for you? Swap for
          </h3>
          <ul className="card divide-y divide-border overflow-hidden p-0">
            {substitutions.map((s) => (
              <li key={s.exerciseId} className="flex items-center gap-3 p-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-ink">{s.name}</span>
                  <span className="mt-0.5 block text-xs leading-snug text-muted">{s.reason}</span>
                </span>
                <button
                  type="button"
                  className="btn-secondary min-h-11 shrink-0 px-3 text-sm"
                  disabled={!hasOpen}
                  onClick={() => doSwap(s.exerciseId, s.name)}
                  aria-label={`Swap to ${s.name}`}
                >
                  <ArrowLeftRight className="h-4 w-4" aria-hidden /> Swap
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 px-1 text-xs text-muted">
            {hasOpen ? "Swaps the sets you haven't logged, for this workout only. Your plan stays the same." : "All sets are logged — nothing left to swap."}
          </p>
        </section>
      )}
    </div>
  );
}

function SheetHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="eyebrow text-ai">
          <Sparkles className="h-3.5 w-3.5" aria-hidden /> Exercise coach
        </p>
        <h2 id="coach-sheet-title" className="font-display mt-1 truncate text-xl font-bold text-ink">
          {title}
        </h2>
      </div>
      <button type="button" onClick={onClose} aria-label="Close" className="grid h-11 w-11 shrink-0 place-items-center rounded-control bg-surface2 text-inkSoft hover:text-ink">
        <X className="h-5 w-5" aria-hidden />
      </button>
    </div>
  );
}
