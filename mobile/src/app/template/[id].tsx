import { useState } from "react";
import { Alert, Pressable, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, Info, Pencil, Play, Plus, Trash2 } from "lucide-react-native";
import { exerciseTypeOf, usesWeight } from "@/domain/exerciseType";
import type { ExerciseType } from "@/domain/taxonomy";
import type { TemplateExercise, TemplateSet, Units } from "@/domain/types";
import { useStore } from "@/lib/store";
import { displayWeight, formatWeight, fromDisplay, weightStep } from "@/lib/units";
import { ExerciseBrowser } from "~/features/ExerciseBrowser";
import { BackButton, Button, Card, EmptySlot, Field, IconButton, Row, Screen, Sheet, Stepper, Txt } from "~/ui/kit";
import { font, radius, usePalette } from "~/ui/theme";

/** Rough minutes for a plan: ~40 s per working set plus its rest. */
function estimateMinutes(exercises: TemplateExercise[]): number {
  let sec = 0;
  for (const te of exercises) sec += te.sets.length * (40 + te.restSeconds);
  return Math.max(5, Math.round(sec / 60 / 5) * 5);
}

function targetLabel(type: ExerciseType): { unit: string; label: string; step: number } {
  if (type === "duration") return { unit: "s", label: "Hold", step: 5 };
  if (type === "cardio") return { unit: "min", label: "Minutes", step: 1 };
  return { unit: "reps", label: "Reps", step: 1 };
}

function summarize(sets: TemplateSet[], type: ExerciseType, units: Units): string {
  if (sets.length === 0) return "No sets";
  const t = targetLabel(type);
  const reps = [...new Set(sets.map((s) => s.targetReps))];
  const repsText = reps.length === 1 ? `${reps[0]}${t.unit === "reps" ? "" : ` ${t.unit}`}` : reps.join("/");
  let text = `${sets.length} × ${repsText}`;
  if (usesWeight(type)) {
    const ws = [...new Set(sets.map((s) => s.targetWeight ?? 0))].filter((w) => w > 0);
    if (ws.length === 1) text += ` @ ${formatWeight(ws[0], units)}`;
    else if (ws.length > 1) text += ` @ ${formatWeight(Math.min(...ws), units, false)}–${formatWeight(Math.max(...ws), units)}`;
  }
  return text;
}

