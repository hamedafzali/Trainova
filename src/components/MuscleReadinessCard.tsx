"use client";

import { useMemo, useState } from "react";
import { BatteryCharging, CircleCheck, TriangleAlert } from "lucide-react";
import { BodyMap } from "@/components/BodyMap";
import { hoursUntilReady, muscleReadiness, MAP_MUSCLES, type Readiness } from "@/domain/recovery";
import { label, type Muscle } from "@/domain/taxonomy";
import { useStore } from "@/lib/store";

const FILL: Record<Readiness, string> = {
  fresh: "fill-border",
  light: "fill-flame/25",
  worked: "fill-flame/55",
  recovering: "fill-flame/90",
};

const LEGEND: { key: Readiness; text: string }[] = [
  { key: "fresh", text: "Fresh" },
  { key: "light", text: "Light" },
  { key: "worked", text: "Worked" },
  { key: "recovering", text: "Recovering" },
];

function ago(iso: string, now: number) {
  const h = Math.max(1, Math.round((now - +new Date(iso)) / 3_600_000));
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
}

function within(hours: number) {
  return hours < 24 ? `~${hours} h` : `~${Math.round(hours / 24)} d`;
}

const list = (ms: Muscle[]) => ms.map(label).join(", ");

/**
 * Today's recovery picture: which muscles are fresh and which still carry
 * fatigue from the last week, cross-checked against the next workout.
 */
export function MuscleReadinessCard({ targets, workoutName }: { targets: Set<Muscle>; workoutName?: string }) {
  const sessions = useStore((s) => s.sessions);
  const sets = useStore((s) => s.sets);
  const exerciseById = useStore((s) => s.exerciseById);
  const [selected, setSelected] = useState<Muscle | null>(null);

  const now = Date.now();
  const state = useMemo(
    () => muscleReadiness(sessions, sets, exerciseById),
    // Recomputed when training data changes; minute-level drift doesn't matter.
    [sessions, sets, exerciseById],
  );

  const by = (r: Readiness[]) => MAP_MUSCLES.filter((m) => r.includes(state.get(m)!.readiness));
  const recovering = by(["recovering"]);
  const worked = by(["worked"]);
  const ready = by(["fresh", "light"]);
  const trainedAny = MAP_MUSCLES.some((m) => state.get(m)!.lastTrained);

  const targetList = MAP_MUSCLES.filter((m) => targets.has(m));
  const sore = targetList.filter((m) => state.get(m)!.readiness === "recovering");
  const sel = selected ? state.get(selected) : null;

  return (
    <section className="card p-5 sm:p-6" aria-labelledby="readiness">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="section-label">Recovery</p>
          <h2 id="readiness" className="font-display mt-1 text-h3 font-extrabold text-ink">
            Muscle readiness
          </h2>
        </div>
        <span className="badge-success shrink-0">
          {ready.length} of {MAP_MUSCLES.length} ready
        </span>
      </div>

      <div className="mt-4 grid items-center gap-5 sm:grid-cols-[minmax(0,15rem)_1fr]">
        <div>
          <BodyMap
            className="mx-auto w-full max-w-[15rem]"
            fillFor={(m) => FILL[state.get(m)!.readiness]}
            pulse={(m) => state.get(m)!.readiness === "recovering"}
            targets={targets}
            selected={selected}
            onSelect={(m) => setSelected((s) => (s === m ? null : m))}
          />
          <div className="mt-1 flex justify-around text-[11px] font-semibold uppercase tracking-wide text-muted" aria-hidden>
            <span>Front</span>
            <span>Back</span>
          </div>
        </div>

        <div className="space-y-3 text-sm">
          {targetList.length > 0 && (
            <p
              className={`flex gap-2 rounded-control p-3 ${sore.length ? "bg-warningSoft" : "bg-successSoft"}`}
            >
              {sore.length ? (
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber" aria-hidden />
              ) : (
                <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-green" aria-hidden />
              )}
              <span className="text-inkSoft">
                {sore.length ? (
                  <>
                    <span className="font-semibold text-ink">{list(sore)} still recovering.</span> Go a little lighter
                    there today, or start with what&apos;s fresh.
                  </>
                ) : (
                  <>
                    <span className="font-semibold text-ink">Good to go.</span> Every muscle {workoutName ? "this workout" : "it"}{" "}
                    trains is recovered.
                  </>
                )}
              </span>
            </p>
          )}

          <div aria-live="polite" className="min-h-[2.75rem] rounded-control bg-surface2 px-3 py-2">
            {sel ? (
              <>
                <p className="font-semibold text-ink">
                  {label(sel.muscle)} · {LEGEND.find((l) => l.key === sel.readiness)!.text.toLowerCase()}
                </p>
                <p className="text-xs text-muted">
                  {sel.lastTrained ? `Last trained ${ago(sel.lastTrained, now)}` : "Not trained this week"}
                  {hoursUntilReady(sel.load) > 0 && ` · ready in ${within(hoursUntilReady(sel.load))}`}
                </p>
              </>
            ) : !trainedAny ? (
              <p className="text-inkSoft">Everything is fresh. Finish a workout and the map lights up where you trained.</p>
            ) : (
              <p className="text-inkSoft">
                {recovering.length > 0 && (
                  <>
                    <BatteryCharging className="mr-1 inline h-4 w-4 align-[-3px] text-flame" aria-hidden />
                    <span className="font-semibold text-ink">Recovering:</span> {list(recovering)}.{" "}
                  </>
                )}
                {worked.length > 0 && (
                  <>
                    <span className="font-semibold text-ink">Worked:</span> {list(worked)}.{" "}
                  </>
                )}
                <span className="text-muted">Tap a muscle for details.</span>
              </p>
            )}
          </div>

          <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted" aria-label="Legend">
            {LEGEND.map((l) => (
              <li key={l.key} className="inline-flex items-center gap-1.5">
                <svg viewBox="0 0 10 10" className="h-3 w-3" aria-hidden>
                  <circle cx="5" cy="5" r="4.5" className={`${FILL[l.key]} stroke-border`} />
                </svg>
                {l.text}
              </li>
            ))}
            {targetList.length > 0 && (
              <li className="inline-flex items-center gap-1.5">
                <svg viewBox="0 0 10 10" className="h-3 w-3" aria-hidden>
                  <circle cx="5" cy="5" r="4" className="fill-none stroke-accent stroke-[1.5]" />
                </svg>
                Today&apos;s workout
              </li>
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}
