import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Bookmark, Play, Plus, ShieldCheck, Trophy } from "lucide-react-native";
import { exerciseTypeOf } from "@/domain/exerciseType";
import { tipFor } from "@/domain/exerciseTips";
import { musclesWorked } from "@/domain/recovery";
import { label, type Muscle } from "@/domain/taxonomy";
import { useStore } from "@/lib/store";
import { displayWeight, formatVolume, formatWeight } from "@/lib/units";
import { GuideView } from "~/features/GuideView";
import { describeSet } from "~/features/SessionExercise";
import { BackButton, Button, Card, EmptySlot, IconButton, ListCard, Row, Screen, SectionHeader, Segmented, StatBand, Txt } from "~/ui/kit";
import { usePalette } from "~/ui/theme";

type Tab = "overview" | "how" | "progress";
const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "how", label: "How to" },
  { key: "progress", label: "Progress" },
];

/** One exercise: the 3D guide, how to do it, the muscles it works and your history with it. */
export default function ExerciseScreen() {
  const p = usePalette();
  const { id } = useLocalSearchParams<{ id: string }>();
  const exercise = useStore((s) => s.exercises.find((e) => e.id === id));
  const device = useStore((s) => s.deviceForExercise(id));
  const units = useStore((s) => s.units);
  const sessions = useStore((s) => s.sessions);
  const sets = useStore((s) => s.sets);
  const prs = useStore((s) => s.prs);
  const templates = useStore((s) => s.templates);
  const favorite = useStore((s) => (s.profile.favoriteExerciseIds ?? []).includes(id));
  const toggleFavorite = useStore((s) => s.toggleFavoriteExercise);
  const exerciseHistory = useStore((s) => s.exerciseHistory);
  const bestsFor = useStore((s) => s.bestsFor);
  const getActiveSession = useStore((s) => s.getActiveSession);
  const startSession = useStore((s) => s.startSession);
  const addSet = useStore((s) => s.addSet);
  const [tab, setTab] = useState<Tab>("overview");

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const history = useMemo(() => exerciseHistory(id), [id, sessions, sets]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const bests = useMemo(() => bestsFor(id), [id, sets]);
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

  if (!exercise)
    return (
      <Screen>
        <BackButton />
        <EmptySlot action={<Button label="Browse exercises" onPress={() => router.replace("/exercises")} />}>
          This exercise may have been removed from your library.
        </EmptySlot>
      </Screen>
    );

  const type = exerciseTypeOf(exercise, device);
  const weighted = type === "weight_reps" && bests.maxWeight > 0;
  const te = templates.flatMap((t) => t.exercises).find((e) => e.exerciseId === id);
  const worked = musclesWorked(exercise);
  const primary = worked.filter((w) => w.share === 1).map((w) => w.muscle);
  const helpers = worked.filter((w) => w.share < 1).map((w) => w.muscle);
  const names = (ms: Muscle[]) => ms.map(label).join(", ") || "—";
  const myPrs = prs.filter((x) => x.exerciseId === id);
  const active = getActiveSession();

  const reps = [...(te ? te.sets.map((x) => x.targetReps) : []), ...(te?.repMax ? [te.repMax] : [])].filter((n) => n > 0);
  const repRange = reps.length
    ? Math.min(...reps) === Math.max(...reps)
      ? String(reps[0])
      : `${Math.min(...reps)}–${Math.max(...reps)}`
    : exercise.isCompound
      ? "6–10"
      : "8–15";

  /** Add this exercise to the live workout, or start one holding just it. */
  const train = () => {
    if (active) {
      addSet(active.id, id);
      router.push(`/session/${active.id}`);
      return;
    }
    const { id: sid } = startSession(null);
    if (!sid) return;
    addSet(sid, id);
    router.push(`/session/${sid}`);
  };

  return (
    <Screen>
      <Row style={{ justifyContent: "space-between", marginBottom: -8 }}>
        <BackButton />
        <IconButton icon={Bookmark} label={favorite ? "Remove bookmark" : "Bookmark exercise"} pressed={favorite} onPress={() => toggleFavorite(id)} />
      </Row>
      <View style={{ gap: 4 }}>
        <Txt v="title">{exercise.name}</Txt>
        <Txt v="bodySm" color={p.muted}>
          {[exercise.primaryMuscle ? label(exercise.primaryMuscle) : "Full body", device?.name].filter(Boolean).join(" · ")}
        </Txt>
      </View>

      <GuideView exercise={exercise} />

      <Button variant="volt" icon={active ? Plus : Play} label={active ? "Add to current workout" : "Train this now"} onPress={train} />

      <Segmented label="Exercise sections" options={TABS} value={tab} onChange={setTab} />

      {tab === "overview" && (
        <>
          <StatBand
            stats={[
              { label: "Movement", value: exercise.isCompound ? "Compound" : "Isolation" },
              { label: "Rep range", value: repRange },
              { label: "Rest", value: `${te?.restSeconds ?? (exercise.isCompound ? 120 : 90)}s` },
            ]}
          />
          <Card style={{ gap: 8 }}>
            <Row>
              <ShieldCheck color={p.accent} size={20} />
              <Txt v="h3">Exercise tip</Txt>
            </Row>
            <Txt v="bodySm">{tipFor(exercise, te?.cue)}</Txt>
          </Card>
          <Card style={{ gap: 12 }}>
            <Txt v="h3">Muscles worked</Txt>
            <View style={{ gap: 2 }}>
              <Txt v="meta">Main muscles</Txt>
              <Txt v="body">{names(primary)}</Txt>
            </View>
            <View style={{ gap: 2 }}>
              <Txt v="meta">Helpers</Txt>
              <Txt v="body">{names(helpers)}</Txt>
            </View>
          </Card>
        </>
      )}

      {tab === "how" && (
        <Card style={{ gap: 12 }}>
          {exercise.instructions?.length ? (
            exercise.instructions.map((step, i) => (
              <Row key={i} gap={12} style={{ alignItems: "flex-start" }}>
                <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: p.well, alignItems: "center", justifyContent: "center" }}>
                  <Txt v="meta" color={p.accent}>
                    {i + 1}
                  </Txt>
                </View>
                <Txt v="bodySm" style={{ flex: 1 }}>
                  {step}
                </Txt>
              </Row>
            ))
          ) : (
            <Txt v="bodySm">{tipFor(exercise, te?.cue)}</Txt>
          )}
        </Card>
      )}

      {tab === "progress" &&
        (history.length === 0 ? (
          <EmptySlot>Your progress on this exercise shows up here once you’ve logged it.</EmptySlot>
        ) : (
          <>
            <StatBand
              stats={
                weighted
                  ? [
                      { label: "Est. 1RM", value: formatWeight(bests.e1rm, units) },
                      { label: "Heaviest", value: formatWeight(bests.maxWeight, units) },
                      { label: "Most reps", value: bests.maxReps },
                    ]
                  : [
                      { label: "Sessions", value: history.length },
                      { label: "Most reps", value: bests.maxReps },
                    ]
              }
            />
            {weighted && <TrendBars values={history.slice(-8).map((h) => ({ date: h.date, value: displayWeight(h.e1rm || h.topWeight, units) }))} unit={units} />}
            {myPrs.length > 0 && (
              <Card style={{ gap: 10 }}>
                <Row>
                  <Trophy color={p.warning} size={20} />
                  <Txt v="h3">Records</Txt>
                </Row>
                {myPrs.map((r) => (
                  <Row key={r.kind} style={{ justifyContent: "space-between" }}>
                    <Txt v="bodySm">{r.kind === "e1rm" ? "Est. 1RM" : r.kind === "max_weight" ? "Heaviest" : "Most reps"}</Txt>
                    <Txt v="label">
                      {r.kind === "max_reps" ? `${r.value} reps` : formatWeight(r.value, units)}
                      <Txt v="meta"> · {new Date(r.achievedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</Txt>
                    </Txt>
                  </Row>
                ))}
              </Card>
            )}
            <View>
              <SectionHeader title="Recent sessions" />
              <ListCard>
                {recent.map(({ session, sets: xs }, i) => {
                  const vol = history.find((h) => h.date === session.date)?.volume ?? 0;
                  return (
                    <Pressable
                      key={session.id}
                      onPress={() => router.push(`/session/${session.id}`)}
                      accessibilityRole="button"
                      style={({ pressed }) => ({
                        padding: 14,
                        gap: 4,
                        backgroundColor: pressed ? p.well : "transparent",
                        borderBottomWidth: i === recent.length - 1 ? 0 : 1,
                        borderBottomColor: p.border,
                      })}
                    >
                      <Row style={{ justifyContent: "space-between" }}>
                        <Txt v="h3" lines={1} style={{ flex: 1 }}>
                          {session.title}
                        </Txt>
                        <Txt v="meta">{new Date(session.startedAt).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}</Txt>
                      </Row>
                      <Txt v="bodySm">
                        {xs.map((x) => `${x.kind === "warmup" ? "W " : x.kind === "drop" ? "D " : x.kind === "failure" ? "F " : ""}${describeSet(x, type, units)}`).join("   ")}
                      </Txt>
                      {weighted && vol > 0 ? <Txt v="meta">{formatVolume(vol, units)} volume</Txt> : null}
                    </Pressable>
                  );
                })}
              </ListCard>
            </View>
          </>
        ))}
    </Screen>
  );
}

/** Estimated 1RM per logged session, latest lit. */
function TrendBars({ values, unit }: { values: { date: string; value: number }[]; unit: string }) {
  const p = usePalette();
  if (values.length < 2) return null;
  const max = Math.max(...values.map((v) => v.value), 1);
  const min = Math.min(...values.map((v) => v.value));
  const floor = Math.max(0, min - (max - min || max * 0.2));
  return (
    <Card style={{ gap: 10 }}>
      <Txt v="h3">Estimated 1RM</Txt>
      <Row gap={6} style={{ alignItems: "flex-end", height: 110 }}>
        {values.map((v, i) => (
          <View
            key={v.date + i}
            accessible
            accessibilityLabel={`${v.date}: ${v.value} ${unit}`}
            style={{
              flex: 1,
              height: 16 + ((v.value - floor) / (max - floor || 1)) * 90,
              borderRadius: 6,
              backgroundColor: i === values.length - 1 ? p.accentFill : p.well,
            }}
          />
        ))}
      </Row>
      <Txt v="meta">
        Last {values.length} sessions · latest {values[values.length - 1].value} {unit}
      </Txt>
    </Card>
  );
}
