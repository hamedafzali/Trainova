"use client";

import { useRouter } from "next/navigation";
import { ExerciseBrowser } from "@/components/ExerciseBrowser";
import { ListSkeleton } from "@/components/Skeleton";
import { useHydrated } from "@/lib/store";

export default function ExercisesPage() {
  const hydrated = useHydrated();
  const router = useRouter();
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6">
      <header>
        <h1 className="page-title">Exercises</h1>
        <p className="page-subtitle">Every movement in your library, with how-tos and your history.</p>
      </header>
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
