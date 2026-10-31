// Pieces shared by Plan and Workouts (src/components/plan/PlanSections.tsx):
// a startable workout row, the user's programs with their days, and the
// program library.
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Check, ChevronRight, Clock, Play, Plus } from "lucide-react-native";
import { useStore } from "@/lib/store";
import { recommendToday } from "@/domain/adaptive";
import { activeSession } from "@/domain/session";
import { PROGRAM_BLUEPRINTS, type ProgramBlueprint } from "@/data/programs";
import { SEED_PLAN_ID, SEED_PROGRAM_ID } from "@/lib/seed";
import { label } from "@/domain/taxonomy";
import type { WorkoutTemplate } from "@/domain/types";
import { Badge, Button, Card, Field, Row, Txt } from "~/ui/kit";
import { usePalette } from "~/ui/theme";

export const SETTING_LABEL: Record<ProgramBlueprint["setting"], string> = {
  gym: "Full gym",
  machines: "Machines",
  dumbbells: "Dumbbells",
  bodyweight: "Bodyweight",
};

export function minutesFor(t: WorkoutTemplate): number {
  const sec = t.exercises.reduce((n, te) => n + te.sets.length * (40 + te.restSeconds), 0);
  return Math.max(5, Math.round(sec / 60 / 5) * 5);
}

export function shortDate(day: string): string {
  return new Date(day + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Starts a workout, or resumes the one already running. */
export function useStartWorkout() {
  const startSession = useStore((s) => s.startSession);
  const getActiveSession = useStore((s) => s.getActiveSession);
  return (templateId: string) => {
    const { id, blocked } = startSession(templateId);
    if (blocked) {
      const a = getActiveSession();
      if (a) router.push(`/session/${a.id}`);
      return;
    }
    if (id) router.push(`/session/${id}`);
  };
}

/** What the rows need to mark "Up next" and "last done". */
function useRowInfo() {
  const programs = useStore((s) => s.programs);
  const templates = useStore((s) => s.templates);
  const sessions = useStore((s) => s.sessions);
  const feedback = useStore((s) => s.feedback);
  const active = activeSession(sessions) !== null;
  const nextId = active ? null : recommendToday({ templates, programs, sessions, feedback })?.templateId;
  const lastDone = new Map<string, string>();
  for (const s of sessions)
    if (s.templateId && s.status === "completed" && (lastDone.get(s.templateId) ?? "") < s.date) lastDone.set(s.templateId, s.date);
  return { nextId, lastDone };
}

export function WorkoutRows({ templates, prefix }: { templates: WorkoutTemplate[]; prefix?: (i: number) => string }) {
  const p = usePalette();
  const start = useStartWorkout();
  const { nextId, lastDone } = useRowInfo();
  return (
    <View>
      {templates.map((t, i) => {
        const isNext = t.id === nextId;
        const last = lastDone.get(t.id);
        const meta = [
          `${t.exercises.length} exercise${t.exercises.length === 1 ? "" : "s"}`,
          t.exercises.length > 0 ? `~${minutesFor(t)} min` : null,
          last ? `last ${shortDate(last)}` : null,
        ]
          .filter(Boolean)
          .join(" · ");
        return (
          <Row
            key={t.id}
            gap={12}
            style={[s.row, i < templates.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: p.border }]}
          >
            <Pressable
              onPress={() => router.push(`/template/${t.id}`)}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${t.name}`}
              style={{ flex: 1, gap: 2, paddingVertical: 4 }}
            >
              <Row gap={6}>
                <Txt v="h3" lines={1} style={{ flexShrink: 1 }}>
                  {prefix ? <Txt v="h3" color={p.muted}>{`${prefix(i)} · `}</Txt> : null}
                  {t.name}
                </Txt>
                {isNext ? <Badge tone="accent">Up next</Badge> : null}
                {t.id === SEED_PLAN_ID ? <Badge>Sample</Badge> : null}
              </Row>
              <Txt v="meta" lines={1}>
                {meta}
              </Txt>
            </Pressable>
            <Button
              small
              icon={Play}
              label="Start"
              accessibilityLabel={`Start ${t.name}`}
              variant={isNext ? "primary" : "secondary"}
              disabled={t.exercises.length === 0}
              onPress={() => start(t.id)}
            />
          </Row>
        );
      })}
    </View>
  );
}

/** The user's programs, each with its days. */
export function ProgramList() {
  const p = usePalette();
  const programs = useStore((s) => s.programs);
  const daysForProgram = useStore((s) => s.daysForProgram);
  useStore((s) => s.templates); // days change when templates do
  return (
    <>
      {programs.map((prog) => {
        const days = daysForProgram(prog.id);
        return (
          <Card key={prog.id} padded={false} style={{ overflow: "hidden" }}>
            <Pressable
              onPress={() => router.push(`/program/${prog.id}`)}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${prog.name}`}
              style={({ pressed }) => [s.progHead, { borderBottomColor: p.border, backgroundColor: pressed ? p.well : undefined }]}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Row gap={6} style={{ flexWrap: "wrap" }}>
                  <Txt v="h3">{prog.name}</Txt>
                  {prog.source === "trainer" ? <Badge tone="accent">Trainer</Badge> : null}
                  {prog.id === SEED_PROGRAM_ID ? <Badge>Sample</Badge> : null}
                </Row>
                <Txt v="meta">{`${days.length} day${days.length === 1 ? "" : "s"} · rotate in order`}</Txt>
              </View>
              <Txt v="label" color={p.accent}>
                Edit
              </Txt>
              <ChevronRight color={p.muted} size={16} />
            </Pressable>
            {days.length > 0 ? (
              <WorkoutRows templates={days} prefix={(i) => `Day ${i + 1}`} />
            ) : (
              <Txt v="bodySm" color={p.muted} style={{ padding: 16 }}>
                No days yet — open the program to add one.
              </Txt>
            )}
          </Card>
        );
      })}
    </>
  );
}

