import { useMemo } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { Check, Dumbbell, Flame, Play, Plus } from "lucide-react-native";
import { recommendToday } from "@/domain/adaptive";
import { estimateDuration } from "@/domain/duration";
import { sessionMinutes } from "@/domain/periodStats";
import { activeSession } from "@/domain/session";
import { localDayKey, startOfWeek, weekDays, weekStreak } from "@/domain/streak";
import { label } from "@/domain/taxonomy";
import { calcSetVolume } from "@/domain/volume";
import { useStore } from "@/lib/store";
import { formatWeight, toDisplay } from "@/lib/units";
import type { Units } from "@/domain/types";
import { Button, Card, CoachCard, HeroCard, ListCard, ListRow, Row, Screen, SectionHeader, StatBand, Txt, type Stat } from "~/ui/kit";
import { alpha, font, usePalette, type Palette } from "~/ui/theme";
import { useStartWorkout } from "~/features/plan";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
/** Weeks of volume behind the sparkline, oldest first, this week last. */
const VOLUME_WEEKS = 6;

function greeting(h: number) {
  return h < 5 ? "Good evening" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

const fmt = (n: number) => Math.round(n).toLocaleString();
const shortDate = (k: string) => new Date(k + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

/** Home (src/app/page.tsx): today's workout, this week, key stats, the coach's note and recent workouts. */
export default function HomeTab() {
  const p = usePalette();
  const profile = useStore((s) => s.profile);
  const units = useStore((s) => s.units);
  const programs = useStore((s) => s.programs);
  const templates = useStore((s) => s.templates);
  const exercises = useStore((s) => s.exercises);
  const sessions = useStore((s) => s.sessions);
  const sets = useStore((s) => s.sets);
  const prs = useStore((s) => s.prs);
  const feedback = useStore((s) => s.feedback);
  const start = useStartWorkout();
  const startSession = useStore((s) => s.startSession);

  const today = new Date();
  const todayKey = localDayKey(today);
  const week = weekDays(today);

  const stats = useMemo(() => {
    const trained = new Set<string>();
    for (const s of sessions) if (s.status !== "archived") trained.add(s.date);
    const completed = sessions.filter((s) => s.status === "completed");
    const weekDone = new Set(completed.filter((s) => week.includes(s.date)).map((s) => s.date));

    // Working-set volume per week, this week last.
    const weekStart = +startOfWeek(today);
    const weekOf = new Map(completed.map((s) => [s.id, Math.floor((weekStart - +startOfWeek(new Date(s.date + "T00:00:00"))) / WEEK_MS + 0.5)]));
    const volume = new Array<number>(VOLUME_WEEKS).fill(0);
    const exercisesIn = new Map<string, Set<string>>();
    for (const x of sets) {
      if (!x.completed) continue;
      const ago = weekOf.get(x.sessionId);
      if (ago === undefined) continue;
      if (ago < VOLUME_WEEKS) volume[VOLUME_WEEKS - 1 - ago] += calcSetVolume(x);
      if (!exercisesIn.has(x.sessionId)) exercisesIn.set(x.sessionId, new Set());
      exercisesIn.get(x.sessionId)!.add(x.exerciseId);
    }

    const recent = [...completed]
      .sort((a, b) => (b.completedAt ?? b.date).localeCompare(a.completedAt ?? a.date))
      .slice(0, 3)
      .map((s) => ({ ...s, exerciseCount: exercisesIn.get(s.id)?.size ?? 0, minutes: sessionMinutes(s) }));

    return { trained, weekDone, volume, recent, streak: weekStreak(trained, today) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, sets, todayKey]);

  const active = activeSession(sessions);
  const startEmpty = () => {
    const { id, blocked } = startSession(null);
    if (blocked && active) router.push(`/session/${active.id}`);
    else if (id) router.push(`/session/${id}`);
  };

  const rec = recommendToday({ templates, programs, sessions, feedback });
  const next = rec ? templates.find((t) => t.id === rec.templateId) : undefined;
  const exerciseById = new Map(exercises.map((e) => [e.id, e]));
  const activeSets = active ? sets.filter((x) => x.sessionId === active.id) : [];
  const activeDone = activeSets.filter((x) => x.completed).length;
  const firstName = profile.displayName?.split(" ")[0];
  const muscles = next
    ? [...new Set(next.exercises.map((te) => exerciseById.get(te.exerciseId)?.primaryMuscle).filter(Boolean) as string[])].slice(0, 3).map(label)
    : [];
  const latestPr = [...prs].sort((a, b) => b.achievedAt.localeCompare(a.achievedAt))[0];
  const dim = "rgba(255,255,255,0.6)";

  return (
    <Screen contentStyle={{ gap: 18 }}>
      <Row gap={12}>
        <Pressable
          onPress={() => router.push("/profile")}
          accessibilityRole="button"
          accessibilityLabel="Profile"
          style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: p.border, backgroundColor: p.card, alignItems: "center", justifyContent: "center" }}
        >
          {firstName ? (
            <Txt v="label" color={p.accent}>
              {firstName.charAt(0).toUpperCase()}
            </Txt>
          ) : (
            <Dumbbell color={p.accent} size={16} />
          )}
        </Pressable>
        <Txt v="h2" lines={1} style={{ flex: 1 }}>
          {`${greeting(today.getHours())}${firstName ? `, ${firstName}` : ""}`}
        </Txt>
      </Row>

      {active ? (
        <HeroCard eyebrow="In progress" title={active.title} live>
          <Txt v="bodySm" color={dim} style={{ marginBottom: 18 }}>
            {activeSets.length > 0 ? `${activeDone} of ${activeSets.length} sets done` : "Started"}
          </Txt>
          <Button variant="volt" icon={Play} label="Resume workout" onPress={() => router.push(`/session/${active.id}`)} />
        </HeroCard>
      ) : next ? (
        <HeroCard eyebrow={stats.trained.has(todayKey) ? "Up next" : "Today's plan"} title={next.name}>
          <View style={{ gap: 4, marginBottom: 18 }}>
            <Txt v="bodySm" color={dim}>
              {`${next.exercises.length} exercise${next.exercises.length === 1 ? "" : "s"} · ${estimateDuration(next)} min`}
            </Txt>
            {muscles.length > 0 ? (
              <Txt v="bodySm" color={dim}>
                {muscles.join(" · ")}
              </Txt>
            ) : null}
            {rec?.mode === "recovery" ? (
              <Txt v="bodySm" color={p.volt}>
                {rec.headline}
              </Txt>
            ) : null}
          </View>
          <Button variant="volt" icon={Play} label="Start workout" disabled={next.exercises.length === 0} onPress={() => start(next.id)} />
        </HeroCard>
      ) : (
        <HeroCard eyebrow="Today's plan" title="Pick a plan to get started">
          <Txt v="bodySm" color={dim} style={{ marginBottom: 18 }}>
            Choose a ready-made program or start an empty workout.
          </Txt>
          <Row gap={8}>
            <Button variant="volt" label="Browse programs" onPress={() => router.push("/plan")} style={{ flex: 1 }} />
            <Button variant="glass" icon={Plus} label="Empty" onPress={startEmpty} />
          </Row>
        </HeroCard>
      )}

      <WeekStrip days={week} trained={stats.weekDone} today={todayKey} />

      <StatBand
        stats={[
          volumeStat(stats.volume, units, p),
          {
            label: "Streak",
            value: stats.streak,
            unit: stats.streak === 1 ? "week" : "weeks",
            extra: (
              <Row gap={4}>
                <Flame color={stats.streak > 0 ? p.flame : p.muted} fill={stats.streak > 0 ? p.flame : "none"} size={12} />
                <Txt v="meta" color={stats.streak > 0 ? p.flame : p.muted} style={{ fontSize: 11.5 }}>
                  {stats.streak > 0 ? "Keep it going" : "Train this week"}
                </Txt>
              </Row>
            ),
          },
          latestPr
            ? {
                label: "Recent PR",
                value: latestPr.kind === "max_reps" ? latestPr.value : formatWeight(latestPr.value, units, false),
                unit: latestPr.kind === "max_reps" ? "reps" : units,
                kicker: exerciseById.get(latestPr.exerciseId)?.name ?? "Exercise",
                foot: new Date(latestPr.achievedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
              }
            : { label: "Recent PR", value: "—", foot: "Log a set" },
        ]}
      />

      <CoachCard
        text={rec?.reason ?? "Add a program and your coach will plan each session and adapt it to how you train."}
        cta="Ask your coach"
        onPress={() => router.push("/coach")}
      />

      {stats.recent.length > 0 && (
        <View>
          <SectionHeader title="Recent workouts" action={{ label: "View all", onPress: () => router.push("/history") }} />
          <ListCard>
            {stats.recent.map((s, i) => (
              <ListRow
                key={s.id}
                icon={Dumbbell}
                title={s.title}
                meta={[shortDate(s.date), s.exerciseCount > 0 ? `${s.exerciseCount} exercise${s.exerciseCount === 1 ? "" : "s"}` : null, s.minutes > 0 ? `${s.minutes} min` : null]
                  .filter(Boolean)
                  .join(" · ")}
                onPress={() => router.push({ pathname: "/history", params: { open: s.id } })}
                trailing={<DoneTick />}
                last={i === stats.recent.length - 1}
              />
            ))}
          </ListCard>
        </View>
      )}
    </Screen>
  );
}

function DoneTick() {
  const p = usePalette();
  return (
    <View
      style={{
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: alpha(p.accent, 0.3),
        backgroundColor: alpha(p.accent, 0.1),
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Check color={p.accent} size={12} strokeWidth={3} />
    </View>
  );
}

/** This week Mon→Sun: weekday, a ring (ticked when trained), and the date; today underlined. */
function WeekStrip({ days, trained, today }: { days: string[]; trained: Set<string>; today: string }) {
  const p = usePalette();
  return (
    <Card style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 14 }}>
      {days.map((k) => {
        const d = new Date(k + "T00:00:00");
        const done = trained.has(k);
        const isToday = k === today;
        const past = k < today;
        return (
          <View
            key={k}
            accessible
            accessibilityLabel={`${d.toLocaleDateString(undefined, { weekday: "long" })}: ${done ? "trained" : "not trained"}`}
            style={{ alignItems: "center", gap: 8, opacity: past && !isToday ? 0.6 : 1 }}
          >
            <Txt v="eyebrow" color={isToday ? p.ink : p.muted} style={{ fontSize: 10 }}>
              {d.toLocaleDateString(undefined, { weekday: "short" })}
            </Txt>
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: isToday && !done ? 2 : 1,
                borderColor: done ? alpha(p.accent, 0.3) : isToday ? p.accent : p.border,
                backgroundColor: done ? alpha(p.accent, 0.1) : "transparent",
              }}
            >
              {done ? (
                <Check color={p.accent} size={12} strokeWidth={3} />
              ) : isToday ? (
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: p.accent }} />
              ) : null}
            </View>
            <Txt v="meta" color={isToday ? p.accent : p.muted} style={isToday ? { fontFamily: font.semibold } : undefined}>
              {String(d.getDate())}
            </Txt>
            {isToday ? <View style={{ position: "absolute", bottom: -14, width: 32, height: 2, borderRadius: 1, backgroundColor: p.accent }} /> : null}
          </View>
        );
      })}
    </Card>
  );
}

/** This week's working-set volume, a six-week sparkline, and the change against last week. */
function volumeStat(volume: number[], units: Units, p: Palette): Stat {
  const now = volume[volume.length - 1];
  const prev = volume[volume.length - 2];
  const max = Math.max(...volume, 1);
  const change = prev > 0 ? Math.round(((now - prev) / prev) * 100) : null;
  return {
    label: "Weekly volume",
    value: fmt(toDisplay(now, units)),
    unit: units,
    extra: (
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 3, height: 24, marginTop: 4 }}>
        {volume.map((v, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: `${Math.max(8, (v / max) * 100)}%`,
              borderTopLeftRadius: 2,
              borderTopRightRadius: 2,
              backgroundColor: i === volume.length - 1 ? p.accentFill : alpha(p.ink, 0.1),
            }}
          />
        ))}
      </View>
    ),
    foot: change == null ? "First week tracked" : `${change >= 0 ? "+" : ""}${change}% vs last week`,
    footColor: change == null ? p.muted : change >= 0 ? p.accent : p.warning,
  };
}
