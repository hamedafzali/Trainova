"use client";

import { useRouter } from "next/navigation";
import { ExerciseBrowser } from "@/components/ExerciseBrowser";
import { ListSkeleton } from "@/components/Skeleton";
import { PageHeader } from "@/components/kit";
import { useHydrated } from "@/lib/store";

export default function ExercisesPage() {
  const hydrated = useHydrated();
  const router = useRouter();
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader title="Exercises" subtitle="Every movement in your library, with how-tos and your history." />
      {hydrated ? (
        <ExerciseBrowser
          hrefFor={(id) => `/exercises/${id}`}
          onCreated={(id) => router.push(`/exercises/${id}`)}
        />
      ) : (
        <ListSkeleton />
      )}
    </main>
  );
}
