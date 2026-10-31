import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { ChevronLeft, ChevronRight, Dumbbell, Trophy } from "lucide-react-native";
import { formatMinutes, periodFor, summarisePeriod, weeklyBest, type PeriodKind } from "@/domain/periodStats";
import { localDayKey, startOfWeek } from "@/domain/streak";
import { exerciseTypeOf } from "@/domain/exerciseType";
import { MUSCLE_GROUPS, muscleGroupOf, type MuscleGroup } from "@/domain/taxonomy";
import type { PersonalRecord, Units } from "@/domain/types";
import { useStore } from "@/lib/store";
import { displayWeight, formatWeight, fromDisplay, toDisplay } from "@/lib/units";
import { toast } from "@/lib/toast";
import { Button, Card, Chip, EmptySlot, ListCard, ListRow, PageHeader, Row, Screen, SectionHeader, Segmented, StatBand, Stepper, Txt } from "~/ui/kit";
import { alpha, radius, usePalette } from "~/ui/theme";

type Tab = "overview" | "strength" | "body" | "workouts";
const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "strength", label: "Strength" },
  { key: "body", label: "Body" },
  { key: "workouts", label: "Log" },
];

type ExRow = {
  exId: string;
  name: string;
  group: MuscleGroup;
  sessions: number;
  headline: string;
  caption: string;
  weighted: boolean;
  trendPct: number | null;
};

const PR_LABEL: Record<PersonalRecord["kind"], string> = {
  e1rm: "Est. 1RM",
  max_weight: "Heaviest",
  max_reps: "Most reps",
};

function prValue(p: PersonalRecord, units: Units): string {
  return p.kind === "max_reps" ? `${p.value} reps` : formatWeight(p.value, units);
}

const shortDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

// Short labels so the three fit one row on a phone.
const PERIODS = [
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "quarter", label: "3 months" },
] as const;

