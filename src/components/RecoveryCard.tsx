"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, TriangleAlert } from "lucide-react";
import { muscleReadiness, readinessEstimate, type ReadinessBand } from "@/domain/recovery";
import { localDayKey } from "@/domain/streak";
import type { RecoveryCheckIn } from "@/domain/types";
import { useStore } from "@/lib/store";

type Scores = Pick<RecoveryCheckIn, "sleep" | "energy" | "soreness" | "stress">;
type Score = Scores["sleep"];

const SCALES: { key: keyof Scores; label: string; low: string; high: string }[] = [
  { key: "sleep", label: "Sleep last night", low: "Poor", high: "Great" },
  { key: "energy", label: "Energy", low: "Drained", high: "Full" },
  { key: "soreness", label: "Soreness", low: "None", high: "Very sore" },
  { key: "stress", label: "Stress", low: "Calm", high: "Very high" },
];

const BAND: Record<ReadinessBand, { title: string; badge: string }> = {
  ready: { title: "Ready to train", badge: "badge-success" },
  moderate: { title: "Take it a bit easier", badge: "badge-warning" },
  low: { title: "Go light today", badge: "badge-danger" },
};

function CheckInForm({ initial, onSave, onCancel }: { initial: Scores | null; onSave: (v: Scores) => void; onCancel?: () => void }) {
  const [values, setValues] = useState<Partial<Scores>>(initial ?? {});
  const complete = SCALES.every((s) => values[s.key]);
  return (
    <form
      className="space-y-4"
      aria-label="Daily check-in"
      onSubmit={(e) => {
        e.preventDefault();
        if (complete) onSave(values as Scores);
      }}
    >
      {SCALES.map((s) => (
        <fieldset key={s.key}>
          <legend className="mb-2 text-sm font-medium text-inkSoft">{s.label}</legend>
          <div className="grid grid-cols-5 gap-1.5">
            {([1, 2, 3, 4, 5] as Score[]).map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={values[s.key] === n}
                aria-label={`${s.label}: ${n} of 5${n === 1 ? ` (${s.low})` : n === 5 ? ` (${s.high})` : ""}`}
                onClick={() => setValues((v) => ({ ...v, [s.key]: n }))}
                className={`min-h-11 rounded-control text-sm font-semibold tabular-nums transition-colors ${
                  values[s.key] === n ? "bg-accentFill text-onAccent" : "bg-surface2 text-inkSoft hover:bg-border/60"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-muted" aria-hidden>
            <span>{s.low}</span>
            <span>{s.high}</span>
          </div>
        </fieldset>
      ))}
      <div className="flex gap-2">
        <button type="submit" className="btn-primary flex-1" disabled={!complete}>
          Save check-in
        </button>
        {onCancel && (
          <button type="button" className="btn-ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

/**
 * Today's readiness: a labelled estimate from the daily check-in, recent
 * workout feedback and training load, with every reason listed.
 */
export function RecoveryCard() {
  const sessions = useStore((s) => s.sessions);
  const sets = useStore((s) => s.sets);
  const feedback = useStore((s) => s.feedback);
  const checkIns = useStore((s) => s.checkIns);
  const exerciseById = useStore((s) => s.exerciseById);
  const recordCheckIn = useStore((s) => s.recordCheckIn);
  const [editing, setEditing] = useState(false);

  const today = localDayKey(new Date());
  const todays = checkIns.find((c) => c.date === today) ?? null;
  const estimate = useMemo(
    () =>
      readinessEstimate({
        checkIn: todays,
        feedback,
        trainedDates: sessions.filter((s) => s.status === "completed").map((s) => s.date),
        muscles: muscleReadiness(sessions, sets, exerciseById),
        today,
      }),
    [todays, feedback, sessions, sets, exerciseById, today],
  );
  const band = BAND[estimate.band];
  const showForm = editing || !todays;

  return (
    <section className="card space-y-4 p-4 sm:p-5" aria-labelledby="recovery-today">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="section-label">Recovery</p>
          <h2 id="recovery-today" className="font-display mt-1 text-h3 font-extrabold text-ink">
            Today&apos;s readiness
          </h2>
        </div>
        <span className="badge-neutral shrink-0">Estimate</span>
      </div>

      <div className="flex items-center gap-4" data-testid="readiness-estimate">
        {/* Without a check-in the number would look more certain than it is. */}
        {estimate.confidence === "normal" && (
          <p className="font-display text-[2.5rem] font-bold leading-none tabular-nums text-ink">
            {estimate.score}
            <span className="text-base font-semibold text-muted">/100</span>
          </p>
        )}
        <div className="min-w-0">
          <span className={band.badge}>{band.title}</span>
          <p className="mt-1 text-body-sm text-inkSoft">{estimate.advice}</p>
        </div>
      </div>

      {estimate.painReported && (
        <p className="flex gap-2 rounded-control bg-surface2 p-3 text-body-sm text-ink" role="note">
          <TriangleAlert size={18} className="mt-0.5 shrink-0 text-amber" aria-hidden />
          You noted pain after a recent workout. Don&apos;t train through it; if it&apos;s sharp or keeps coming back, get it
          checked before loading that area again.
        </p>
      )}

      {estimate.factors.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="What went into this estimate">
          {estimate.factors.map((f) => (
            <li key={`${f.key}-${f.label}`} className="badge-neutral">
              {f.effect === "up" ? (
                <ArrowUp size={14} className="text-green" aria-label="helps" />
              ) : (
                <ArrowDown size={14} className="text-amber" aria-label="lowers" />
              )}
              {f.label}
            </li>
          ))}
        </ul>
      )}

      <p className="text-[11px] leading-relaxed text-muted">
        {estimate.confidence === "low"
          ? "Based on your training only. Check in below to get a score. "
          : "From today's check-in and your recent training. "}
        A rough guide built from simple rules, not a medical measurement.
      </p>

      <div className="border-t border-border pt-4">
        {showForm ? (
          <>
            <h3 className="mb-3 font-semibold text-ink">{todays ? "Update today's check-in" : "How are you today?"}</h3>
            <CheckInForm
              initial={todays}
              onSave={(v) => {
                recordCheckIn(today, v);
                setEditing(false);
              }}
              onCancel={todays ? () => setEditing(false) : undefined}
            />
          </>
        ) : (
          <button type="button" className="text-body-sm text-accent" onClick={() => setEditing(true)}>
            Update today&apos;s check-in
          </button>
        )}
      </div>
    </section>
  );
}
