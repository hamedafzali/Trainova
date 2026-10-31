// The web SessionExercise for the app: the logging card for one exercise in a
// workout. Completed sets collapse to rows; the current set opens into big
// steppers that match how the exercise is logged. Weights are stored in kg and
// converted at this boundary, exactly as on the web.
import { useMemo, useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import { Check, ChevronDown, Info, PersonStanding, Plus, TrendingUp, X } from "lucide-react-native";
import { barWeight, loadPlates } from "@/domain/plates";
import { suggestNextLoad, type LastPerformance } from "@/domain/progression";
import { exerciseTypeOf, usesReps, usesWeight } from "@/domain/exerciseType";
import { SET_KINDS, label, type ExerciseType, type SetKind } from "@/domain/taxonomy";
import { showsRpe } from "@/domain/coachingProfile";
import { useStore } from "@/lib/store";
import { useRestTimer, defaultRest } from "@/lib/restTimer";
import { formatWeight, fromDisplay, toDisplay, weightStep } from "@/lib/units";
import { haptic } from "@/lib/haptics";
import type { Device, Units, WorkoutSet } from "@/domain/types";
import { Badge, Button, Card, Chip, Row, Segmented, Stepper, Txt } from "~/ui/kit";
import { alpha, font, radius, usePalette } from "~/ui/theme";
import { GuideView } from "./GuideView";

const WARMUP_REST = 60;
const KIND_OPTIONS = SET_KINDS.map((k) => ({
  key: k.key,
  label: k.key === "normal" ? "Working" : k.key === "warmup" ? "Warm-up" : k.key === "drop" ? "Drop" : "Failure",
}));

const stepperValue = (kg: number, units: Units) => Math.round(toDisplay(kg, units) * 100) / 100;

function weightLabel(type: ExerciseType): string {
  if (type === "assisted_bodyweight") return "Assistance";
  if (type === "weighted_bodyweight") return "Added weight";
  return "Weight";
}

/** One-line summary of a set's numbers, e.g. "60 kg × 8" or "BW + 10 kg × 6". */
export function describeSet(s: WorkoutSet, type: ExerciseType, units: Units): string {
  if (type === "duration") return `${s.durationSec ?? "–"} s`;
  if (type === "cardio") {
    const parts = [`${s.durationMin ?? "–"} min`];
    if (s.speed) parts.push(`${s.speed} spd`);
    if (s.incline) parts.push(`${s.incline}% incl.`);
    if (s.distance) parts.push(`${s.distance} km`);
    return parts.join(" · ");
  }
  const w = s.actualWeight;
  const r = s.actualReps;
  const reps = r != null ? ` × ${r}` : "";
  if (type === "bodyweight_reps") return `${r ?? "–"} reps`;
  if (type === "weighted_bodyweight") return w ? `BW + ${formatWeight(w, units)}${reps}` : `BW${reps}`;
  if (type === "assisted_bodyweight") return `${formatWeight(w, units)} assist${reps}`;
  return `${formatWeight(w, units)}${reps}`;
}

export function SessionExercise({
  sessionId,
  exerciseId,
  sets,
  readOnly = false,
  editable = false,
  onPr,
}: {
  sessionId: string;
  exerciseId: string;
  sets: WorkoutSet[];
  readOnly?: boolean;
  editable?: boolean;
  onPr: (kinds: string[]) => void;
}) {
  const p = usePalette();
  const units = useStore((s) => s.units);
  const rpeOn = useStore((s) => showsRpe(s.profile.coaching));
  const exerciseById = useStore((s) => s.exerciseById);
  const deviceById = useStore((s) => s.deviceById);
  const addSet = useStore((s) => s.addSet);
  const updateSet = useStore((s) => s.updateSet);
  const removeSet = useStore((s) => s.removeSet);
  const completeSet = useStore((s) => s.completeSet);
  const editSet = useStore((s) => s.editSet);
  const revertSet = useStore((s) => s.revertSet);
  const setExerciseDevice = useStore((s) => s.setExerciseDevice);
  const moveSet = useStore((s) => s.moveSet);
  const devices = useStore((s) => s.devices);
  const siblings = useStore((s) => {
    const ids: string[] = [];
    for (const x of s.sets) if (x.sessionId === sessionId && x.exerciseId !== exerciseId && !ids.includes(x.exerciseId)) ids.push(x.exerciseId);
    return ids.join(",");
  });
  const lastPerformance = useStore((s) => s.lastPerformance);
  const missStreak = useStore((s) => s.missStreak);
  const templateExercise = useStore((s) => {
    const session = s.sessions.find((x) => x.id === sessionId);
    const tpl = session?.templateId ? s.templates.find((t) => t.id === session.templateId) : undefined;
    return tpl?.exercises.find((te) => te.exerciseId === exerciseId);
  });
  const startRest = useRestTimer((s) => s.start);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [show3d, setShow3d] = useState(false);

  const ex = exerciseById(exerciseId);
  const device = deviceById(sets[0]?.deviceId ?? ex?.defaultDeviceId ?? undefined);
  const type = exerciseTypeOf(ex, device);
  const isCompound = ex?.isCompound ?? false;
  const weighted = usesWeight(type);
  const counted = usesReps(type);
  const bar = type === "weight_reps" ? barWeight(ex?.equipment, units) : null;
  const rest = templateExercise?.restSeconds ?? defaultRest(isCompound);

  const last = useMemo(
    () => lastPerformance(exerciseId, sessionId),
    // History doesn't change while this card is on screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [exerciseId, sessionId],
  );

  const targetReps = templateExercise?.sets[0]?.targetReps ?? last?.targetReps ?? (isCompound ? 8 : 12);

  const suggestion = useMemo(() => {
    if (!weighted || type === "assisted_bodyweight" || !last) return null;
    if (!last.sets.some((s) => (s.actualWeight ?? 0) > 0)) return null;
    const inDisplay = {
      targetReps,
      sets: last.sets.map((s) => ({ ...s, actualWeight: s.actualWeight == null ? null : toDisplay(s.actualWeight, units) })),
    };
    const repMax = templateExercise?.repMax;
    return suggestNextLoad(inDisplay, units, {
      isCompound,
      missStreak: missStreak(exerciseId, targetReps),
      repRange: repMax && repMax > targetReps ? { min: targetReps, max: repMax } : null,
      loading: device?.loading === "stack" ? "stack" : ex?.equipment === "dumbbell" || ex?.equipment === "kettlebell" ? "dumbbell" : "plates",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [last, units, weighted, type, targetReps, isCompound, exerciseId, device?.loading, templateExercise?.repMax]);

  const done = sets.filter((s) => s.completed);
  const activeSet = readOnly ? undefined : sets.find((s) => !s.completed);
  const lastDone = done[done.length - 1];
  const lastWorking = [...done].reverse().find((s) => s.kind !== "warmup") ?? lastDone;
  const lastTime = (s: WorkoutSet) => last?.sets[s.setIndex] ?? last?.sets[last.sets.length - 1];

  // Starting values: what's typed → what you just did → last time → the plan.
  const startWeight = (s: WorkoutSet) => s.actualWeight ?? lastWorking?.actualWeight ?? lastTime(s)?.actualWeight ?? s.targetWeight ?? 0;
  const startReps = (s: WorkoutSet) => s.actualReps ?? lastWorking?.actualReps ?? lastTime(s)?.actualReps ?? s.targetReps ?? targetReps;
  const startHold = (s: WorkoutSet) => s.durationSec ?? s.targetReps ?? lastDone?.durationSec ?? 30;
  const startMinutes = (s: WorkoutSet) => s.durationMin ?? lastDone?.durationMin ?? s.targetReps ?? 20;
  const startSpeed = (s: WorkoutSet) => s.speed ?? lastDone?.speed ?? 0;
  const startIncline = (s: WorkoutSet) => s.incline ?? lastDone?.incline ?? 0;
  const startDistance = (s: WorkoutSet) => s.distance ?? lastDone?.distance ?? 0;

  const complete = (s: WorkoutSet) => {
    if (type === "duration") {
      updateSet(s.id, { durationSec: startHold(s) });
    } else if (type === "cardio") {
      const dist = startDistance(s);
      updateSet(s.id, {
        durationMin: startMinutes(s),
        speed: startSpeed(s) || null,
        incline: startIncline(s) || null,
        distance: dist > 0 ? dist : null,
      });
    } else {
      const reps = startReps(s);
      updateSet(s.id, { actualWeight: weighted ? startWeight(s) : null, actualReps: reps > 0 ? reps : null });
    }
    const { newPrs } = completeSet(s.id);
    if (type !== "cardio") startRest(s.kind === "warmup" ? WARMUP_REST : rest);
    if (newPrs.length) {
      haptic("pr");
      onPr(newPrs);
    } else {
      haptic("tick");
    }
  };

  const applySuggestion = () => {
    if (!suggestion) return;
    const kg = fromDisplay(suggestion.weight, units);
    for (const s of sets) if (!s.completed && s.kind !== "warmup") updateSet(s.id, { actualWeight: kg, actualReps: suggestion.reps });
    haptic("tick");
  };

  let working = 0;
  const numbers = new Map<string, string>();
  for (const s of sets) {
    const kind = SET_KINDS.find((k) => k.key === (s.kind ?? "normal"));
    numbers.set(s.id, kind?.short ? kind.short : String(++working));
  }

  const deviceChoices = device
    ? devices
        .filter((d) => d.category === device.category)
        .sort(
          (a, b) =>
            Number(b.primaryMuscle === device.primaryMuscle) - Number(a.primaryMuscle === device.primaryMuscle) || a.name.localeCompare(b.name),
        )
    : [];
  const siblingList = (siblings ? siblings.split(",") : []).map((id) => ({ id, name: exerciseById(id)?.name ?? "Exercise" }));

  const muscles = [ex?.primaryMuscle, ...(ex?.secondaryMuscles ?? [])].filter(Boolean) as string[];
  const steps = ex?.instructions ?? [];
  const cue = templateExercise?.cue ?? null;

  const columns =
    type === "duration"
      ? ["Sec"]
      : type === "cardio"
        ? ["Min"]
        : weighted && counted
          ? [type === "assisted_bodyweight" ? "Assist" : type === "weighted_bodyweight" ? `+${units}` : units, "Reps"]
          : ["Reps"];
  const w = (kg: number | null | undefined) => (kg == null ? "–" : String(stepperValue(kg, units)));

  const shortSet = (x: LastPerformance["sets"][number] | undefined): string => {
    if (!x) return "–";
    if (type === "duration") return `${x.durationSec ?? "–"} s`;
    if (type === "cardio") return `${x.durationMin ?? "–"} min`;
    if (weighted && counted) return `${w(x.actualWeight)} × ${x.actualReps ?? "–"}`;
    return `${x.actualReps ?? "–"} reps`;
  };
  const previous = (s: WorkoutSet) => shortSet(last?.sets[s.setIndex]);

  const values = (s: WorkoutSet): string[] => {
    if (type === "duration") return [String(s.completed ? (s.durationSec ?? "–") : startHold(s))];
    if (type === "cardio") return [String(s.completed ? (s.durationMin ?? "–") : startMinutes(s))];
    const reps = String(s.completed ? (s.actualReps ?? "–") : startReps(s));
    return weighted && counted ? [s.completed ? w(s.actualWeight) : w(startWeight(s)), reps] : [reps];
  };

  const tagColors = (kind: SetKind, active: boolean) =>
    active
      ? [p.accentFill, p.onAccent]
      : kind === "warmup"
        ? [alpha(p.warning, 0.16), p.warning]
        : kind === "drop" || kind === "failure"
          ? [alpha(p.error, 0.12), p.error]
          : [p.card, p.inkSoft];

  const rowCells = (s: WorkoutSet, tag: string, kind: SetKind, active: boolean) => {
    const [tagBg, tagFg] = tagColors(kind, active);
    return (
      <Row gap={8}>
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: tagBg,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: s.editedAt ? 2 : 0,
            borderColor: alpha(p.warning, 0.6),
          }}
        >
          <Txt v="meta" color={tagFg} style={{ fontFamily: font.bold }}>
            {tag}
          </Txt>
        </View>
        <Txt v="bodySm" color={p.muted} lines={1} style={{ flex: 1, fontVariant: ["tabular-nums"] }}>
          {previous(s)}
        </Txt>
        {values(s).map((v, i) => (
          <Txt
            key={i}
            v="h3"
            color={active ? p.accent : s.completed ? p.ink : p.muted}
            style={{ width: columns.length === 2 && i === 0 ? 64 : 52, textAlign: "center", fontVariant: ["tabular-nums"] }}
          >
            {v}
            {i === columns.length - 1 && s.completed && s.rpe != null ? (
              <Txt v="meta" style={{ fontSize: 10 }}>
                @{s.rpe}
              </Txt>
            ) : null}
          </Txt>
        ))}
        <View style={{ width: 44, alignItems: "flex-end" }}>
          {s.completed && !readOnly ? (
            <Pressable
              onPress={() => updateSet(s.id, { completed: false, completedAt: null })}
              accessibilityRole="button"
              accessibilityLabel={`Undo set ${tag}`}
              hitSlop={8}
              style={{ width: 44, height: 44, alignItems: "flex-end", justifyContent: "center" }}
            >
              <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: p.success, alignItems: "center", justifyContent: "center" }}>
                <Check color="#FFFFFF" size={16} strokeWidth={3} />
              </View>
            </Pressable>
          ) : s.completed ? (
            <Check color={p.success} size={16} strokeWidth={3} accessibilityLabel="Done" />
          ) : !readOnly && !active ? (
            <Pressable
              onPress={() => removeSet(s.id)}
              accessibilityRole="button"
              accessibilityLabel={`Delete set ${tag}`}
              style={{ width: 44, height: 44, alignItems: "flex-end", justifyContent: "center" }}
            >
              <X color={p.muted} size={16} />
            </Pressable>
          ) : null}
        </View>
      </Row>
    );
  };

  return (
    <Card style={{ gap: 14 }}>
      <Row gap={10} style={{ alignItems: "flex-start" }}>
        <View style={{ flex: 1 }}>
          <Txt v="h2">{ex?.name ?? "Exercise"}</Txt>
          <Txt v="meta" style={{ marginTop: 2 }}>
            {device ? `${device.name}${device.machineNumber ? ` · No. ${device.machineNumber}` : ""}` : label(type)} · {done.length}/{sets.length} sets
          </Txt>
        </View>
        {ex ? <ToggleIcon on={show3d} onPress={() => setShow3d((v) => !v)} label="Show the 3D movement guide" icon={<PersonStanding color={show3d ? p.accent : p.inkSoft} size={20} />} /> : null}
        {steps.length > 0 || muscles.length > 0 || device?.guidance ? (
          <ToggleIcon on={showInfo} onPress={() => setShowInfo((v) => !v)} label="How to do this exercise" icon={<Info color={showInfo ? p.accent : p.inkSoft} size={20} />} />
        ) : null}
      </Row>

      {show3d && ex ? <GuideView exercise={ex} /> : null}

      {showInfo ? (
        <View style={{ gap: 10, backgroundColor: p.well, borderRadius: radius.control, padding: 14 }}>
          {muscles.length ? (
            <Row gap={6} style={{ flexWrap: "wrap" }}>
              {muscles.map((m, i) => (
                <Badge key={m} tone={i === 0 ? "accent" : "neutral"}>
                  {label(m)}
                </Badge>
              ))}
            </Row>
          ) : null}
          {steps.map((st, i) => (
            <Txt key={st} v="bodySm">
              {i + 1}. {st}
            </Txt>
          ))}
          {device?.guidance ? <Txt v="meta">{device.guidance}</Txt> : null}
        </View>
      ) : null}

      {cue ? (
        <View style={{ backgroundColor: p.well, borderRadius: radius.control, paddingHorizontal: 12, paddingVertical: 8 }}>
          <Txt v="bodySm">“{cue}”</Txt>
        </View>
      ) : null}

      {!readOnly && suggestion && suggestion.action !== "start" ? (
        <Pressable
          onPress={applySuggestion}
          accessibilityRole="button"
          accessibilityHint={suggestion.reason}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            alignSelf: "flex-start",
            borderRadius: 999,
            paddingHorizontal: 12,
            minHeight: 36,
            backgroundColor:
              suggestion.action === "increase" || suggestion.action === "add_reps"
                ? alpha(p.success, 0.14)
                : suggestion.action === "deload"
                  ? alpha(p.warning, 0.14)
                  : p.well,
          }}
        >
          <TrendingUp
            size={14}
            color={suggestion.action === "increase" || suggestion.action === "add_reps" ? p.success : suggestion.action === "deload" ? p.warning : p.inkSoft}
          />
          <Txt v="label" style={{ fontSize: 13 }}>
            {suggestion.action === "increase" ? "Try" : suggestion.action === "deload" ? "Deload to" : "Repeat"} {suggestion.weight} {units}
            {suggestion.action === "add_reps" ? ` × ${suggestion.reps}` : ""}? <Txt v="label" color={p.accent} style={{ fontSize: 13, textDecorationLine: "underline" }}>Apply</Txt>
          </Txt>
        </Pressable>
      ) : null}

      {last && last.sets.length > 0 ? (
        <Row gap={6} style={{ flexWrap: "wrap" }}>
          <Txt v="eyebrow" style={{ fontSize: 10.5 }}>
            Last time
          </Txt>
          {last.sets.map((x, i) => (
            <View key={i} style={{ backgroundColor: p.well, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
              <Txt v="meta" color={p.inkSoft}>
                {shortSet(x)}
              </Txt>
            </View>
          ))}
        </Row>
      ) : null}

      <View style={{ gap: 6 }}>
        <Row gap={8} style={{ paddingHorizontal: 10 }}>
          <Txt v="eyebrow" style={{ width: 28, textAlign: "center", fontSize: 10.5 }}>
            Set
          </Txt>
          <Txt v="eyebrow" style={{ flex: 1, fontSize: 10.5 }}>
            Previous
          </Txt>
          {columns.map((c, i) => (
            <Txt key={c} v="eyebrow" style={{ width: columns.length === 2 && i === 0 ? 64 : 52, textAlign: "center", fontSize: 10.5 }}>
              {c}
            </Txt>
          ))}
          <View style={{ width: 44 }} />
        </Row>

        {sets.map((s) => {
          const tag = numbers.get(s.id) ?? "";
          const kind: SetKind = s.kind ?? "normal";

          if (s === activeSet) {
            return (
              <View
                key={s.id}
                style={{ gap: 16, borderRadius: radius.card, borderWidth: 1, borderColor: alpha(p.accent, 0.4), backgroundColor: alpha(p.accent, 0.06), paddingHorizontal: 10, paddingTop: 8, paddingBottom: 14 }}
              >
                <View style={{ gap: 2 }}>
                  {rowCells(s, tag, kind, true)}
                  <Row style={{ justifyContent: "space-between" }}>
                    <Txt v="meta">
                      {kind === "normal" ? "Working set" : SET_KINDS.find((k) => k.key === kind)?.label}
                      {s.targetReps != null && counted ? ` · target ${s.targetReps} reps` : ""}
                    </Txt>
                    <Pressable onPress={() => removeSet(s.id)} accessibilityRole="button" style={{ flexDirection: "row", alignItems: "center", gap: 4, minHeight: 44, paddingHorizontal: 8 }}>
                      <X color={p.muted} size={14} />
                      <Txt v="meta">Remove</Txt>
                    </Pressable>
                  </Row>
                </View>

                {counted ? (
                  <Segmented label="Set type" options={KIND_OPTIONS} value={kind} onChange={(k) => updateSet(s.id, { kind: k === "normal" ? undefined : k })} />
                ) : null}

                {type === "duration" ? (
                  <Stepper label="Duration" value={startHold(s)} step={5} min={5} unit="sec" onChange={(v) => updateSet(s.id, { durationSec: v })} />
                ) : null}

                {type === "cardio" ? (
                  <>
                    <Stepper label="Time" value={startMinutes(s)} step={1} min={1} unit="min" onChange={(v) => updateSet(s.id, { durationMin: v })} />
                    <Stepper label="Speed" value={startSpeed(s)} step={0.5} unit="km/h" onChange={(v) => updateSet(s.id, { speed: v })} />
                    <Stepper label="Incline / level" value={startIncline(s)} step={0.5} unit="%" onChange={(v) => updateSet(s.id, { incline: v })} />
                    <Stepper label="Distance" value={startDistance(s)} step={0.1} unit="km" onChange={(v) => updateSet(s.id, { distance: v })} />
                  </>
                ) : null}

                {weighted ? (
                  <View style={{ gap: 8 }}>
                    <Stepper
                      label={weightLabel(type)}
                      value={stepperValue(startWeight(s), units)}
                      step={weightStep(units)}
                      unit={units}
                      onChange={(v) => updateSet(s.id, { actualWeight: fromDisplay(v, units) })}
                    />
                    {bar != null ? <PlateLine total={stepperValue(startWeight(s), units)} bar={bar} units={units} /> : null}
                  </View>
                ) : null}

                {counted ? <Stepper label="Reps" value={startReps(s)} step={1} min={0} unit="reps" decimals={0} onChange={(v) => updateSet(s.id, { actualReps: v })} /> : null}

                {counted && kind !== "warmup" && rpeOn ? (
                  <View style={{ gap: 6 }}>
                    <Row style={{ justifyContent: "space-between" }}>
                      <Txt v="eyebrow">Effort (RPE)</Txt>
                      <Txt v="meta" style={{ fontSize: 11 }}>
                        Optional · 10 = nothing left
                      </Txt>
                    </Row>
                    <Row gap={6}>
                      {[6, 7, 8, 9, 10].map((rpe) => {
                        const on = s.rpe === rpe;
                        return (
                          <Pressable
                            key={rpe}
                            onPress={() => updateSet(s.id, { rpe: on ? null : rpe })}
                            accessibilityRole="button"
                            accessibilityState={{ selected: on }}
                            accessibilityLabel={`RPE ${rpe}`}
                            style={{ flex: 1, minHeight: 44, borderRadius: radius.control, alignItems: "center", justifyContent: "center", backgroundColor: on ? p.accentFill : p.well }}
                          >
                            <Txt v="label" color={on ? p.onAccent : p.inkSoft}>
                              {rpe}
                            </Txt>
                          </Pressable>
                        );
                      })}
                    </Row>
                  </View>
                ) : null}

                <Button
                  variant="volt"
                  icon={Check}
                  label={type === "cardio" ? "Log cardio" : type === "duration" ? "Log hold" : "Complete set"}
                  onPress={() => complete(s)}
                />
              </View>
            );
          }

          if (editable && editingId === s.id && s.completed) {
            return (
              <EditSetRow
                key={s.id}
                set={s}
                tag={tag}
                weighted={weighted}
                counted={counted}
                units={units}
                device={device?.id ?? null}
                devices={deviceChoices}
                exercises={siblingList}
                onCancel={() => setEditingId(null)}
                onRevert={() => {
                  revertSet(s.id);
                  setEditingId(null);
                }}
                onDelete={() => {
                  removeSet(s.id);
                  setEditingId(null);
                }}
                onSave={({ kg, reps, deviceId, moveTo }) => {
                  if (counted) editSet(s.id, { actualWeight: weighted ? kg : null, actualReps: reps > 0 ? reps : null });
                  if (deviceId !== (device?.id ?? null)) setExerciseDevice(sessionId, exerciseId, deviceId);
                  if (moveTo) moveSet(s.id, moveTo);
                  setEditingId(null);
                }}
              />
            );
          }

          const canEdit = editable && s.completed;
          return (
            <Pressable
              key={s.id}
              disabled={!canEdit}
              onPress={() => setEditingId(s.id)}
              accessibilityRole={canEdit ? "button" : undefined}
              accessibilityLabel={canEdit ? `Fix set ${tag}: ${describeSet(s, type, units)}` : undefined}
              style={{ borderRadius: radius.control, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: s.completed ? alpha(p.success, 0.1) : p.well }}
            >
              {rowCells(s, tag, kind, false)}
            </Pressable>
          );
        })}
      </View>

      {!readOnly ? (
        <Pressable
          onPress={() => addSet(sessionId, exerciseId)}
          accessibilityRole="button"
          style={{ flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", minHeight: 48, borderRadius: radius.control, borderWidth: 1, borderStyle: "dashed", borderColor: p.border }}
        >
          <Plus color={p.accent} size={16} />
          <Txt v="label" color={p.accent}>
            Add set
          </Txt>
        </Pressable>
      ) : null}
      {editable && done.length > 0 ? (
        <Row gap={4} style={{ justifyContent: "center" }}>
          <ChevronDown color={p.muted} size={14} />
          <Txt v="meta">Tap a logged set to fix it</Txt>
        </Row>
      ) : null}
    </Card>
  );
}

function ToggleIcon({ on, onPress, label: a11y, icon }: { on: boolean; onPress: () => void; label: string; icon: ReactNode }) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ expanded: on }}
      style={{ width: 44, height: 44, borderRadius: radius.control, alignItems: "center", justifyContent: "center", backgroundColor: on ? alpha(p.accent, 0.14) : p.well }}
    >
      {icon}
    </Pressable>
  );
}

