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
const LEVELS: { key: NonNullable<UserProfile["experience"]>; label: string }[] =
  [
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

  if (!hydrated) return <main className="p-4 text-white/50">Loading…</main>;

  const exit = async () => {
    await signOut();
    leaveSession();
    router.push("/");
  };

  return (
    <main className="mx-auto max-w-2xl space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="page-title">Profile</h1>
        <Link href="/" className="text-sm text-blue-400 hover:text-blue-300 font-semibold transition-colors">
          Done
        </Link>
      </header>

      <section className="space-y-3">
        <h2 className="section-label">Name</h2>
        <input
          className="input text-base py-3"
          placeholder="Your name"
          value={profile.displayName ?? ""}
          onChange={(e) =>
            updateProfile({ displayName: e.target.value || null })
          }
        />
      </section>

      <section className="space-y-3">
        <h2 className="section-label">Units</h2>
        <div className="flex overflow-hidden rounded-xl border border-white/10">
          {(["kg", "lb"] as Units[]).map((u) => (
            <button
              key={u}
              onClick={() => setUnits(u)}
              className={`flex-1 py-4 text-base font-semibold transition-colors ${
                units === u
                  ? "bg-blue-600 text-white"
                  : "bg-white/[0.03] text-white/60 hover:bg-white/[0.07]"
              }`}
            >
              {u}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="section-label">Goal</h2>
        <div className="flex flex-wrap gap-3">
          {GOALS.map((g) => (
            <button
              key={g.key}
              onClick={() => updateProfile({ goal: g.key })}
              className={`rounded-full border px-5 py-3 text-base font-semibold transition-colors ${
                profile.goal === g.key
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.07]"
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="section-label">Experience</h2>
        <div className="flex flex-wrap gap-3">
          {LEVELS.map((l) => (
            <button
              key={l.key}
              onClick={() => updateProfile({ experience: l.key })}
              className={`rounded-full border px-5 py-3 text-base font-semibold transition-colors ${
                profile.experience === l.key
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.07]"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </section>

      <section className="card space-y-3">
        <p className="text-base font-semibold text-white">Account</p>
        <p className="text-sm text-white/60">
          {session?.mode === "account" ? (
            <>
              Signed in as <b className="text-white">{session.email}</b>.
            </>
          ) : (
            <>
              <b className="text-white">Guest</b> — data is stored on this device only. Sign in to sync
              across devices (available once Supabase is connected). Role:{" "}
              <b className="text-white">{profile.role}</b>.
            </>
          )}
        </p>
        <button
          className="btn-ghost w-full py-4 text-base font-semibold"
          onClick={exit}
        >
          {session?.mode === "account"
            ? "Sign out"
            : "Switch account / sign in"}
        </button>
      </section>

      {(session?.role === "trainer" || session?.role === "admin") && (
        <Link
          href="/trainer"
          className="btn-ghost w-full py-4 text-base font-semibold"
        >
          🧑‍🏫 Trainer · clients
        </Link>
      )}
      {session?.role === "admin" && (
        <Link
          href="/admin"
          className="btn-primary w-full py-4 text-base font-semibold"
        >
          ⚙️ Admin panel
        </Link>
      )}
    </main>
  );
}
