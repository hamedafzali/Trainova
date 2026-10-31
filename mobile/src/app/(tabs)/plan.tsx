import { useState } from "react";
import { router } from "expo-router";
import { CalendarDays, Plus } from "lucide-react-native";
import { useStore } from "@/lib/store";
import { EmptySlot, IconButton, ListCard, ListRow, PageHeader, Screen, SectionHeader } from "~/ui/kit";
import { NameForm, ProgramLibrary, ProgramList } from "~/features/plan";
import { View } from "react-native";

/** Plan tab: the programs you follow and programs to add. */
export default function PlanTab() {
  const programs = useStore((s) => s.programs);
  const createProgram = useStore((s) => s.createProgram);
  const [creating, setCreating] = useState(false);
  return (
    <Screen>
      <PageHeader
        title="Plan"
        subtitle="The programs you follow and when you train."
        actions={<IconButton icon={Plus} label="New program" onPress={() => setCreating(!creating)} pressed={creating} />}
      />
      {creating && (
        <NameForm
          label="Program name"
          placeholder="e.g. My 4-day split"
          onCancel={() => setCreating(false)}
          onCreate={(n) => {
            setCreating(false);
            router.push(`/program/${createProgram(n, "self")}`);
          }}
        />
      )}
      <ListCard>
        <ListRow
          icon={CalendarDays}
          tone="accent"
          title="History"
          meta="Every workout you've logged, by date."
          onPress={() => router.push("/history")}
          last
        />
      </ListCard>
      <View>
        <SectionHeader title="Your programs" />
        <View style={{ gap: 12 }}>
          {programs.length > 0 ? <ProgramList /> : <EmptySlot>No program yet. Add one from the library below, or create your own.</EmptySlot>}
        </View>
      </View>
      <ProgramLibrary />
    </Screen>
  );
}
