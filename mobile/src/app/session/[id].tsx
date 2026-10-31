// The live workout (and the review of a finished one): the web's
// app/session/[id]/page.tsx for the app.
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Share, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, ArrowRight, Check, ChevronLeft, Dumbbell, MoreVertical, Plus, Share2, StickyNote, Trash2 } from "lucide-react-native";
import type { SessionDifficulty, WorkoutSet } from "@/domain/types";
import { exerciseTypeOf } from "@/domain/exerciseType";
import { haptic } from "@/lib/haptics";
import { trackEvent } from "@/lib/analytics";
import { toast } from "@/lib/toast";
import { useStore } from "@/lib/store";
import { formatVolume } from "@/lib/units";
import { Button, Card, EmptySlot, ListCard, ListRow, Row, Sheet, Txt, type Icon } from "~/ui/kit";
import { alpha, font, radius, usePalette } from "~/ui/theme";
import { SessionExercise, describeSet } from "~/features/SessionExercise";
import { RestTimerBar } from "~/features/RestTimerBar";
import { ExerciseBrowser } from "~/features/ExerciseBrowser";

function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

function useNow(on: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!on) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [on]);
  return now;
}

export default function SessionScreen() {
  const p = usePalette();
  const { id } = useLocalSearchParams<{ id: string }>();

  const session = useStore((s) => s.sessions.find((x) => x.id === id));
  const allSets = useStore((s) => s.sets);
  const units = useStore((s) => s.units);
  const exerciseById = useStore((s) => s.exerciseById);
  const deviceById = useStore((s) => s.deviceById);
  const addSet = useStore((s) => s.addSet);
  const finishSession = useStore((s) => s.finishSession);
  const discardSession = useStore((s) => s.discardSession);
  const reopenSession = useStore((s) => s.reopenSession);
  const archiveSession = useStore((s) => s.archiveSession);
  const unarchiveSession = useStore((s) => s.unarchiveSession);
  const recordSessionFeedback = useStore((s) => s.recordSessionFeedback);
  const setSessionNotes = useStore((s) => s.setSessionNotes);

  const [picking, setPicking] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [recap, setRecap] = useState<"finished" | "view" | null>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const isActive = session?.status === "active";
  const now = useNow(isActive);

  const sessionSets = useMemo(() => allSets.filter((s) => s.sessionId === id).sort((a, b) => a.setIndex - b.setIndex), [allSets, id]);
  const exerciseOrder = useMemo(() => {
    const seen: string[] = [];
    for (const s of sessionSets) if (!seen.includes(s.exerciseId)) seen.push(s.exerciseId);
    return seen;
  }, [sessionSets]);
  const setsByExercise = useMemo(() => {
    const m = new Map<string, WorkoutSet[]>();
    for (const exId of exerciseOrder) m.set(exId, []);
    for (const s of sessionSets) m.get(s.exerciseId)?.push(s);
    return m;
  }, [exerciseOrder, sessionSets]);

  const firstOpen = exerciseOrder.find((exId) => (setsByExercise.get(exId) ?? []).some((s) => !s.completed)) ?? exerciseOrder[0] ?? null;
  const focused = current && exerciseOrder.includes(current) ? current : firstOpen;
  const focusedIdx = focused ? exerciseOrder.indexOf(focused) : -1;

  const completedCount = sessionSets.filter((s) => s.completed).length;
  const volumeKg = sessionSets.filter((s) => s.completed && s.kind !== "warmup").reduce((sum, s) => sum + (s.actualWeight ?? 0) * (s.actualReps ?? 0), 0);

  if (!session) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: p.bg, padding: 16, gap: 16 }}>
        <EmptySlot action={<Button variant="ghost" label="Back to home" onPress={() => router.replace("/")} />}>
          Workout not found. It may have been deleted on another device.
        </EmptySlot>
      </SafeAreaView>
    );
  }

  const leave = (to: "/" | "/history") => (router.canGoBack() ? router.back() : router.replace(to));

  const finish = () => {
    const { discarded } = finishSession(session.id);
    trackEvent(discarded ? "workout_discarded" : "workout_finished", { session_id: session.id, completed_sets: completedCount });
    setFeedbackOpen(false);
    if (!discarded) {
      haptic("finish");
      toast("Workout saved", { variant: "success" });
      // iOS can't present a sheet while another is still sliding away.
      setTimeout(() => setRecap("finished"), feedbackOpen ? 400 : 0);
    } else router.replace("/");
  };

  const showPr = (kinds: string[]) => {
    const what = kinds.map((k) => (k === "e1rm" ? "estimated 1RM" : k === "max_weight" ? "heaviest weight" : "most reps")).join(" & ");
    toast(`New PR — ${what}!`, { variant: "success" });
  };

  const requestFinish = () => {
    const open = sessionSets.filter((s) => !s.completed).length;
    const go = () => (completedCount > 0 ? setFeedbackOpen(true) : finish());
    if (completedCount === 0) {
      Alert.alert("Nothing logged yet", "Finishing now discards this workout.", [
        { text: "Cancel", style: "cancel" },
        { text: "Discard", style: "destructive", onPress: finish },
      ]);
    } else if (open > 0) {
      Alert.alert(`Finish with ${open} open set${open === 1 ? "" : "s"}?`, "Unlogged sets will be removed.", [
        { text: "Cancel", style: "cancel" },
        { text: "Finish", onPress: go },
      ]);
    } else go();
  };

  const confirmDiscard = () =>
    Alert.alert(isActive ? "Discard this workout?" : "Delete this workout?", isActive ? "All logged sets will be deleted." : "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: isActive ? "Discard" : "Delete",
        style: "destructive",
        onPress: () => {
          discardSession(session.id);
          leave(isActive ? "/" : "/history");
        },
      },
    ]);

  const next = focusedIdx >= 0 ? exerciseOrder[focusedIdx + 1] : undefined;
  const prev = focusedIdx > 0 ? exerciseOrder[focusedIdx - 1] : undefined;
  const statusLabel = isActive ? clock(now - new Date(session.startedAt).getTime()) : session.status === "completed" ? "Completed" : "Archived";

  const shareRecap = async () => {
    const lines = exerciseOrder.map((exId) => {
      const ex = exerciseById(exId);
      const type = exerciseTypeOf(ex, deviceById((setsByExercise.get(exId) ?? [])[0]?.deviceId ?? ex?.defaultDeviceId ?? undefined));
      const done = (setsByExercise.get(exId) ?? []).filter((s) => s.completed);
      return `${ex?.name ?? "Exercise"}: ${done.map((s) => describeSet(s, type, units)).join(", ")}`;
    });
    await Share.share({
      message: `${session.title} — ${completedCount} sets, ${formatVolume(volumeKg, units)}\n\n${lines.join("\n")}\n\nLogged with Trainova`,
    }).catch(() => undefined);
  };

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: p.bg }}>
      {/* header */}
      <View style={{ paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: p.border, backgroundColor: p.bg }}>
        <Row gap={6}>
          <Pressable onPress={() => leave(isActive ? "/" : "/history")} accessibilityRole="button" accessibilityLabel="Back" style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
            <ChevronLeft color={p.inkSoft} size={26} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Txt v="h3" lines={1} style={{ fontFamily: font.bold }}>
              {session.title}
            </Txt>
            <Txt v="meta">
              {statusLabel} ·{" "}
              {isActive
                ? `${completedCount}/${sessionSets.length} sets`
                : new Date(session.startedAt).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}
            </Txt>
          </View>
          {isActive ? <Button small label="Finish" onPress={requestFinish} /> : null}
          <Pressable onPress={() => setMenuOpen(true)} accessibilityRole="button" accessibilityLabel="More actions" style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
            <MoreVertical color={p.inkSoft} size={22} />
          </Pressable>
        </Row>
        {isActive && sessionSets.length > 0 ? (
          <View style={{ marginTop: 8, height: 4, borderRadius: 2, backgroundColor: p.well, overflow: "hidden" }}>
            <View style={{ height: 4, width: `${(completedCount / sessionSets.length) * 100}%`, backgroundColor: p.accent }} />
          </View>
        ) : null}
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: isActive ? 140 : 40 }}>
        {!isActive && sessionSets.length > 0 ? (
          <View style={{ gap: 8 }}>
            <Row gap={8}>
              <MiniStat label="Exercises" value={String(exerciseOrder.length)} />
              <MiniStat label="Sets" value={String(completedCount)} />
              <MiniStat label="Volume" value={formatVolume(volumeKg, units)} />
            </Row>
            {session.status === "completed" && completedCount > 0 ? <Button variant="secondary" icon={Share2} label="Share recap" onPress={() => setRecap("view")} /> : null}
          </View>
        ) : null}

        {notesOpen || session.notes ? (
          <Card style={{ gap: 8 }}>
            <Txt v="eyebrow">Workout notes</Txt>
            <TextInput
              key={session.notes ?? ""}
              defaultValue={session.notes ?? ""}
              autoFocus={notesOpen && !session.notes}
              multiline
              placeholder="How did it feel? Seat settings, pain, sleep…"
              placeholderTextColor={p.muted}
              accessibilityLabel="Workout notes"
              onEndEditing={(e) => {
                const text = e.nativeEvent.text ?? "";
                setSessionNotes(session.id, text);
                if (!text.trim()) setNotesOpen(false);
              }}
              style={{ minHeight: 64, borderRadius: radius.control, backgroundColor: p.well, color: p.ink, padding: 12, fontFamily: font.regular, fontSize: 15, textAlignVertical: "top" }}
            />
          </Card>
        ) : null}

        {exerciseOrder.length === 0 && isActive ? (
          <EmptySlot action={<Button icon={Plus} label="Add exercise" onPress={() => setPicking(true)} />}>Empty workout. Add your first exercise to start logging.</EmptySlot>
        ) : null}
        {exerciseOrder.length === 0 && !isActive ? <EmptySlot>No sets logged in this workout.</EmptySlot> : null}

        {isActive && focused ? (
          <View style={{ gap: 14 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ marginHorizontal: -16 }}>
              <View style={{ width: 8 }} />
              {exerciseOrder.map((exId, i) => {
                const list = setsByExercise.get(exId) ?? [];
                const doneN = list.filter((s) => s.completed).length;
                const complete = list.length > 0 && doneN === list.length;
                const on = exId === focused;
                return (
                  <Pressable
                    key={exId}
                    onPress={() => setCurrent(exId)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      maxWidth: 190,
                      minHeight: 44,
                      paddingHorizontal: 12,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: on ? p.accent : complete ? "transparent" : p.border,
                      backgroundColor: on ? alpha(p.accent, 0.1) : complete ? alpha(p.success, 0.12) : p.card,
                    }}
                  >
                    {complete ? (
                      <Check color={p.success} size={14} strokeWidth={3} />
                    ) : (
                      <Txt v="meta" style={{ fontFamily: font.bold }}>
                        {i + 1}
                      </Txt>
                    )}
                    <Txt v="bodySm" lines={1} color={on ? p.ink : complete ? p.success : p.inkSoft} style={{ fontFamily: font.medium, flexShrink: 1 }}>
                      {exerciseById(exId)?.name ?? "Exercise"}
                    </Txt>
                  </Pressable>
                );
              })}
              <Pressable
                onPress={() => setPicking(true)}
                accessibilityRole="button"
                accessibilityLabel="Add exercise"
                style={{ flexDirection: "row", alignItems: "center", gap: 4, minHeight: 44, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderStyle: "dashed", borderColor: p.border }}
              >
                <Plus color={p.accent} size={14} />
                <Txt v="label" color={p.accent}>
                  Add
                </Txt>
              </Pressable>
              <View style={{ width: 8 }} />
            </ScrollView>

            <SessionExercise key={focused} sessionId={session.id} exerciseId={focused} sets={setsByExercise.get(focused) ?? []} editable onPr={showPr} />

            <Row gap={8}>
              <View style={{ flex: 1 }}>
                {prev ? <Button variant="ghost" icon={ArrowLeft} label="Previous" onPress={() => setCurrent(prev)} /> : null}
              </View>
              <View style={{ flex: 1 }}>
                {next ? (
                  <Button variant="ghost" icon={ArrowRight} label={exerciseById(next)?.name ?? "Next"} onPress={() => setCurrent(next)} />
                ) : (
                  <Button variant="secondary" label="Finish workout" onPress={requestFinish} />
                )}
              </View>
            </Row>
          </View>
        ) : null}

        {!isActive && exerciseOrder.length > 0
          ? exerciseOrder.map((exId) => (
              <SessionExercise
                key={exId}
                sessionId={session.id}
                exerciseId={exId}
                sets={setsByExercise.get(exId) ?? []}
                readOnly
                editable={session.status === "completed"}
                onPr={showPr}
              />
            ))
          : null}
      </ScrollView>

      {isActive ? <RestTimerBar /> : null}

      <Sheet open={picking} onClose={() => setPicking(false)} title="Add exercise">
        <ExerciseBrowser
          onSelect={(exerciseId) => {
            addSet(session.id, exerciseId);
            setCurrent(exerciseId);
            setPicking(false);
          }}
        />
      </Sheet>

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Workout">
        <ListCard>
          {isActive ? (
            <MenuRow icon={Plus} title="Add exercise" onPress={() => (setMenuOpen(false), setPicking(true))} />
          ) : null}
          <MenuRow icon={StickyNote} title={session.notes ? "Edit notes" : "Add notes"} onPress={() => (setMenuOpen(false), setNotesOpen(true))} />
          {session.status === "completed" ? (
            <MenuRow
              icon={Dumbbell}
              title="Resume workout"
              onPress={() => {
                setMenuOpen(false);
                toast(reopenSession(session.id) ? "Re-opened for editing" : "Finish your active workout first");
              }}
            />
          ) : null}
          {session.status === "completed" ? (
            <MenuRow
              title="Archive"
              onPress={() => {
                setMenuOpen(false);
                archiveSession(session.id);
                leave("/history");
              }}
            />
          ) : null}
          {session.status === "archived" ? (
            <MenuRow
              title="Restore from archive"
              onPress={() => {
                setMenuOpen(false);
                unarchiveSession(session.id);
                leave("/history");
              }}
            />
          ) : null}
          <MenuRow icon={Trash2} danger last title={isActive ? "Discard workout" : "Delete workout"} onPress={() => (setMenuOpen(false), confirmDiscard())} />
        </ListCard>
      </Sheet>

      <Sheet open={feedbackOpen} onClose={() => setFeedbackOpen(false)} title="How did that feel?">
        <FeedbackForm
          onSkip={finish}
          onSubmit={(input) => {
            recordSessionFeedback(session.id, input);
            trackEvent("workout_feedback_submitted", {
              session_id: session.id,
              difficulty: input.difficulty,
              energy: input.energy,
              confidence: input.confidence,
              reported_pain: Boolean(input.pain),
            });
            finish();
          }}
        />
      </Sheet>

      <Sheet
        open={!!recap && session.status === "completed"}
        onClose={() => {
          const wasFinished = recap === "finished";
          setRecap(null);
          if (wasFinished) router.replace("/");
        }}
        title={recap === "finished" ? "Workout saved" : "Recap"}
      >
        <View style={{ backgroundColor: p.night, borderRadius: radius.card, padding: 18, gap: 12, overflow: "hidden" }}>
          <Txt v="eyebrow" color={p.volt}>
            {new Date(session.startedAt).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
          </Txt>
          <Txt v="title" color="#FFFFFF">
            {session.title}
          </Txt>
          <Row gap={18}>
            <RecapStat label="Sets" value={String(completedCount)} />
            <RecapStat label="Volume" value={formatVolume(volumeKg, units)} />
            <RecapStat
              label="Time"
              value={session.completedAt ? `${Math.max(1, Math.round((+new Date(session.completedAt) - +new Date(session.startedAt)) / 60000))} min` : "–"}
            />
          </Row>
        </View>
        <Button icon={Share2} label="Share" onPress={shareRecap} />
        <Button
          variant="ghost"
          label="Done"
          onPress={() => {
            const wasFinished = recap === "finished";
            setRecap(null);
            if (wasFinished) router.replace("/");
          }}
        />
      </Sheet>
    </SafeAreaView>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  const p = usePalette();
  return (
    <View style={{ flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: radius.card, borderWidth: 1, borderColor: p.border, backgroundColor: p.card }}>
      <Txt v="display" style={{ fontSize: 18 }} lines={1}>
        {value}
      </Txt>
      <Txt v="eyebrow" style={{ fontSize: 10.5 }}>
        {label}
      </Txt>
    </View>
  );
}