/** Plates per side for a bar exercise, as one line under the weight stepper. */
function PlateLine({ total, bar, units }: { total: number; bar: number; units: Units }) {
  const load = loadPlates(total, bar, units);
  const text = load.belowBar
    ? `Lighter than the empty ${bar} ${units} bar`
    : load.perSide.length === 0
      ? `Empty bar (${bar} ${units})`
      : `Each side: ${load.perSide.join(" + ")} ${units}${load.remainder ? ` (+${load.remainder} ${units} extra)` : ""}`;
  return (
    <Txt v="meta" style={{ textAlign: "center" }}>
      {text}
    </Txt>
  );
}

/** Inline corrector for a logged set; value edits write an audit entry. */
function EditSetRow({
  set,
  tag,
  weighted,
  counted,
  units,
  device,
  devices,
  exercises,
  onSave,
  onRevert,
  onDelete,
  onCancel,
}: {
  set: WorkoutSet;
  tag: string;
  weighted: boolean;
  counted: boolean;
  units: Units;
  device: string | null;
  devices: Device[];
  exercises: { id: string; name: string }[];
  onSave: (v: { kg: number; reps: number; deviceId: string | null; moveTo: string | null }) => void;
  onRevert: () => void;
  onDelete: () => void;
  onCancel: () => void;
}) {
  const p = usePalette();
  const [w, setW] = useState(stepperValue(set.actualWeight ?? 0, units));
  const [r, setR] = useState(set.actualReps ?? 0);
  const [deviceId, setDeviceId] = useState(device);
  const [moveTo, setMoveTo] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  return (
    <View style={{ gap: 12, borderRadius: radius.control, borderWidth: 1, borderColor: alpha(p.accent, 0.4), backgroundColor: p.bg, padding: 12 }}>
      <Row style={{ justifyContent: "space-between" }}>
        <Txt v="label">Fix set {tag}</Txt>
        {set.editedAt ? (
          <Pressable onPress={onRevert} accessibilityRole="button" style={{ minHeight: 44, justifyContent: "center" }}>
            <Txt v="meta" color={p.accent}>
              Revert to original
            </Txt>
          </Pressable>
        ) : null}
      </Row>
      {counted && weighted ? <Stepper label="Weight" value={w} step={weightStep(units)} unit={units} onChange={setW} /> : null}
      {counted ? <Stepper label="Reps" value={r} step={1} min={0} unit="reps" decimals={0} onChange={setR} /> : null}
      {devices.length > 1 ? (
        <View style={{ gap: 6 }}>
          <Txt v="meta">Machine (all sets of this exercise)</Txt>
          <Row gap={6} style={{ flexWrap: "wrap" }}>
            {devices.slice(0, 12).map((d) => (
              <Chip key={d.id} label={`${d.name}${d.machineNumber ? ` · No. ${d.machineNumber}` : ""}`} on={deviceId === d.id} onPress={() => setDeviceId(d.id)} />
            ))}
          </Row>
        </View>
      ) : null}
      {exercises.length > 0 ? (
        <View style={{ gap: 6 }}>
          <Txt v="meta">Logged on the wrong exercise?</Txt>
          <Row gap={6} style={{ flexWrap: "wrap" }}>
            <Chip label="Keep it here" on={moveTo === null} onPress={() => setMoveTo(null)} />
            {exercises.map((x) => (
              <Chip key={x.id} label={`Move to ${x.name}`} on={moveTo === x.id} onPress={() => setMoveTo(x.id)} />
            ))}
          </Row>
        </View>
      ) : null}
      <Row gap={8}>
        <Button small variant="danger" label={confirmDelete ? "Tap to delete" : "Delete"} onPress={() => (confirmDelete ? onDelete() : setConfirmDelete(true))} />
        <Button small variant="ghost" label="Cancel" onPress={onCancel} style={{ flex: 1 }} />
        <Button small label="Save" onPress={() => onSave({ kg: fromDisplay(w, units), reps: r, deviceId, moveTo })} style={{ flex: 1 }} />
      </Row>
    </View>
  );
}
