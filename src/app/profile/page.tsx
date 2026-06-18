"use client";

import Link from "next/link";
import { useHydrated, useStore } from "@/lib/store";
import type { UserProfile, Units } from "@/domain/types";

const GOALS: { key: NonNullable<UserProfile["goal"]>; label: string }[] = [
  { key: "strength", label: "Strength" },
  { key: "hypertrophy", label: "Muscle" },
  { key: "fat_loss", label: "Fat loss" },
  { key: "health", label: "Health" },
];
const LEVELS: { key: NonNullable<UserProfile["experience"]>; label: string }[] = [
  { key: "beginner", label: "Beginner" },
  { key: "intermediate", label: "Intermediate" },
  { key: "advanced", label: "Advanced" },
];

export default function ProfilePage() {
  const hydrated = useHydrated();
  const profile = useStore((s) => s.profile);
  const units = useStore((s) => s.units);
  const setUnits = useStore((s) => s.setUnits);
  const updateProfile = useStore((s) => s.updateProfile);

  if (!hydrated) return <main className="p-4 text-muted">Loading…</main>;

  return (
    <main className="space-y-5 p-4">
      <header className="flex items-center justify-between pt-2">
        <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
        <Link href="/" className="text-sm text-accent">
          Done
        </Link>
      </header>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Name</h2>
        <input
          className="input"
          placeholder="Your name"
          value={profile.displayName ?? ""}
          onChange={(e) => updateProfile({ displayName: e.target.value || null })}
        />
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Units</h2>
        <div className="flex overflow-hidden rounded-xl border border-border">
          {(["kg", "lb"] as Units[]).map((u) => (
            <button
              key={u}
              onClick={() => setUnits(u)}
              className={`flex-1 py-3 font-semibold ${
                units === u ? "bg-accent text-onAccent" : "bg-surface2 text-inkSoft"
              }`}
            >
              {u}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Goal</h2>
        <div className="flex flex-wrap gap-2">
          {GOALS.map((g) => (
            <button
              key={g.key}
              onClick={() => updateProfile({ goal: g.key })}
              className={`rounded-full border px-4 py-2 text-sm ${
                profile.goal === g.key
                  ? "border-accent bg-accent text-onAccent"
                  : "border-border bg-surface2 text-inkSoft"
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Experience</h2>
        <div className="flex flex-wrap gap-2">
          {LEVELS.map((l) => (
            <button
              key={l.key}
              onClick={() => updateProfile({ experience: l.key })}
              className={`rounded-full border px-4 py-2 text-sm ${
                profile.experience === l.key
                  ? "border-accent bg-accent text-onAccent"
                  : "border-border bg-surface2 text-inkSoft"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </section>

      <section className="card space-y-1">
        <p className="text-sm font-semibold">Account &amp; sync</p>
        <p className="text-xs text-muted">
          Your data is stored on this device. Cloud accounts, cross-device sync, and trainer
          coaching arrive in the backend phase. Role: <b>{profile.role}</b>.
        </p>
      </section>
    </main>
  );
}
