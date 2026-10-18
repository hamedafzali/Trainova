"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CircleCheck, Flame, RefreshCw, Target, Trophy, type LucideIcon } from "lucide-react";
import { useStore } from "@/lib/store";
import { postAi, useAiStatus } from "@/lib/ai";
import { stableHash } from "@/lib/hash";
import { currentTrainerContext } from "@/lib/trainerContext";
import { localDayKey } from "@/domain/streak";
import type { ReviewStatus, TrainerConsistency, TrainerContext, TrainerReview } from "@/domain/trainer";
import type { TrainingSummary } from "@/domain/coach";
import { Skeleton } from "@/components/Skeleton";
import { ActionCard } from "./ActionCard";

const CACHE_KEY = "trainova-coach-review";

type Cached = { day: string; activity: string; review: TrainerReview; applied: boolean[] };

const STATUS: Record<ReviewStatus, { label: string; badge: string }> = {
  on_track: { label: "On track", badge: "badge-success" },
  needs_attention: { label: "Needs attention", badge: "badge-warning" },
  getting_started: { label: "Getting started", badge: "badge-accent" },
};

/** Changes when training changes (not when the plan is edited), so applying a suggestion doesn't re-run the review. */
function activityHash(ctx: TrainerContext): string {
  return stableHash({ recent: ctx.recent, consistency: ctx.consistency, records: ctx.records, profile: ctx.profile });
}

function readCache(): Cached | null {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Cached) : null;
  } catch {
    return null;
  }
}

function writeCache(c: Cached): void {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(c));
  } catch {
    // cache only
  }
}

function Stat({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  tone?: "good" | "warn" | "flame";
  icon?: LucideIcon;
}) {
  const color =
    tone === "good" ? "text-green" : tone === "warn" ? "text-amber" : tone === "flame" ? "text-flame" : "text-ink";
  return (
    <div className="min-w-0 rounded-control bg-surface2 px-3 py-2">
      <p className="truncate text-xs text-muted">{label}</p>
      <p className={`flex items-center gap-1 truncate text-sm font-semibold tabular-nums ${color}`}>
        {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden />}
        {value}
      </p>
    </div>
  );
}

/** Every at-a-glance number on the coach page, in one place (plan consistency + volume + records). */
function StatusStrip({ c, summary }: { c: TrainerConsistency; summary?: TrainingSummary }) {
  const last =
    c.daysSinceLast === null ? "—" : c.daysSinceLast === 0 ? "Today" : c.daysSinceLast === 1 ? "Yesterday" : `${c.daysSinceLast} days ago`;
  const trend = summary?.volumeTrendPct ?? null;
  const prs = summary?.recentPRs.length ?? 0;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      <Stat
        label="This week"
        value={c.programDays ? `${c.sessionsThisWeek} of ${c.programDays}` : `${c.sessionsThisWeek}`}
        tone={c.programDays && c.sessionsThisWeek >= c.programDays ? "good" : undefined}
      />
      <Stat
        label="Weekly streak"
        value={c.weekStreak > 0 ? `${c.weekStreak} wk` : "—"}
        icon={c.weekStreak > 0 ? Flame : undefined}
        tone={c.weekStreak > 0 ? "flame" : undefined}
      />
      <Stat label="Last workout" value={last} tone={c.daysSinceLast !== null && c.daysSinceLast > 7 ? "warn" : undefined} />
      <Stat label="Weeks trained" value={`${c.weeksTrainedLast4} of last 4`} />
      <Stat
        label="Volume vs last month"
        value={trend === null ? "—" : `${trend > 0 ? "+" : ""}${trend}%`}
        tone={trend === null ? undefined : trend >= 5 ? "good" : trend <= -5 ? "warn" : undefined}
      />
      <Stat label="Recent records" value={prs > 0 ? `${prs}` : "—"} icon={prs > 0 ? Trophy : undefined} tone={prs > 0 ? "good" : undefined} />
    </div>
  );
}

