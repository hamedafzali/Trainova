"use client";

import { useMemo, useRef, useState } from "react";
import { Loader2, Share2, X } from "lucide-react";
import { describeSet } from "@/components/SessionExercise";
import { exerciseTypeOf } from "@/domain/exerciseType";
import { epley1rm } from "@/domain/progression";
import { sessionMuscleLoad } from "@/domain/recovery";
import { totalVolume } from "@/domain/volume";
import { recapSvg, shareRecap, svgDataUrl, type RecapData } from "@/lib/recap";
import { useStore } from "@/lib/store";
import { toast } from "@/lib/toast";
import { formatVolume } from "@/lib/units";
import { useDialogA11y } from "@/lib/useDialogA11y";

function durationLabel(start: string, end: string | null) {
  const min = end ? Math.max(1, Math.round((+new Date(end) - +new Date(start)) / 60000)) : 0;
  return min >= 60 ? `${Math.floor(min / 60)} h ${min % 60}` : `${min} min`;
}

/** Recap data for one finished session, straight from the store. */
function useRecapData(sessionId: string): RecapData | null {
  const session = useStore((s) => s.sessions.find((x) => x.id === sessionId));
  const allSets = useStore((s) => s.sets);
  const prs = useStore((s) => s.prs);
  const units = useStore((s) => s.units);
  const exerciseById = useStore((s) => s.exerciseById);
  const deviceById = useStore((s) => s.deviceById);

  return useMemo(() => {
    if (!session) return null;
    const done = allSets.filter((s) => s.sessionId === sessionId && s.completed);
    const working = done.filter((s) => s.kind !== "warmup");

    // Best set per exercise (by estimated 1RM, then reps), in workout order.
    const best = new Map<string, (typeof done)[number]>();
    const score = (s: (typeof done)[number]) => epley1rm(s.actualWeight ?? 0, s.actualReps ?? 0) * 1000 + (s.actualReps ?? 0);
    for (const s of working) {
      const cur = best.get(s.exerciseId);
      if (!cur || score(s) > score(cur)) best.set(s.exerciseId, s);
    }
    const topSets = [...best.values()].map((s) => {
      const ex = exerciseById(s.exerciseId);
      const type = exerciseTypeOf(ex, deviceById(s.deviceId ?? ex?.defaultDeviceId ?? undefined));
      return { name: ex?.name ?? "Exercise", detail: describeSet(s, type, units) };
    });

    // PRs set during this workout, one name per exercise.
    const end = session.completedAt ?? new Date().toISOString();
    const ids = new Set(done.map((s) => s.exerciseId));
    const prNames = [
      ...new Set(
        prs
          .filter((p) => ids.has(p.exerciseId) && p.achievedAt >= session.startedAt && p.achievedAt <= end)
          .map((p) => exerciseById(p.exerciseId)?.name ?? "Exercise"),
      ),
    ];

    return {
      title: session.title,
      dateLabel: new Date(session.startedAt).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }),
      duration: durationLabel(session.startedAt, session.completedAt ?? null),
      volume: formatVolume(totalVolume(done), units),
      sets: working.length,
      prNames,
      muscles: sessionMuscleLoad(done, exerciseById),
      topSets,
    };
  }, [session, allSets, prs, units, exerciseById, deviceById, sessionId]);
}

/** Post-workout recap sheet: a preview of the share image plus Share / Done. */
export function WorkoutRecap({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const data = useRecapData(sessionId);
  const svg = useMemo(() => (data ? recapSvg(data) : ""), [data]);
  const panelRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  useDialogA11y(true, onClose, panelRef);

  if (!data) return null;

  const share = async () => {
    setBusy(true);
    try {
      const r = await shareRecap(svg, `trainova-${data.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`);
      if (r === "saved") toast("Image saved", { variant: "success" });
    } catch {
      toast("Couldn't create the image", { variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  const summary = `${data.title}: ${data.duration}, ${data.volume}, ${data.sets} sets${
    data.prNames.length ? `, ${data.prNames.length} new personal records` : ""
  }.`;

  return (
    <div className="sheet-enter-backdrop fixed inset-0 z-50 flex items-end bg-black/70 p-4 md:items-center md:justify-center">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="recap-title"
        tabIndex={-1}
        className="sheet-enter-panel enter-fade flex max-h-full w-full max-w-sm flex-col rounded-sheet border border-border bg-surface p-4 shadow-elevated"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 id="recap-title" className="text-h3 font-bold text-ink">
            Workout recap
          </h2>
          <button type="button" onClick={onClose} className="-mr-2 grid h-11 w-11 place-items-center rounded-full text-muted hover:bg-surface2" aria-label="Close">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- generated data URL, not an optimisable asset */}
        <img
          src={svgDataUrl(svg)}
          alt={summary}
          className="mx-auto min-h-0 w-full max-w-[19rem] flex-1 rounded-card object-contain shadow-elevated motion-safe:animate-popIn"
        />
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Done
          </button>
          <button type="button" className="btn-primary" onClick={share} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Share2 className="h-4 w-4" aria-hidden />}
            Share
          </button>
        </div>
      </div>
    </div>
  );
}
