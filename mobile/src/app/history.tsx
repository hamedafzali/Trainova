import { useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Dumbbell, Trophy } from "lucide-react-native";
import { totalVolume } from "@/domain/volume";
import { useStore } from "@/lib/store";
import { formatVolume } from "@/lib/units";
import { Button, Chip, EmptySlot, ListCard, ListRow, PageHeader, Row, Screen, SectionHeader, StatBand } from "~/ui/kit";
import { usePalette } from "~/ui/theme";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Every logged workout, newest first, grouped by month. */
export default function HistoryScreen() {
  const p = usePalette();
  const { open } = useLocalSearchParams<{ open?: string }>();
  const units = useStore((s) => s.units);
  const sessions = useStore((s) => s.sessions);
  const sets = useStore((s) => s.sets);
  const prs = useStore((s) => s.prs);
  const exerciseById = useStore((s) => s.exerciseById);
  const [showArchived, setShowArchived] = useState(false);

  // Deep link from Today: land on History with that workout opened on top.
  const opened = useRef(false);
  useEffect(() => {
    if (open && !opened.current) {
      opened.current = true;
      router.push(`/session/${open}`);
    }
  }, [open]);

  const rows = useMemo(
    () =>
      sessions
        .filter((s) => (showArchived ? true : s.status !== "archived"))
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
        .map((s) => {
          const mine = sets.filter((x) => x.sessionId === s.id && x.completed);
          const exerciseIds = [...new Set(mine.map((x) => x.exerciseId))];
          const mins = s.completedAt
            ? Math.max(1, Math.round((+new Date(s.completedAt) - +new Date(s.startedAt)) / 60000))
            : null;
          return { session: s, count: mine.length, volume: totalVolume(mine), exerciseIds, mins };
        }),
    [sessions, sets, showArchived],
  );

  const groups = useMemo(() => {
    const out: { key: string; label: string; items: typeof rows }[] = [];
    for (const r of rows) {
      const d = new Date(r.session.startedAt);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      let g = out[out.length - 1];
      if (!g || g.key !== key) {
        g = { key, label: d.toLocaleDateString(undefined, { month: "long", year: "numeric" }), items: [] };
        out.push(g);
      }
      g.items.push(r);
    }
    return out;
  }, [rows]);

  // `prs` keeps the current best per exercise+kind, so this flags the
  // session where each still-standing record was set.
  const prDays = useMemo(() => new Set(prs.map((x) => x.achievedAt.slice(0, 10))), [prs]);

  const recent = (from: number, to: number) =>
    rows.filter((r) => {
      const age = Date.now() - +new Date(r.session.startedAt);
      return r.session.status !== "active" && age > from * DAY_MS && age <= to * DAY_MS;
    });
  const week = recent(-1, 7);
  const prevWeek = recent(7, 14);
  const weekVolume = week.reduce((sum, r) => sum + r.volume, 0);
  const prevWeekVolume = prevWeek.reduce((sum, r) => sum + r.volume, 0);
  const trend = prevWeekVolume > 0 ? Math.round(((weekVolume - prevWeekVolume) / prevWeekVolume) * 100) : null;
  const weekMinutes = week.reduce((sum, r) => sum + (r.mins ?? 0), 0);

  return (
    <Screen>
      <PageHeader back title="History" subtitle="Every workout you’ve logged." />
      {rows.length === 0 && !showArchived ? (
        <EmptySlot action={<Button label="Start a workout" onPress={() => router.replace("/workouts")} />}>
          Finish your first workout and it will show up here with your weekly trends.
        </EmptySlot>
      ) : (
        <>
          <StatBand
            stats={[
              { label: "Workouts", value: week.length, foot: "last 7 days" },
              {
                label: "Volume",
                value: formatVolume(weekVolume, units),
                foot: trend == null ? "last 7 days" : `${trend >= 0 ? "▲" : "▼"} ${Math.abs(trend)}% vs prior`,
                footColor: trend == null ? undefined : trend >= 5 ? p.success : trend <= -5 ? p.warning : undefined,
              },
              { label: "Time", value: weekMinutes, unit: "min", foot: "last 7 days" },
            ]}
          />
          <Row>
            <Chip label="Show archived" on={showArchived} onPress={() => setShowArchived((v) => !v)} />
          </Row>
          {groups.map((g) => (
            <View key={g.key}>
              <SectionHeader title={g.label} />
              <ListCard>
                {g.items.map(({ session, count, volume, exerciseIds, mins }, i) => {
                  const names = exerciseIds.map((id) => exerciseById(id)?.name).filter(Boolean) as string[];
                  const pr = prDays.has(session.startedAt.slice(0, 10)) && session.status !== "active";
                  const when = new Date(session.startedAt).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
                  const meta = [
                    when,
                    session.status === "active" ? "In progress" : session.status === "archived" ? "Archived" : null,
                    `${count} set${count === 1 ? "" : "s"}`,
                    volume > 0 ? formatVolume(volume, units) : null,
                    mins != null ? `${mins} min` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <ListRow
                      key={session.id}
                      icon={pr ? Trophy : Dumbbell}
                      tone={pr ? "accent" : "neutral"}
                      title={session.title}
                      meta={names.length ? `${meta}\n${names.slice(0, 4).join(", ")}${names.length > 4 ? "…" : ""}` : meta}
                      onPress={() => router.push(`/session/${session.id}`)}
                      last={i === g.items.length - 1}
                    />
                  );
                })}
              </ListCard>
            </View>
          ))}
        </>
      )}
    </Screen>
  );
}