/** Edit one workout: its exercises, per-set targets and rest, then start it. */
export default function TemplateScreen() {
  const p = usePalette();
  const { id } = useLocalSearchParams<{ id: string }>();
  const template = useStore((s) => s.templates.find((t) => t.id === id));
  const updateTemplate = useStore((s) => s.updateTemplate);
  const deleteTemplate = useStore((s) => s.deleteTemplate);
  const addTemplateExercise = useStore((s) => s.addTemplateExercise);
  const startSession = useStore((s) => s.startSession);
  const getActiveSession = useStore((s) => s.getActiveSession);
  const [picking, setPicking] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  if (!template)
    return (
      <Screen>
        <BackButton />
        <EmptySlot action={<Button label="Back to workouts" onPress={() => router.replace("/workouts")} />}>
          This workout may have been deleted.
        </EmptySlot>
      </Screen>
    );

  const start = () => {
    const { id: sid, blocked } = startSession(template.id);
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

  const confirmDelete = () =>
    Alert.alert("Delete this workout?", "Your past sessions stay in History. This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          deleteTemplate(template.id);
          if (router.canGoBack()) router.back();
          else router.replace("/workouts");
        },
      },
    ]);

  const totalSets = template.exercises.reduce((n, te) => n + te.sets.length, 0);

  return (
    <Screen
      footer={
        template.exercises.length > 0 ? (
          <View style={{ padding: 16, paddingTop: 10, borderTopWidth: 1, borderTopColor: p.border, backgroundColor: p.bg }}>
            <Button variant="volt" icon={Play} label="Start workout" onPress={start} />
          </View>
        ) : null
      }
    >
      <BackButton />
      <View style={{ gap: 4, marginTop: -8 }}>
        {renaming ? (
          <Field
            accessibilityLabel="Workout name"
            defaultValue={template.name}
            autoFocus
            maxLength={60}
            returnKeyType="done"
            onEndEditing={(e) => {
              const v = e.nativeEvent.text.trim();
              if (v && v !== template.name) updateTemplate(template.id, { name: v });
              setRenaming(false);
            }}
          />
        ) : (
          <Row style={{ alignItems: "flex-start" }}>
            <Txt v="title" style={{ flex: 1 }}>
              {template.name}
            </Txt>
            <IconButton icon={Pencil} label="Rename workout" onPress={() => setRenaming(true)} />
          </Row>
        )}
        <Txt v="bodySm" color={p.muted}>
          {template.exercises.length} exercise{template.exercises.length === 1 ? "" : "s"} · {totalSets} sets
          {template.exercises.length > 0 ? ` · ~${estimateMinutes(template.exercises)} min` : ""}
        </Txt>
      </View>

      <TextInput
        accessibilityLabel="Workout notes"
        placeholder="Notes (warm-up, focus, equipment to grab)…"
        placeholderTextColor={p.muted}
        multiline
        maxLength={500}
        defaultValue={template.notes ?? ""}
        onEndEditing={(e) => {
          const v = e.nativeEvent.text.trim() || null;
          if (v !== template.notes) updateTemplate(template.id, { notes: v });
        }}
        style={{
          minHeight: 64,
          borderWidth: 1,
          borderColor: p.border,
          borderRadius: radius.control,
          backgroundColor: p.card,
          color: p.ink,
          fontFamily: font.regular,
          fontSize: 15,
          padding: 12,
          textAlignVertical: "top",
        }}
      />

      {template.exercises.length === 0 ? (
        <EmptySlot action={<Button icon={Plus} label="Add exercise" onPress={() => setPicking(true)} />}>
          Add the exercises for this workout. You can set sets, reps, weights and rest for each.
        </EmptySlot>
      ) : (
        <View style={{ gap: 12 }}>
          {template.exercises.map((te, idx) => (
            <ExerciseCard
              key={te.id}
              templateId={template.id}
              te={te}
              index={idx}
              count={template.exercises.length}
              open={openId === te.id}
              onToggle={() => setOpenId(openId === te.id ? null : te.id)}
            />
          ))}
          <Button variant="secondary" icon={Plus} label="Add exercise" onPress={() => setPicking(true)} />
        </View>
      )}

      <Button variant="ghost" icon={Trash2} label="Delete workout" onPress={confirmDelete} />

      <Sheet open={picking} onClose={() => setPicking(false)} title="Add exercise">
        <ExerciseBrowser
          onSelect={(exerciseId) => {
            addTemplateExercise(template.id, exerciseId);
            setPicking(false);
            const added = useStore.getState().templates.find((t) => t.id === template.id)?.exercises.at(-1);
            if (added) setOpenId(added.id);
          }}
        />
      </Sheet>
    </Screen>
  );
}

