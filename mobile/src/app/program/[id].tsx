import { useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ChevronRight, Pencil, Play, Plus, Trash2, X } from "lucide-react-native";
import { recommendToday } from "@/domain/adaptive";
import { useStore } from "@/lib/store";
import { BackButton, Badge, Button, Card, EmptySlot, Field, IconButton, Row, Screen, Txt } from "~/ui/kit";
import { alpha, usePalette } from "~/ui/theme";

/** One program: its training days in rotation, each editable and startable. */
export default function ProgramScreen() {
  const p = usePalette();
  const { id } = useLocalSearchParams<{ id: string }>();
  const program = useStore((s) => s.programs.find((x) => x.id === id));
  const templates = useStore((s) => s.templates);
  const programs = useStore((s) => s.programs);
  const sessions = useStore((s) => s.sessions);
  const feedback = useStore((s) => s.feedback);
  const exerciseById = useStore((s) => s.exerciseById);
  const daysForProgram = useStore((s) => s.daysForProgram);
  const addDayToProgram = useStore((s) => s.addDayToProgram);
  const removeDayFromProgram = useStore((s) => s.removeDayFromProgram);
  const renameProgram = useStore((s) => s.renameProgram);
  const deleteProgram = useStore((s) => s.deleteProgram);
  const startSession = useStore((s) => s.startSession);
  const getActiveSession = useStore((s) => s.getActiveSession);
  const [renaming, setRenaming] = useState(false);

  if (!program)
    return (
      <Screen>
        <BackButton />
        <EmptySlot action={<Button label="Back to Plan" onPress={() => router.replace("/plan")} />}>This program may have been deleted.</EmptySlot>
      </Screen>
    );

  const start = (templateId: string) => {
    const { id: sid, blocked } = startSession(templateId);
    if (blocked) {
      const a = getActiveSession();
      if (a)
        Alert.alert("Workout in progress", `Finish or discard “${a.title}” before starting another.`, [
          { text: "Cancel", style: "cancel" },
          { text: "Open it", onPress: () => router.push(`/session/${a.id}`) },
        ]);
      return;
    }
    if (sid) router.push(`/session/${sid}`);
  };

  const confirmRemoveDay = (dayId: string, name: string) =>
    Alert.alert("Remove day?", `“${name}” will be removed from this program. Past workouts stay in History.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => removeDayFromProgram(program.id, dayId) },
    ]);

  const confirmDelete = () =>
    Alert.alert("Delete program?", "All of its days are deleted too. Past workouts stay in History.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          deleteProgram(program.id);
          if (router.canGoBack()) router.back();
          else router.replace("/plan");
        },
      },
    ]);

  const days = daysForProgram(program.id);
  const nextId = recommendToday({ templates, programs, sessions, feedback })?.templateId;

  return (
    <Screen>
      <BackButton label="Plan" />
      <View style={{ gap: 6, marginTop: -8 }}>
        {renaming ? (
          <Field
            accessibilityLabel="Program name"
            defaultValue={program.name}
            autoFocus
            maxLength={60}
            returnKeyType="done"
            onEndEditing={(e) => {
              const v = e.nativeEvent.text.trim();
              if (v && v !== program.name) renameProgram(program.id, v);
              setRenaming(false);
            }}
          />
        ) : (
          <Row style={{ alignItems: "flex-start" }}>
            <Txt v="title" style={{ flex: 1 }}>
              {program.name}
            </Txt>
            <IconButton icon={Pencil} label="Rename program" onPress={() => setRenaming(true)} />
          </Row>
        )}
        {program.source === "trainer" ? <Badge tone="accent">Trainer</Badge> : null}
        <Txt v="bodySm" color={p.muted}>
          {program.notes ??
            `${days.length} training day${days.length === 1 ? "" : "s"}, done in rotation — after the last day, start again from Day 1.`}
        </Txt>
      </View>

      {days.length === 0 ? (
        <EmptySlot>Add the first training day to start building this program.</EmptySlot>
      ) : (
        <View style={{ gap: 12 }}>
          {days.map((d, i) => {
            const isNext = d.id === nextId;
            const names = d.exercises.map((te) => exerciseById(te.exerciseId)?.name).filter(Boolean) as string[];
            return (
              <Card key={d.id} padded={false} style={[{ overflow: "hidden" }, isNext && { borderColor: alpha(p.accent, 0.5) }]}>
                <Pressable
                  onPress={() => router.push(`/template/${d.id}`)}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${d.name}${isNext ? ", up next" : ""}`}
                  style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, backgroundColor: pressed ? p.well : "transparent" })}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: isNext ? p.accentFill : p.well,
                    }}
                  >
                    <Txt v="label" color={isNext ? p.onAccent : p.inkSoft}>
                      {i + 1}
                    </Txt>
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Row gap={6}>
                      <Txt v="h3" lines={1} style={{ flexShrink: 1 }}>
                        {d.name}
                      </Txt>
                      {isNext ? <Badge tone="accent">Up next</Badge> : null}
                    </Row>
                    <Txt v="meta" lines={1}>
                      {names.length ? names.join(" · ") : "No exercises yet — tap to add"}
                    </Txt>
                  </View>
                  <ChevronRight color={p.muted} size={18} />
                </Pressable>
                <Row gap={0} style={{ borderTopWidth: 1, borderTopColor: p.border }}>
                  <Pressable
                    onPress={() => start(d.id)}
                    disabled={d.exercises.length === 0}
                    accessibilityRole="button"
                    accessibilityLabel={`Start ${d.name}`}
                    style={({ pressed }) => ({
                      flex: 1,
                      minHeight: 46,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      opacity: d.exercises.length === 0 ? 0.4 : 1,
                      backgroundColor: pressed ? p.well : "transparent",
                    })}
                  >
                    <Play color={p.accent} size={16} />
                    <Txt v="label" color={p.accent}>
                      Start
                    </Txt>
                  </Pressable>
                  <Pressable
                    onPress={() => confirmRemoveDay(d.id, d.name)}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${d.name}`}
                    style={({ pressed }) => ({
                      width: 56,
                      minHeight: 46,
                      alignItems: "center",
                      justifyContent: "center",
                      borderLeftWidth: 1,
                      borderLeftColor: p.border,
                      backgroundColor: pressed ? p.well : "transparent",
                    })}
                  >
                    <X color={p.muted} size={18} />
                  </Pressable>
                </Row>
              </Card>
            );
          })}
        </View>
      )}

      <Button
        variant="secondary"
        icon={Plus}
        label="Add day"
        onPress={() => router.push(`/template/${addDayToProgram(program.id, `Day ${days.length + 1}`)}`)}
      />
      <Button variant="ghost" icon={Trash2} label="Delete program" onPress={confirmDelete} />
    </Screen>
  );
}
