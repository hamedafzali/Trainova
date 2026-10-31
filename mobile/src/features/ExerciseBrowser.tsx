// The web ExerciseBrowser for the app: search, muscle-group chips and a list,
// with recently used exercises on top when nothing is filtered. Creating
// custom exercises stays on the web for now.
import { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { Dumbbell } from "lucide-react-native";
import { MUSCLE_GROUPS, label, muscleGroupOf, type MuscleGroup } from "@/domain/taxonomy";
import { useStore } from "@/lib/store";
import type { Exercise } from "@/domain/types";
import { Chip, Field, ListCard, ListRow, Txt } from "~/ui/kit";

const LIMIT = 80;

export function ExerciseBrowser({ onSelect }: { onSelect: (exerciseId: string) => void }) {
  const exercises = useStore((s) => s.exercises);
  const devices = useStore((s) => s.devices);
  const sessions = useStore((s) => s.sessions);
  const sets = useStore((s) => s.sets);
  const recentExerciseIds = useStore((s) => s.recentExerciseIds);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const recentIds = useMemo(() => recentExerciseIds(6), [sessions, sets]);
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<MuscleGroup | "all">("all");

  const deviceName = useMemo(() => {
    const map = new Map(devices.map((d) => [d.id, d.name]));
    return (e: Exercise) => (e.defaultDeviceId ? map.get(e.defaultDeviceId) : undefined);
  }, [devices]);

  const needle = q.trim().toLowerCase();
  const filtered = useMemo(() => {
    const words = needle.split(/\s+/).filter(Boolean);
    return exercises
      .filter((e) => group === "all" || muscleGroupOf(e.primaryMuscle) === group)
      .filter((e) => {
        if (!words.length) return true;
        const hay = `${e.name} ${e.primaryMuscle ?? ""} ${(e.secondaryMuscles ?? []).join(" ")} ${deviceName(e) ?? ""}`.toLowerCase();
        return words.every((w) => hay.includes(w));
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [exercises, needle, group, deviceName]);

  const recents =
    needle || group !== "all" ? [] : (recentIds.map((id) => exercises.find((e) => e.id === id)).filter(Boolean) as Exercise[]);

  const meta = (e: Exercise) => [e.primaryMuscle ? label(e.primaryMuscle) : null, deviceName(e)].filter(Boolean).join(" · ");
  const list = (items: Exercise[]) => (
    <ListCard>
      {items.map((e, i) => (
        <ListRow key={e.id} icon={Dumbbell} title={e.name} meta={meta(e)} onPress={() => onSelect(e.id)} last={i === items.length - 1} />
      ))}
    </ListCard>
  );

  return (
    <View style={{ gap: 12 }}>
      <Field
        value={q}
        onChangeText={setQ}
        placeholder={`Search ${exercises.length} exercises…`}
        accessibilityLabel="Search exercises"
        autoCorrect={false}
        returnKeyType="search"
        clearButtonMode="while-editing"
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} keyboardShouldPersistTaps="handled">
        <Chip label="All" on={group === "all"} onPress={() => setGroup("all")} />
        {MUSCLE_GROUPS.map((g) => (
          <Chip key={g.key} label={g.label} on={group === g.key} onPress={() => setGroup(g.key)} />
        ))}
      </ScrollView>
      {recents.length > 0 ? (
        <View style={{ gap: 8 }}>
          <Txt v="eyebrow">Recent</Txt>
          {list(recents)}
          <Txt v="eyebrow" style={{ marginTop: 4 }}>
            All exercises
          </Txt>
        </View>
      ) : null}
      {filtered.length ? (
        list(filtered.slice(0, LIMIT))
      ) : (
        <Txt v="bodySm" style={{ textAlign: "center", paddingVertical: 20 }}>
          No exercise matches “{q.trim()}”.
        </Txt>
      )}
      {filtered.length > LIMIT ? (
        <Txt v="meta" style={{ textAlign: "center" }}>
          Showing {LIMIT} of {filtered.length}. Search to narrow it down.
        </Txt>
      ) : null}
    </View>
  );
}