/** Progress tab: the period summary, per-exercise trends, records, bodyweight and the workout log. */
export default function ProgressTab() {
  const p = usePalette();
  const units = useStore((s) => s.units);
  const sessions = useStore((s) => s.sessions);
  const sets = useStore((s) => s.sets);
  const prs = useStore((s) => s.prs);
  const bodyLog = useStore((s) => s.bodyLog);
  const exercises = useStore((s) => s.exercises);
  const profileWeight = useStore((s) => s.profile.weightKg ?? null);
  const exercisesWithHistory = useStore((s) => s.exercisesWithHistory);
  const exerciseHistory = useStore((s) => s.exerciseHistory);
  const exerciseById = useStore((s) => s.exerciseById);
  const deviceForExercise = useStore((s) => s.deviceForExercise);
  const bestsFor = useStore((s) => s.bestsFor);

  const [tab, setTab] = useState<Tab>("overview");
  const [kind, setKind] = useState<PeriodKind>("week");
  const [offset, setOffset] = useState(0);
  const [group, setGroup] = useState<MuscleGroup | "all">("all");
  const [liftId, setLiftId] = useState<string | null>(null);

  const rows = useMemo<ExRow[]>(
    () =>
      exercisesWithHistory()
        .map((exId) => {
          const ex = exerciseById(exId);
          const type = exerciseTypeOf(ex, deviceForExercise(exId));
          const hist = exerciseHistory(exId);
          const bests = bestsFor(exId);
          let series: number[];
          let headline: string;
          let caption: string;
          let weighted = false;
          if (type === "duration") {
            series = hist.map((h) => h.durationSec);
            headline = `${Math.max(0, ...series)} s`;
            caption = "longest hold";
          } else if (type === "cardio") {
            const dist = hist.some((h) => h.distance > 0);
            series = hist.map((h) => (dist ? h.distance : h.durationMin));
            headline = `${Math.max(0, ...series)} ${dist ? "km" : "min"}`;
            caption = dist ? "longest distance" : "longest session";
          } else if (type === "bodyweight_reps" || bests.maxWeight <= 0) {
            series = hist.map((h) => h.maxReps);
            headline = `${bests.maxReps} reps`;
            caption = "best set";
          } else {
            series = hist.map((h) => displayWeight(h.e1rm || h.topWeight, units));
            headline = formatWeight(bests.maxWeight, units);
            caption = bests.e1rm ? `heaviest · est. 1RM ${formatWeight(bests.e1rm, units)}` : "heaviest";
            weighted = true;
          }
          const first = series[0] ?? 0;
          const last = series[series.length - 1] ?? 0;
          return {
            exId,
            name: ex?.name ?? "Exercise",
            group: muscleGroupOf(ex?.primaryMuscle),
            sessions: hist.length,
            headline,
            caption,
            weighted,
            trendPct: series.length >= 2 && first > 0 ? Math.round(((last - first) / first) * 100) : null,
          };
        })
        .sort((a, b) => b.sessions - a.sessions),
    // Store selectors read live state; recompute when the data changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sets, sessions, units],
  );

  const body = [...bodyLog].sort((a, b) => a.date.localeCompare(b.date));
  const today = new Date();
  const period = periodFor(kind, offset, today);
  const summary = summarisePeriod({ sessions, sets, exercises, prs, bodyweightKg: body[body.length - 1]?.weightKg ?? profileWeight }, period);
  const periodLabel = offset === 0 ? `This ${kind}` : offset === 1 ? `Last ${kind}` : `${fmtDay(period.from)} – ${fmtDay(period.to)}`;

  const lifts = rows.filter((r) => r.weighted);
  const lift = lifts.find((r) => r.exId === liftId) ?? lifts[0];
  const weekly = lift
    ? weeklyBest(
        exerciseHistory(lift.exId).map((h) => ({ date: h.date, value: h.e1rm })),
        5,
        today,
      ).map((w) => ({ week: w.week, label: fmtDay(w.week), value: displayWeight(w.value, units) }))
    : [];
  const latest = weekly[weekly.length - 1];
  const prior = weekly.length >= 2 ? weekly[weekly.length - 2] : undefined;
  const change = latest && prior ? Math.round((latest.value - prior.value) * 10) / 10 : null;
  const lastWeek = localDayKey(startOfWeek(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7)));
  const vsLabel = prior?.week === lastWeek && latest?.week === localDayKey(startOfWeek(today)) ? "vs last week" : "vs previous";

  const recentPrs = [...prs].sort((a, b) => b.achievedAt.localeCompare(a.achievedAt)).slice(0, 5);
  const groups = MUSCLE_GROUPS.filter((g) => rows.some((r) => r.group === g.key));
  const visible = group === "all" ? rows : rows.filter((r) => r.group === group);
  const recentWorkouts = sessions
    .filter((s) => s.status === "completed")
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, 12);

  return (
    <Screen>
      <PageHeader title="Progress" subtitle="How your training is adding up." />
      <Segmented label="Progress section" options={TABS} value={tab} onChange={setTab} />

      {tab === "overview" && (
        <>
          <Card style={{ gap: 12 }}>
            <Segmented
              label="Period"
              options={PERIODS}
              value={kind}
              onChange={(k) => {
                setKind(k);
                setOffset(0);
              }}
            />
            <Row style={{ justifyContent: "space-between" }}>
              <PeriodArrow dir="back" onPress={() => setOffset(offset + 1)} />
              <Txt v="h3">{periodLabel}</Txt>
              <PeriodArrow dir="forward" disabled={offset === 0} onPress={() => setOffset(Math.max(0, offset - 1))} />
            </Row>
          </Card>
          <StatBand
            stats={[
              { label: "Sessions", value: summary.workouts },
              { label: "Time", value: formatMinutes(summary.minutes) },
              { label: "Kcal*", value: summary.calories.toLocaleString() },
              { label: "PRs", value: summary.prs, foot: summary.prs > 0 ? "New records" : undefined, footColor: p.warning },
            ]}
          />
          <Txt v="meta" style={{ marginTop: -12, paddingHorizontal: 4 }}>
            *Estimated from time trained
            {summary.bodyweightAssumed ? " and a 75 kg default — log your weight for a closer figure" : " and your bodyweight"}.
          </Txt>

          <Card style={{ gap: 12 }}>
            <Txt v="h3">Muscle focus</Txt>
            {summary.muscles.length === 0 ? (
              <Txt v="bodySm" color={p.muted} style={{ textAlign: "center", paddingVertical: 12 }}>
                No working sets in this period.
              </Txt>
            ) : (
              summary.muscles.map((m) => (
                <View key={m.group} style={{ gap: 6 }} accessible accessibilityLabel={`${m.label}: ${m.pct} percent of working sets`}>
                  <Row style={{ justifyContent: "space-between" }}>
                    <Txt v="bodySm">{m.label}</Txt>
                    <Txt v="label">{m.pct}%</Txt>
                  </Row>
                  <View style={{ height: 8, borderRadius: 4, backgroundColor: p.well, overflow: "hidden" }}>
                    <View style={{ height: 8, width: `${m.pct}%`, borderRadius: 4, backgroundColor: p.accent }} />
                  </View>
                </View>
              ))
            )}
          </Card>

          <Card style={{ gap: 12 }}>
            <Row style={{ justifyContent: "space-between" }}>
              <Txt v="h3">Strength progress</Txt>
              <Pressable onPress={() => setTab("strength")} accessibilityRole="button" hitSlop={10}>
                <Txt v="label" color={p.accent}>
                  View all
                </Txt>
              </Pressable>
            </Row>
            {!lift ? (
              <Txt v="bodySm" color={p.muted} style={{ textAlign: "center", paddingVertical: 12 }}>
                Log a weighted lift to see your strength trend.
              </Txt>
            ) : (
              <>
                {lifts.length > 1 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    {lifts.slice(0, 12).map((r) => (
                      <Chip key={r.exId} label={r.name} on={r.exId === lift.exId} onPress={() => setLiftId(r.exId)} />
                    ))}
                  </ScrollView>
                )}
                {latest && (
                  <View>
                    <Txt v="display">
                      {latest.value} <Txt v="body" color={p.inkSoft}>{units}</Txt>
                    </Txt>
                    {change !== null && (
                      <Txt v="bodySm">
                        <Txt v="bodySm" color={change >= 0 ? p.accent : p.warning}>
                          {change >= 0 ? "+" : ""}
                          {change} {units}
                        </Txt>{" "}
                        {vsLabel}
                      </Txt>
                    )}
                  </View>
                )}
                <WeekBars data={weekly} unit={units} />
                <Txt v="meta">Best estimated 1RM per week, last 5 weeks.</Txt>
              </>
            )}
          </Card>
        </>
      )}

      {tab === "strength" &&
        (rows.length === 0 ? (
          <EmptySlot action={<Button label="Start a workout" onPress={() => router.push("/workouts")} />}>
            Log a couple of workouts and your progress for every exercise will show up here.
          </EmptySlot>
        ) : (
          <>
            {recentPrs.length > 0 && (
              <View>
                <SectionHeader title="Latest records" />
                <ListCard>
                  {recentPrs.map((r, i) => (
                    <ListRow
                      key={`${r.exerciseId}-${r.kind}`}
                      icon={Trophy}
                      title={exerciseById(r.exerciseId)?.name ?? "Exercise"}
                      meta={PR_LABEL[r.kind]}
                      trailing={<Txt v="label">{prValue(r, units)}</Txt>}
                      onPress={() => router.push(`/exercises/${r.exerciseId}`)}
                      last={i === recentPrs.length - 1}
                    />
                  ))}
                </ListCard>
              </View>
            )}
            <View style={{ gap: 12 }}>
              <SectionHeader title="Exercises" />
              {groups.length > 1 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ marginTop: -10 }}>
                  <Chip label="All" on={group === "all"} onPress={() => setGroup("all")} />
                  {groups.map((g) => (
                    <Chip key={g.key} label={g.label} on={group === g.key} onPress={() => setGroup(g.key)} />
                  ))}
                </ScrollView>
              )}
              <ListCard>
                {visible.map((r, i) => {
                  const trend = r.trendPct == null ? "flat" : r.trendPct >= 5 ? "up" : r.trendPct <= -5 ? "down" : "flat";
                  return (
                    <ListRow
                      key={r.exId}
                      title={r.name}
                      meta={`${r.sessions} session${r.sessions === 1 ? "" : "s"} · ${r.caption}`}
                      onPress={() => router.push(`/exercises/${r.exId}`)}
                      last={i === visible.length - 1}
                      trailing={
                        <View style={{ alignItems: "flex-end" }}>
                          <Txt v="label">{r.headline}</Txt>
                          {trend !== "flat" && r.trendPct != null ? (
                            <Txt v="meta" color={trend === "up" ? p.success : p.warning}>
                              {trend === "up" ? "▲" : "▼"} {Math.abs(r.trendPct)}%
                            </Txt>
                          ) : null}
                        </View>
                      }
                    />
                  );
                })}
              </ListCard>
            </View>
          </>
        ))}

      {tab === "body" && <BodyPanel />}

      {tab === "workouts" &&
        (recentWorkouts.length === 0 ? (
          <EmptySlot>Your finished workouts will show up here.</EmptySlot>
        ) : (
          <>
            <ListCard>
              {recentWorkouts.map((w, i) => {
                const n = sets.filter((x) => x.sessionId === w.id && x.completed).length;
                return (
                  <ListRow
                    key={w.id}
                    icon={Dumbbell}
                    title={w.title}
                    meta={`${shortDate(w.startedAt)} · ${n} sets`}
                    onPress={() => router.push(`/session/${w.id}`)}
                    last={i === recentWorkouts.length - 1}
                  />
                );
              })}
            </ListCard>
            <Button variant="secondary" label="Full history" onPress={() => router.push("/history")} />
          </>
        ))}
    </Screen>
  );
}

