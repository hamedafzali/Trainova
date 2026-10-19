"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Bookmark, Ellipsis, Info, Layers, Plus, SearchX, ShieldCheck, Sparkles, Timer, Trophy, User } from "lucide-react";
import { ExerciseCoachSheet } from "@/components/ExerciseCoachSheet";
import { BodyMap } from "@/components/BodyMap";
import { EmptyState } from "@/components/EmptyState";
import { LineChart } from "@/components/LineChart";
import { MovementGuide, MovementHero } from "@/components/motion/MovementGuide";
import { SetTable, type SetRow } from "@/components/ui/SetTable";
import { TabPanel, Tabs } from "@/components/ui/Tabs";
import { useTabParam } from "@/lib/useTabParam";
import { tipFor } from "@/domain/exerciseTips";
import { musclesWorked } from "@/domain/recovery";
import { toast } from "@/lib/toast";
import { ListSkeleton } from "@/components/Skeleton";
import { describeSet } from "@/components/SessionExercise";
import { equipmentOf, exerciseTypeLabel } from "@/components/ExerciseBrowser";
import { exerciseTypeOf } from "@/domain/exerciseType";
import { EQUIPMENT, label, type Muscle } from "@/domain/taxonomy";
import type { TemplateExercise, WorkoutSet } from "@/domain/types";
import { useHydrated, useStore } from "@/lib/store";
import { displayWeight, formatVolume, formatWeight } from "@/lib/units";

type Metric = { key: string; label: string; unit: string; pick: (h: History) => number };
type History = ReturnType<ReturnType<typeof useStore.getState>["exerciseHistory"]>[number];
type Tab = "overview" | "muscles" | "instructions";

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "muscles", label: "Muscles" },
  { key: "instructions", label: "Instructions" },
];
const TAB_KEYS = TABS.map((t) => t.key);
const TAG: Record<string, string> = { warmup: "W", drop: "D", failure: "F" };