/** Ready-made programs the user can add. */
export function ProgramLibrary() {
  const p = usePalette();
  const programs = useStore((s) => s.programs);
  const installProgram = useStore((s) => s.installProgram);
  const installed = new Set(programs.map((x) => x.blueprintId).filter(Boolean));
  return (
    <View style={{ gap: 12 }}>
      <View style={{ paddingHorizontal: 4, gap: 2 }}>
        <Txt v="h2">Program library</Txt>
        <Txt v="bodySm" color={p.muted}>
          Evidence-based programs with sets, reps and rest already set up. Edit anything after adding.
        </Txt>
      </View>
      {PROGRAM_BLUEPRINTS.map((bp) => {
        const has = installed.has(bp.id);
        return (
          <Card key={bp.id} style={{ gap: 12, padding: 20 }}>
            <View style={{ gap: 4 }}>
              <Txt v="h3">{bp.name}</Txt>
              <Txt v="bodySm">{bp.summary}</Txt>
            </View>
            <Row gap={6} style={{ flexWrap: "wrap" }}>
              <Badge>{`${bp.daysPerWeek}× / week`}</Badge>
              <Badge>{label(bp.level)}</Badge>
              <Badge>{SETTING_LABEL[bp.setting]}</Badge>
              <Row gap={4} style={{ backgroundColor: p.well, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Clock color={p.inkSoft} size={12} />
                <Txt v="meta" color={p.inkSoft} style={{ fontSize: 11 }}>
                  {`~${bp.minutes} min`}
                </Txt>
              </Row>
            </Row>
            <Txt v="meta">{bp.days.map((d) => d.name).join(" · ")}</Txt>
            <Button
              variant={has ? "ghost" : "secondary"}
              icon={has ? Check : Plus}
              label={has ? "Added · add another copy" : "Add program"}
              onPress={() => {
                const id = installProgram(bp.id);
                if (id) router.push(`/program/${id}`);
              }}
            />
          </Card>
        );
      })}
    </View>
  );
}

/** The inline "name it, create it" card behind the + buttons. */
export function NameForm({
  label: fieldLabel,
  placeholder,
  onCreate,
  onCancel,
}: {
  label: string;
  placeholder: string;
  onCreate: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const submit = () => {
    const n = name.trim();
    if (n) onCreate(n);
  };
  return (
    <Card style={{ gap: 12 }}>
      <Field
        label={fieldLabel}
        autoFocus
        value={name}
        maxLength={60}
        onChangeText={setName}
        placeholder={placeholder}
        returnKeyType="done"
        onSubmitEditing={submit}
      />
      <Row gap={8}>
        <Button variant="ghost" label="Cancel" onPress={onCancel} style={{ flex: 1 }} />
        <Button label="Create" onPress={submit} disabled={!name.trim()} style={{ flex: 1 }} />
      </Row>
    </Card>
  );
}

const s = StyleSheet.create({
  row: { paddingHorizontal: 16, paddingVertical: 10 },
  progHead: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
});