function ExerciseCard({
  templateId,
  te,
  index,
  count,
  open,
  onToggle,
}: {
  templateId: string;
  te: TemplateExercise;
  index: number;
  count: number;
  open: boolean;
  onToggle: () => void;
}) {
  const p = usePalette();
  const units = useStore((s) => s.units);
  const ex = useStore((s) => s.exerciseById(te.exerciseId));
  const device = useStore((s) => s.deviceById(te.deviceId ?? ex?.defaultDeviceId));
  const removeTemplateExercise = useStore((s) => s.removeTemplateExercise);
  const moveTemplateExercise = useStore((s) => s.moveTemplateExercise);
  const updateTemplateExercise = useStore((s) => s.updateTemplateExercise);
  const setTemplateSetCount = useStore((s) => s.setTemplateSetCount);
  const updateTemplateSet = useStore((s) => s.updateTemplateSet);
  const type = exerciseTypeOf(ex, device);
  const t = targetLabel(type);
  const weighted = usesWeight(type);
  const name = ex?.name ?? "Exercise";

  const confirmRemove = () =>
    Alert.alert("Remove exercise?", `${name} will be removed from this workout. Logged history is kept.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => removeTemplateExercise(templateId, te.id) },
    ]);

  return (
    <Card padded={false} style={{ overflow: "hidden" }}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${name}, ${summarize(te.sets, type, units)}, rest ${te.restSeconds} seconds`}
        style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, backgroundColor: pressed ? p.well : "transparent" })}
      >
        <View style={{ width: 36, height: 36, borderRadius: radius.control, backgroundColor: p.well, alignItems: "center", justifyContent: "center" }}>
          <Txt v="label" color={p.inkSoft}>
            {index + 1}
          </Txt>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt v="h3" lines={1}>
            {name}
          </Txt>
          <Txt v="meta" lines={1}>
            {summarize(te.sets, type, units)} · rest {te.restSeconds}s
          </Txt>
        </View>
        {open ? <ChevronUp color={p.muted} size={20} /> : <ChevronDown color={p.muted} size={20} />}
      </Pressable>

      {open && (
        <View style={{ gap: 14, padding: 14, borderTopWidth: 1, borderTopColor: p.border, backgroundColor: p.well }}>
          {te.sets.map((st, i) => (
            <View key={i} style={{ gap: 8 }}>
              <Txt v="eyebrow">Set {i + 1}</Txt>
              <Row gap={10} style={{ alignItems: "flex-start" }}>
                <View style={{ flex: 1 }}>
                  <Stepper
                    label={t.unit === "reps" ? t.label : `${t.label} (${t.unit})`}
                    value={st.targetReps}
                    step={t.step}
                    min={1}
                    decimals={0}
                    onChange={(v) => updateTemplateSet(templateId, te.id, i, { targetReps: Math.max(1, v) })}
                  />
                </View>
                {weighted && (
                  <View style={{ flex: 1 }}>
                    <Stepper
                      label={`Weight (${units})`}
                      value={displayWeight(st.targetWeight ?? 0, units)}
                      step={weightStep(units)}
                      onChange={(v) => updateTemplateSet(templateId, te.id, i, { targetWeight: v ? fromDisplay(v, units) : null })}
                    />
                  </View>
                )}
              </Row>
            </View>
          ))}
          <Row>
            <Button
              small
              variant="secondary"
              label="Remove set"
              disabled={te.sets.length <= 1}
              onPress={() => setTemplateSetCount(templateId, te.id, te.sets.length - 1)}
              style={{ flex: 1 }}
            />
            <Button
              small
              variant="secondary"
              icon={Plus}
              label="Add set"
              disabled={te.sets.length >= 12}
              onPress={() => setTemplateSetCount(templateId, te.id, te.sets.length + 1)}
              style={{ flex: 1 }}
            />
          </Row>
          <Stepper
            label="Rest between sets (s)"
            value={te.restSeconds}
            step={15}
            min={0}
            decimals={0}
            onChange={(v) => updateTemplateExercise(templateId, te.id, { restSeconds: Math.min(600, v) })}
          />
          {type === "weight_reps" && te.sets.length > 0 && (
            <Stepper
              label="Rep range top (for progression)"
              value={te.repMax ?? te.sets[0].targetReps}
              step={1}
              min={te.sets[0].targetReps}
              decimals={0}
              onChange={(v) => updateTemplateExercise(templateId, te.id, { repMax: v > te.sets[0].targetReps ? v : null })}
            />
          )}
          <Field
            label="Cue / note"
            placeholder="e.g. Seat on 4, slow negatives"
            maxLength={120}
            defaultValue={te.cue ?? ""}
            onEndEditing={(e) => {
              const v = e.nativeEvent.text.trim() || null;
              if (v !== (te.cue ?? null)) updateTemplateExercise(templateId, te.id, { cue: v });
            }}
          />
          <Row>
            <IconButton icon={ArrowUp} label="Move up" disabled={index === 0} onPress={() => moveTemplateExercise(templateId, te.id, -1)} />
            <IconButton icon={ArrowDown} label="Move down" disabled={index === count - 1} onPress={() => moveTemplateExercise(templateId, te.id, 1)} />
            <IconButton icon={Info} label={`About ${name}`} onPress={() => router.push(`/exercises/${te.exerciseId}`)} />
            <View style={{ flex: 1 }} />
            <Button small variant="danger" icon={Trash2} label="Remove" onPress={confirmRemove} />
          </Row>
        </View>
      )}
    </Card>
  );
}