export default function ExerciseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const hydrated = useHydrated();
  const [tab, setTab] = useTabParam(TAB_KEYS, "overview");
  const templates = useStore((s) => s.templates);
  const favorite = useStore((s) => (s.profile.favoriteExerciseIds ?? []).includes(id));
  const toggleFavorite = useStore((s) => s.toggleFavoriteExercise);
  const getActiveSession = useStore((s) => s.getActiveSession);
  const startSession = useStore((s) => s.startSession);
  const addSet = useStore((s) => s.addSet);
  const updateSet = useStore((s) => s.updateSet);
  const completeSet = useStore((s) => s.completeSet);
  const units = useStore((s) => s.units);
  const exercise = useStore((s) => s.exercises.find((e) => e.id === id));
  const device = useStore((s) => s.deviceForExercise(id));
  const sessions = useStore((s) => s.sessions);
  const sets = useStore((s) => s.sets);
  const prs = useStore((s) => s.prs);
  const exerciseHistory = useStore((s) => s.exerciseHistory);
  const bestsFor = useStore((s) => s.bestsFor);
  const type = exerciseTypeOf(exercise, device);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const history = useMemo(() => (hydrated ? exerciseHistory(id) : []), [hydrated, id, sessions, sets]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const bests = useMemo(() => bestsFor(id), [id, sets]);

  const metrics = useMemo<Metric[]>(() => {
    if (type === "duration") return [{ key: "hold", label: "Longest hold", unit: "s", pick: (h) => h.durationSec }];
    if (type === "cardio")
      return [
        { key: "min", label: "Minutes", unit: "min", pick: (h) => h.durationMin },
        ...(history.some((h) => h.distance > 0)
          ? [{ key: "km", label: "Distance", unit: "km", pick: (h: History) => h.distance }]
          : []),
      ];
    const reps: Metric = { key: "reps", label: "Best set reps", unit: "reps", pick: (h) => h.maxReps };
    if (type === "bodyweight_reps" || bests.maxWeight <= 0)
      return [reps, { key: "total", label: "Total reps", unit: "reps", pick: (h) => h.totalReps }];
    return [
      { key: "e1rm", label: "Est. 1RM", unit: units, pick: (h) => displayWeight(h.e1rm, units) },
      { key: "top", label: "Top weight", unit: units, pick: (h) => displayWeight(h.topWeight, units) },
      { key: "vol", label: "Volume", unit: units, pick: (h) => displayWeight(h.volume, units) },
    ];
  }, [type, history, bests.maxWeight, units]);
  const [metricKey, setMetricKey] = useState<string | null>(null);
  const [coachOpen, setCoachOpen] = useState(false);
  const metric = metrics.find((m) => m.key === metricKey) ?? metrics[0];

  const recent = useMemo(() => {
    const byId = new Map(sessions.map((s) => [s.id, s]));
    const groups = new Map<string, typeof sets>();
    for (const x of sets) {
      if (x.exerciseId !== id || !x.completed) continue;
      const s = byId.get(x.sessionId);
      if (!s || s.status === "archived") continue;
      groups.set(x.sessionId, [...(groups.get(x.sessionId) ?? []), x]);
    }
    return [...groups.entries()]
      .map(([sid, xs]) => ({ session: byId.get(sid)!, sets: xs.sort((a, b) => a.setIndex - b.setIndex) }))
      .sort((a, b) => b.session.startedAt.localeCompare(a.session.startedAt))
      .slice(0, 8);
  }, [sessions, sets, id]);

  if (!hydrated) return <ListSkeleton />;
  if (!exercise)
    return (
      <EmptyState
        icon={SearchX}
        title="Exercise not found"
        body="It may have been removed from your library."
        action={
          <Link href="/exercises" className="btn-primary mt-2">
            Browse exercises
          </Link>
        }
      />
    );

  const myPrs = prs.filter((p) => p.exerciseId === id);
  const eq = EQUIPMENT.find((x) => x.key === equipmentOf(exercise, device))?.label;
  const series = history.map((h) => ({ label: h.date, value: metric.pick(h) }));
  const first = series[0]?.value ?? 0;
  const last = series[series.length - 1]?.value ?? 0;
  const trend = series.length < 2 ? "accent" : last > first ? "up" : last < first ? "down" : "flat";
  const weighted = metrics[0]?.key === "e1rm";

  // Working sets: the live workout's, else the last workout's, else a plan's targets.
  const active = getActiveSession();
  const liveSets = active
    ? sets.filter((x) => x.sessionId === active.id && x.exerciseId === id).sort((a, b) => a.setIndex - b.setIndex)
    : [];
  const live = active !== null && liveSets.length > 0;
  const planTpl =
    (active?.templateId && templates.find((t) => t.id === active.templateId && t.exercises.some((e) => e.exerciseId === id))) ||
    templates.find((t) => t.exercises.some((e) => e.exerciseId === id));
  const te: TemplateExercise | undefined = planTpl?.exercises.find((e) => e.exerciseId === id);
  const restLabel = `${te?.restSeconds ?? (exercise.isCompound ? 120 : 90)}s`;
  const source: { sets: WorkoutSet[]; kind: "live" | "last" | "plan" | "none"; sessionId?: string } = live
    ? { sets: liveSets, kind: "live", sessionId: active!.id }
    : recent[0]
      ? { sets: recent[0].sets, kind: "last", sessionId: recent[0].session.id }
      : te
        ? {
            kind: "plan",
            sets: te.sets.map((ts, i) => ({
              id: `plan-${i}`,
              targetReps: ts.targetReps,
              targetWeight: ts.targetWeight,
              actualReps: null,
              actualWeight: null,
              rpe: te.targetRpe ?? null,
              completed: false,
            })) as WorkoutSet[],
          }
        : { sets: [], kind: "none" };
  const rows: SetRow[] = source.sets.map((x) => {
    const w = x.actualWeight ?? x.targetWeight;
    const r = x.actualReps ?? x.targetReps;
    const timed = type === "duration" || type === "cardio";
    return {
      id: x.id,
      weight: timed ? describeSet(x, type, units, true) : type === "bodyweight_reps" ? "BW" : w != null ? formatWeight(w, units) : "–",
      reps: timed ? "–" : r != null ? String(r) : "–",
      rpe: x.rpe != null ? String(x.rpe) : "–",
      rest: restLabel,
      done: x.completed,
      tag: x.kind ? TAG[x.kind] : undefined,
    };
  });

  const reps = [...(te ? te.sets.map((x) => x.targetReps) : []), ...(te?.repMax ? [te.repMax] : [])].filter((n) => n > 0);
  const seen = reps.length ? reps : (recent[0]?.sets ?? []).map((x) => x.actualReps ?? 0).filter((n) => n > 0);
  const repRange = seen.length
    ? Math.min(...seen) === Math.max(...seen)
      ? String(seen[0])
      : `${Math.min(...seen)}–${Math.max(...seen)}`
    : exercise.isCompound
      ? "6–10"
      : "8–15";
  const worked = musclesWorked(exercise);
  const primary = new Set<Muscle>(worked.filter((w) => w.share === 1).map((w) => w.muscle));
  const helpers = new Set<Muscle>(worked.filter((w) => w.share < 1).map((w) => w.muscle));
  const fill = (m: Muscle) => (primary.has(m) ? "fill-accentFill" : helpers.has(m) ? "fill-chart2" : "fill-surface2");

  /** Start a workout holding just this exercise, then open it. */
  const startHere = () => {
    const { id: sid, blocked } = startSession(null);
    if (blocked || !sid) {
      const a = getActiveSession();
      if (a) router.push(`/session/${a.id}`);
      return;
    }
    addSet(sid, id);
    router.push(`/session/${sid}`);
  };
  const logSet = () => {
    if (!live) return startHere();
    const nextSet = liveSets.find((x) => !x.completed);
    if (!nextSet) {
      addSet(active!.id, id);
      return toast("Set added — enter what you lifted, then log it.");
    }
    const reps = nextSet.actualReps ?? nextSet.targetReps;
    const weight = nextSet.actualWeight ?? nextSet.targetWeight;
    if (reps == null || (weight == null && type === "weight_reps")) return router.push(`/session/${active!.id}`);
    updateSet(nextSet.id, { actualReps: reps, actualWeight: weight });
    const { newPrs } = completeSet(nextSet.id);
    toast(newPrs.length ? "Set logged — new personal record!" : "Set logged", { variant: "success" });
  };
  const addOne = () => (live ? addSet(active!.id, id) : startHere());

  return (
    <main className="mx-auto max-w-3xl">
      <header className="-mx-4 flex items-center gap-1 px-2 pb-2 md:mx-0 md:px-0">
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? router.back() : router.push("/exercises"))}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink hover:bg-surface"
          aria-label="Back"
        >
          <ArrowLeft className="h-6 w-6" aria-hidden />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-center text-[19px] font-medium text-ink">{exercise.name}</h1>
        {live && (
          <button
            type="button"
            onClick={() => setCoachOpen(true)}
            aria-label="Exercise coach"
            title="Coach for today's workout"
            data-testid="open-exercise-coach"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-ai hover:bg-surface"
          >
            <Sparkles className="h-6 w-6" strokeWidth={1.7} aria-hidden />
          </button>
        )}
        <button
          type="button"
          onClick={() => toggleFavorite(id)}
          aria-pressed={favorite}
          aria-label={favorite ? "Remove bookmark" : "Bookmark exercise"}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink hover:bg-surface"
        >
          <Bookmark className={`h-6 w-6 ${favorite ? "fill-accent text-accent" : ""}`} strokeWidth={1.7} aria-hidden />
        </button>
        <MoreMenu />
      </header>

      {live && (
        <ExerciseCoachSheet
          open={coachOpen}
          sessionId={active!.id}
          exerciseId={id}
          onClose={() => setCoachOpen(false)}
          onSwapped={() => router.push(`/session/${active!.id}`)}
        />
      )}

      <Tabs tabs={TABS} value={tab} onChange={setTab} label="Exercise sections" idPrefix="ex" className="-mx-4 px-2 md:mx-0 md:px-0" />

      {tab === "overview" && (
        <TabPanel idPrefix="ex" tab="overview">
          <div className="-mx-4 md:mx-0 md:mt-4 md:overflow-hidden md:rounded-card">
            <MovementHero exercise={exercise} />
          </div>

          <div className="mt-3 space-y-3">
            <dl className="grid grid-cols-3 divide-x divide-border rounded-card bg-surface py-3.5">
              <Attr icon={Layers} value={exercise.isCompound ? "Compound" : "Isolation"} label="Movement" />
              <Attr icon={User} value={exercise.primaryMuscle ? label(exercise.primaryMuscle) : "Full body"} label="Primary muscle" />
              <Attr icon={Timer} value={repRange} label="Rep range" />
            </dl>

            <section className="card space-y-3 p-4" aria-labelledby="working-sets">
              <div className="flex items-center justify-between">
                <div>
                  <h2 id="working-sets" className="text-[16px] text-ink">
                    Working Sets
                  </h2>
                  {source.kind !== "live" && source.kind !== "none" && (
                    <p className="text-xs text-muted">
                      {source.kind === "last"
                        ? `Last workout · ${new Date(recent[0].session.startedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
                        : `Planned in ${planTpl?.name}`}
                    </p>
                  )}
                </div>
                {source.sessionId ? (
                  <Link href={`/session/${source.sessionId}`} className="-mr-2 inline-flex min-h-11 items-center px-2 text-[15px] text-accent">
                    Edit
                  </Link>
                ) : planTpl ? (
                  <Link href={`/templates/${planTpl.id}`} className="-mr-2 inline-flex min-h-11 items-center px-2 text-[15px] text-accent">
                    Edit
                  </Link>
                ) : null}
              </div>
              {rows.length > 0 ? (
                <SetTable rows={rows} caption={`Working sets for ${exercise.name}`} />
              ) : (
                <p className="py-4 text-center text-sm text-muted">No sets yet. Log one to start a workout with this exercise.</p>
              )}
              <div className="grid grid-cols-[1.25fr_1fr] gap-3 pt-1">
                <button type="button" onClick={logSet} className="btn-volt min-h-12 text-[16px] font-medium">
                  Log Set
                </button>
                <button
                  type="button"
                  onClick={addOne}
                  className="btn min-h-12 border border-inkSoft/40 text-[16px] font-medium text-ink hover:bg-surface2"
                >
                  <Plus className="h-4 w-4" aria-hidden /> Add Set
                </button>
              </div>
            </section>

            <section className="card flex items-center gap-4 p-4" aria-labelledby="ex-tips">
              <div className="min-w-0 flex-1 space-y-2">
                <h2 id="ex-tips" className="flex items-center gap-2 text-[16px] text-ink">
                  <ShieldCheck className="h-5 w-5 text-accent" aria-hidden /> Exercise tips
                </h2>
                <p className="text-[15px] leading-relaxed text-inkSoft">{tipFor(exercise, te?.cue)}</p>
              </div>
              <BodyMap view="front" fillFor={fill} className="h-24 w-14 shrink-0" />
            </section>

      {history.length === 0 ? (
        <p className="px-4 py-2 text-center text-sm text-muted">
          Your progress on this exercise shows up here once you&apos;ve logged it.
        </p>
      ) : (
        <>
          <section aria-label="Personal bests" className="grid grid-cols-3 gap-2 sm:gap-3">
            {weighted ? (
              <>
                <Stat label="Est. 1RM" value={formatWeight(bests.e1rm, units)} />
                <Stat label="Heaviest" value={formatWeight(bests.maxWeight, units)} />
                <Stat label="Most reps" value={String(bests.maxReps)} />
              </>
            ) : (
              <>
                <Stat label="Sessions" value={String(history.length)} />
                <Stat
                  label={metrics[0].label}
                  value={`${Math.max(0, ...history.map(metrics[0].pick))} ${metrics[0].unit}`}
                />
                <Stat label="Last" value={`${last} ${metric.unit}`} />
              </>
            )}
          </section>

          <section className="card space-y-4 p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-h3 text-ink">Trend</h2>
              {metrics.length > 1 && (
                <div role="radiogroup" aria-label="Metric" className="flex gap-1 rounded-control bg-surface2 p-1">
                  {metrics.map((m) => (
                    <button
                      key={m.key}
                      type="button"
                      role="radio"
                      aria-checked={metric.key === m.key}
                      onClick={() => setMetricKey(m.key)}
                      className={`min-h-9 rounded-[8px] px-3 py-1 text-xs font-semibold transition-colors ${
                        metric.key === m.key ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <LineChart data={series} unit={metric.unit} trend={trend} />
          </section>

          {myPrs.length > 0 && (
            <section id="records" className="card scroll-mt-4 space-y-2 p-4 sm:p-6">
              <h2 className="flex items-center gap-2 text-h3 text-ink">
                <Trophy className="h-5 w-5 text-gold" aria-hidden /> Records
              </h2>
              <ul className="divide-y divide-border text-sm">
                {myPrs.map((p) => (
                  <li key={p.kind} className="flex items-center justify-between py-2">
                    <span className="text-inkSoft">
                      {p.kind === "e1rm" ? "Est. 1RM" : p.kind === "max_weight" ? "Heaviest" : "Most reps"}
                    </span>
                    <span className="text-right">
                      <span className="font-semibold tabular-nums text-ink">
                        {p.kind === "max_reps" ? `${p.value} reps` : formatWeight(p.value, units)}
                      </span>
                      <span className="ml-2 text-xs text-muted">
                        {new Date(p.achievedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section id="recent-sessions" className="scroll-mt-4 space-y-2">
            <h2 className="text-h2 text-ink">Recent sessions</h2>
            <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
              {recent.map(({ session, sets: xs }) => {
                const vol = history.find((h) => h.date === session.date)?.volume ?? 0;
                return (
                  <li key={session.id}>
                    <Link href={`/session/${session.id}`} className="block px-4 py-3 hover:bg-surface2/60 sm:px-5">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="truncate font-semibold text-ink">{session.title}</p>
                        <p className="shrink-0 text-xs text-muted">
                          {new Date(session.startedAt).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}
                        </p>
                      </div>
                      <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm tabular-nums text-inkSoft">
                        {xs.map((x) => (
                          <span key={x.id} className={x.kind === "warmup" ? "text-muted" : ""}>
                            {x.kind && x.kind !== "normal" ? `${x.kind === "warmup" ? "W" : x.kind === "drop" ? "D" : "F"} ` : ""}
                            {describeSet(x, type, units)}
                          </span>
                        ))}
                      </p>
                      {weighted && vol > 0 && <p className="mt-1 text-xs text-muted">{formatVolume(vol, units)} volume</p>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}
          </div>
        </TabPanel>
      )}

      {tab === "muscles" && (
        <TabPanel idPrefix="ex" tab="muscles">
          <section className="card mt-4 space-y-4 p-4 sm:p-6">
            <BodyMap fillFor={fill} className="mx-auto w-full max-w-xs" />
            <div className="flex justify-around text-[11px] font-semibold uppercase tracking-wide text-muted" aria-hidden>
              <span>Front</span>
              <span>Back</span>
            </div>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="flex items-center gap-2 text-sm text-inkSoft">
                  <span className="h-2.5 w-2.5 rounded-full bg-chart1" aria-hidden /> Main muscles
                </dt>
                <dd className="mt-1 text-ink">{[...primary].map(label).join(", ") || "—"}</dd>
              </div>
              <div>
                <dt className="flex items-center gap-2 text-sm text-inkSoft">
                  <span className="h-2.5 w-2.5 rounded-full bg-chart2" aria-hidden /> Helpers
                </dt>
                <dd className="mt-1 text-ink">{[...helpers].map(label).join(", ") || "—"}</dd>
              </div>
            </dl>
            <p className="text-xs text-muted">
              {[eq, exerciseTypeLabel(exercise, device), exercise.level && label(exercise.level)].filter(Boolean).join(" · ")}
            </p>
          </section>
        </TabPanel>
      )}

      {tab === "instructions" && (
        <TabPanel idPrefix="ex" tab="instructions">
          <div className="mt-4 space-y-3">
            <section className="card space-y-3 p-4 sm:p-6">
              <h2 className="text-[16px] text-ink">How to</h2>
              {exercise.instructions?.length ? (
                <ol className="space-y-3">
                  {exercise.instructions.map((step, i) => (
                    <li key={i} className="flex gap-3 text-[15px] text-inkSoft">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-surface2 text-xs font-semibold text-accent">
                        {i + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-[15px] text-inkSoft">{tipFor(exercise, te?.cue)}</p>
              )}
              {device?.guidance && (
                <p className="flex gap-2 rounded-control bg-surface2 p-3 text-sm text-inkSoft">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
                  <span>
                    <span className="font-semibold text-ink">
                      {device.name}
                      {device.machineNumber ? ` (No. ${device.machineNumber})` : ""}:
                    </span>{" "}
                    {device.guidance}
                  </span>
                </p>
              )}
            </section>
            <MovementGuide exercise={exercise} />
          </div>
        </TabPanel>
      )}
    </main>
  );
}

function Attr({ icon: Icon, value, label }: { icon: typeof Layers; value: string; label: string }) {
  return (
    <div className="flex min-w-0 items-center justify-center gap-2 px-1.5">
      <Icon className="h-6 w-6 shrink-0 text-inkSoft" strokeWidth={1.6} aria-hidden />
      <div className="min-w-0 text-left">
        <dd className="truncate text-[13px] text-ink">{value}</dd>
        <dt className="text-[12px] leading-tight text-inkSoft">{label}</dt>
      </div>
    </div>
  );
}

/** "…" menu: jump to the parts of the screen below the fold, or to the library. */
function MoreMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="More options"
        className="grid h-11 w-11 place-items-center rounded-full text-ink hover:bg-surface"
      >
        <Ellipsis className="h-6 w-6" aria-hidden />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-12 z-30 w-52 overflow-hidden rounded-control border border-border bg-surface2 py-1 shadow-elevated">
          {[
            ["#records", "Personal records"],
            ["#recent-sessions", "Recent sessions"],
            ["/exercises", "All exercises"],
          ].map(([href, text]) => (
            <Link key={href} role="menuitem" href={href} onClick={() => setOpen(false)} className="block px-4 py-3 text-sm text-ink hover:bg-surface">
              {text}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-card border border-border bg-surface p-3 sm:p-4">
      <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="font-display mt-1 truncate text-lg font-extrabold tabular-nums text-ink sm:text-2xl">{value}</p>
    </div>
  );
}
