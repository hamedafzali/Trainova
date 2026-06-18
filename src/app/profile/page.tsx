"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useHydrated, useStore } from "@/lib/store";
import { signOut } from "@/lib/auth";
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
  const router = useRouter();
  const profile = useStore((s) => s.profile);
  const session = useStore((s) => s.session);
  const leaveSession = useStore((s) => s.leaveSession);
  const units = useStore((s) => s.units);
  const setUnits = useStore((s) => s.setUnits);
  const updateProfile = useStore((s) => s.updateProfile);

  if (!hydrated) return <main className="p-4 text-muted">Loading…</main>;

  const exit = async () => {
    await signOut();
    leaveSession();
    router.push("/");
  };

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

      <section className="card space-y-2">
        <p className="text-sm font-semibold">Account</p>
        <p className="text-xs text-muted">
          {session?.mode === "account" ? (
            <>
              Signed in as <b>{session.email}</b>.
            </>
          ) : (
            <>
              <b>Guest</b> — data is stored on this device only. Sign in to sync across devices
              (available once Supabase is connected). Role: <b>{profile.role}</b>.
            </>
          )}
        </p>
        <button className="btn-ghost w-full" onClick={exit}>
          {session?.mode === "account" ? "Sign out" : "Switch account / sign in"}
        </button>
      </section>

      {session?.role === "admin" && (
        <Link href="/admin" className="btn-primary w-full">
          ⚙️ Admin panel
        </Link>
      )}
    </main>
  );
}