function fmtDay(key: string): string {
  return new Date(key + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function PeriodArrow({ dir, onPress, disabled }: { dir: "back" | "forward"; onPress: () => void; disabled?: boolean }) {
  const p = usePalette();
  const I = dir === "back" ? ChevronLeft : ChevronRight;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={dir === "back" ? "Previous period" : "Next period"}
      accessibilityState={{ disabled }}
      style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.3 : 1 }}
    >
      <I color={p.ink} size={20} />
    </Pressable>
  );
}

/** Five weekly bars; the latest week is lit. */
function WeekBars({ data, unit }: { data: { week: string; label: string; value: number }[]; unit: string }) {
  const p = usePalette();
  if (data.length === 0)
    return (
      <Txt v="bodySm" color={p.muted}>
        No estimated 1RM in the last five weeks.
      </Txt>
    );
  const max = Math.max(...data.map((d) => d.value), 1);
  const min = Math.min(...data.map((d) => d.value));
  // Start bars a little below the lowest week so small gains stay visible.
  const floor = Math.max(0, min - (max - min || max * 0.2));
  return (
    <Row gap={10} style={{ alignItems: "flex-end", height: 140 }}>
      {data.map((d, i) => {
        const h = 20 + ((d.value - floor) / (max - floor || 1)) * 90;
        const lit = i === data.length - 1;
        return (
          <View key={d.week} style={{ flex: 1, alignItems: "center", gap: 6 }} accessible accessibilityLabel={`Week of ${d.label}: ${d.value} ${unit}`}>
            <Txt v="meta" color={lit ? p.ink : p.muted}>
              {d.value}
            </Txt>
            <View style={{ width: "100%", height: h, borderRadius: radius.chip, backgroundColor: lit ? p.accentFill : alpha(p.accent, 0.18) }} />
            <Txt v="meta">{d.label}</Txt>
          </View>
        );
      })}
    </Row>
  );
}

