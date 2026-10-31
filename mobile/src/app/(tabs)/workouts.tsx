import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { ClipboardList, History, ListChecks, Play, Plus } from "lucide-react-native";
import { useStore } from "@/lib/store";
import { activeSession } from "@/domain/session";
import { Button, CoachCard, EmptySlot, HeroCard, IconButton, ListCard, ListRow, PageHeader, Screen, SectionHeader, Txt } from "~/ui/kit";
import { NameForm, ProgramList, WorkoutRows } from "~/features/plan";

/** Workouts tab: what you can start now, single workouts, and the way to exercises and history. */
export default function WorkoutsTab() {
  const programs = useStore((s) => s.programs);
  const templates = useStore((s) => s.templates);
  const sessions = useStore((s) => s.sessions);
  const createTemplate = useStore((s) => s.createTemplate);
  const [creating, setCreating] = useState(false);

  const inProgram = new Set(programs.flatMap((p) => p.dayTemplateIds));
  const standalone = templates.filter((t) => !inProgram.has(t.id));
  const active = activeSession(sessions);

  return (
    <Screen>
      <PageHeader
        title="Workouts"
        subtitle="Start a workout from your program or one of your own."
        actions={
          <>
            <IconButton icon={ListChecks} label="Exercises" onPress={() => router.push("/exercises")} />
            <IconButton icon={History} label="History" onPress={() => router.push("/history")} />
            <IconButton icon={Plus} label="New workout" onPress={() => setCreating(!creating)} pressed={creating} />
          </>
        }
      />
      {creating && (
        <NameForm
          label="Workout name"
          placeholder="e.g. Arms & Abs"
          onCancel={() => setCreating(false)}
          onCreate={(n) => {
            setCreating(false);
            router.push(`/template/${createTemplate(n)}`);
          }}
        />
      )}

      {active && (
        <HeroCard eyebrow="In progress" title={active.title} live>
          <Txt v="bodySm" color="rgba(255,255,255,0.6)" style={{ marginBottom: 18 }}>
            Pick up where you left off.
          </Txt>
          <Button variant="volt" icon={Play} label="Resume workout" onPress={() => router.push(`/session/${active.id}`)} />
        </HeroCard>
      )}

      {programs.length > 0 && (
        <View>
          <SectionHeader title="From your programs" />
          <View style={{ gap: 12 }}>
            <ProgramList />
          </View>
        </View>
      )}

      <View>
        <SectionHeader title="Single workouts" />
        {standalone.length === 0 ? (
          <EmptySlot action={<Button small variant="secondary" icon={Plus} label="Create a workout" onPress={() => setCreating(true)} />}>
            Workouts outside a program live here.
          </EmptySlot>
        ) : (
          <ListCard>
            <WorkoutRows templates={standalone} />
          </ListCard>
        )}
      </View>

      <CoachCard
        text="Tell your coach how long you have and what equipment is free, and it builds today's workout."
        cta="Build me a workout"
        onPress={() => router.push({ pathname: "/coach", params: { ask: "Build me a workout for today" } })}
      />

      <ListCard>
        <ListRow icon={ClipboardList} tone="accent" title="Browse programs" meta="Ready-made programs in your Plan tab." onPress={() => router.push("/plan")} last />
      </ListCard>
    </Screen>
  );
}
