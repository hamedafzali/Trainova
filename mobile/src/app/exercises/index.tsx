import { router } from "expo-router";
import { useStore } from "@/lib/store";
import { ExerciseBrowser } from "~/features/ExerciseBrowser";
import { PageHeader, Screen } from "~/ui/kit";

/** The exercise library: search and browse, then open one for its guide and history. */
export default function ExercisesScreen() {
  const count = useStore((s) => s.exercises.length);
  return (
    <Screen>
      <PageHeader back title="Exercises" subtitle={`${count} movements with 3D guides.`} />
      <ExerciseBrowser onSelect={(id) => router.push(`/exercises/${id}`)} />
    </Screen>
  );
}