function Points({ title, items, icon }: { title: string; items: string[]; icon: "win" | "focus" }) {
  if (items.length === 0) return null;
  const Icon = icon === "win" ? CircleCheck : Target;
  return (
    <div className="space-y-1.5">
      <p className="section-label">{title}</p>
      <ul className="space-y-1.5">
        {items.map((t, i) => (
          <li key={i} className="flex gap-2 text-sm text-inkSoft">
            <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${icon === "win" ? "text-green" : "text-accent"}`} aria-hidden />
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** "Your status": local consistency numbers plus an AI review of training against the active plan. */
export function StatusReview({ summary }: { summary?: TrainingSummary } = {}) {
  const ai = useAiStatus();
  const ready = ai.available === true && ai.signedIn && ai.consented === true;
  // Re-derive when training data changes.
  const sessions = useStore((s) => s.sessions);
  const programs = useStore((s) => s.programs);
  const consistency = useMemo(() => currentTrainerContext().consistency, [sessions, programs]); // eslint-disable-line react-hooks/exhaustive-deps

  const [cached, setCached] = useState<Cached | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    const ctx = currentTrainerContext();
    setLoading(true);
    setError(null);
    try {
      const review = await postAi<TrainerReview>("/api/ai/review", { context: ctx });
      const next: Cached = {
        day: localDayKey(new Date()),
        activity: activityHash(ctx),
        review,
        applied: review.actions.map(() => false),
      };
      writeCache(next);
      setCached(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The review failed. Try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  // One review per day, or sooner after new training is logged.
  useEffect(() => {
    if (!ready) return;
    const c = readCache();
    const ctx = currentTrainerContext();
    if (c && c.day === localDayKey(new Date()) && c.activity === activityHash(ctx)) setCached(c);
    else void run();
  }, [ready, sessions, run]);

  const markApplied = (i: number) => {
    if (!cached) return;
    const next = { ...cached, applied: cached.applied.map((a, j) => a || j === i) };
    writeCache(next);
    setCached(next);
  };

  const review = cached?.review;
  const status = review ? STATUS[review.status] : null;

  return (
    <section className="card space-y-4 p-4 sm:p-5" aria-labelledby="coach-status">
      <div className="flex items-center gap-2">
        <h2 id="coach-status" className="font-semibold text-ink">
          Your status
        </h2>
        {status && !loading && <span className={status.badge}>{status.label}</span>}
        {ready && (
          <button
            type="button"
            onClick={() => void run()}
            disabled={loading}
            className="btn-ghost ml-auto h-11 w-11 shrink-0 p-0"
            aria-label="Refresh review"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden />
          </button>
        )}
      </div>

      <StatusStrip c={consistency} summary={summary} />

      {!ready ? null : loading && !review ? (
        <div className="space-y-2" aria-label="Reviewing your training">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      ) : error && !review ? (
        <div className="space-y-2">
          <p className="text-sm text-inkSoft">{error}</p>
          <button type="button" onClick={() => void run()} className="btn-secondary px-4 py-1.5 text-sm">
            Try again
          </button>
        </div>
      ) : review ? (
        <div key={review.headline} className={`enter-fade space-y-4 transition-opacity duration-200 ${loading ? "opacity-60" : ""}`}>
          <div className="space-y-1">
            <p className="text-base font-semibold text-ink">{review.headline}</p>
            <p className="text-sm leading-relaxed text-inkSoft">{review.summary}</p>
          </div>
          {(review.wins.length > 0 || review.focus.length > 0) && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Points title="Going well" items={review.wins} icon="win" />
              <Points title="Focus on" items={review.focus} icon="focus" />
            </div>
          )}
          {review.nextSession && (
            <div className="space-y-1.5 rounded-control border border-border p-3">
              <p className="section-label">Next workout{review.nextSession.name ? ` · ${review.nextSession.name}` : ""}</p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-inkSoft">
                {review.nextSession.hints.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            </div>
          )}
          {review.actions.length > 0 && (
            <div className="space-y-2">
              <p className="section-label">Suggested changes</p>
              <ul className="space-y-2">
                {review.actions.map((a, i) => (
                  <ActionCard key={i} action={a} applied={cached?.applied[i] ?? false} onApplied={() => markApplied(i)} />
                ))}
              </ul>
            </div>
          )}
          {error && <p className="text-xs text-danger">{error}</p>}
        </div>
      ) : null}
    </section>
  );
}