function BodyPanel() {
  const p = usePalette();
  const units = useStore((s) => s.units);
  const bodyLog = useStore((s) => s.bodyLog);
  const profileWeight = useStore((s) => s.profile.weightKg ?? null);
  const addBodyweight = useStore((s) => s.addBodyweight);
  const removeBodyweight = useStore((s) => s.removeBodyweight);
  const latestKg = [...bodyLog].sort((a, b) => a.date.localeCompare(b.date)).at(-1)?.weightKg ?? profileWeight ?? (units === "kg" ? 75 : fromDisplay(165, units));
  const [value, setValue] = useState(Math.round(toDisplay(latestKg, units) * 10) / 10);
  const entries = [...bodyLog].sort((a, b) => b.date.localeCompare(a.date));
  const first = entries[entries.length - 1];
  const delta = entries.length >= 2 ? Math.round((toDisplay(entries[0].weightKg, units) - toDisplay(first.weightKg, units)) * 10) / 10 : null;

  return (
    <>
      <Card style={{ gap: 12 }}>
        <Txt v="h3">Log bodyweight</Txt>
        <Stepper label="Today" value={value} step={units === "kg" ? 0.5 : 1} decimals={1} min={20} unit={units} onChange={setValue} />
        <Button
          label="Save"
          onPress={() => {
            addBodyweight(localDayKey(new Date()), fromDisplay(value, units));
            toast("Weight logged", { variant: "success" });
          }}
        />
      </Card>
      <View>
        <SectionHeader title="History" />
        {entries.length === 0 ? (
          <EmptySlot>Log your weight to see a trend.</EmptySlot>
        ) : (
          <>
            {delta !== null && (
              <Txt v="bodySm" style={{ paddingHorizontal: 4, marginBottom: 10 }}>
                {delta > 0 ? "+" : ""}
                {delta} {units} since {fmtDay(first.date)}
              </Txt>
            )}
            <ListCard>
              {entries.slice(0, 30).map((b, i) => (
                <ListRow
                  key={b.id}
                  title={formatWeight(b.weightKg, units)}
                  meta={fmtDay(b.date)}
                  last={i === Math.min(entries.length, 30) - 1}
                  trailing={
                    <Pressable
                      onPress={() => removeBodyweight(b.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Delete entry from ${fmtDay(b.date)}`}
                      hitSlop={8}
                      style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 4 }}
                    >
                      <Txt v="label" color={p.error}>
                        Delete
                      </Txt>
                    </Pressable>
                  }
                />
              ))}
            </ListCard>
          </>
        )}
      </View>
    </>
  );
}