function RecapStat({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Txt v="display" color="#FFFFFF" style={{ fontSize: 20 }}>
        {value}
      </Txt>
      <Txt v="eyebrow" color="rgba(255,255,255,0.6)" style={{ fontSize: 10.5 }}>
        {label}
      </Txt>
    </View>
  );
}

function MenuRow({ icon, title, onPress, danger, last }: { icon?: Icon; title: string; onPress: () => void; danger?: boolean; last?: boolean }) {
  return <ListRow icon={icon} title={title} onPress={onPress} tone={danger ? "danger" : "neutral"} last={last} trailing={<View />} />;
}

type Scale = 1 | 2 | 3 | 4 | 5;

function FeedbackForm({
  onSubmit,
  onSkip,
}: {
  onSubmit: (input: { difficulty: SessionDifficulty; energy: Scale; confidence: Scale; pain: string | null; completedInMinutes: number | null }) => void;
  onSkip: () => void;
}) {
  const p = usePalette();
  const [difficulty, setDifficulty] = useState<SessionDifficulty>("right");
  const [energy, setEnergy] = useState<Scale>(3);
  const [confidence, setConfidence] = useState<Scale>(3);
  const [pain, setPain] = useState("");
  return (
    <View style={{ gap: 16 }}>
      <Txt v="bodySm">Your answer adjusts the next recommendation.</Txt>
      <FeedbackScale label="Difficulty" value={difficulty} options={["easy", "right", "hard"] as const} onPick={setDifficulty} />
      <FeedbackScale label="Energy" value={energy} options={[1, 2, 3, 4, 5] as const} onPick={setEnergy} />
      <FeedbackScale label="Confidence" value={confidence} options={[1, 2, 3, 4, 5] as const} onPick={setConfidence} />
      <View style={{ gap: 6 }}>
        <Txt v="label" color={p.inkSoft}>
          Pain or limitation? <Txt v="meta">Optional</Txt>
        </Txt>
        <TextInput
          value={pain}
          onChangeText={setPain}
          placeholder="Where and when did it occur?"
          placeholderTextColor={p.muted}
          accessibilityLabel="Pain or limitation"
          style={{ minHeight: 50, borderRadius: radius.control, borderWidth: 1, borderColor: p.border, backgroundColor: p.well, color: p.ink, paddingHorizontal: 14, fontFamily: font.regular, fontSize: 16 }}
        />
      </View>
      <Row gap={10}>
        <Button variant="ghost" label="Skip" onPress={onSkip} style={{ flex: 1 }} />
        <Button
          label="Save & finish"
          onPress={() => onSubmit({ difficulty, energy, confidence, pain: pain.trim() || null, completedInMinutes: null })}
          style={{ flex: 1 }}
        />
      </Row>
    </View>
  );
}

function FeedbackScale<T extends string | number>({ label, value, options, onPick }: { label: string; value: T; options: readonly T[]; onPick: (v: T) => void }) {
  const p = usePalette();
  return (
    <View style={{ gap: 8 }}>
      <Txt v="label" color={p.inkSoft}>
        {label}
      </Txt>
      <Row gap={6}>
        {options.map((o) => {
          const on = o === value;
          return (
            <Pressable
              key={String(o)}
              onPress={() => onPick(o)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${label} ${o}`}
              style={{ flex: 1, minHeight: 46, borderRadius: radius.control, alignItems: "center", justifyContent: "center", backgroundColor: on ? p.accentFill : p.well }}
            >
              <Txt v="label" color={on ? p.onAccent : p.inkSoft}>
                {typeof o === "string" ? o[0].toUpperCase() + o.slice(1) : String(o)}
              </Txt>
            </Pressable>
          );
        })}
      </Row>
    </View>
  );
}
