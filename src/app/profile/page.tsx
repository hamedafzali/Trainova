"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useHydrated, useStore } from "@/lib/store";
import { signOut } from "@/lib/auth";
import type { UserProfile, Units } from "@/domain/types";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CardSkeleton } from "@/components/Skeleton";
import { toast } from "@/lib/toast";

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

  if (!hydrated)
    return (
      <main className="mx-auto max-w-2xl">
        <CardSkeleton />
      </main>
    );

  const exit = async () => {
    await signOut();
    leaveSession();
    router.push("/");
  };

  const isTrainerOrAdmin =
    session?.role === "trainer" || session?.role === "admin";
  const isAdmin = session?.role === "admin";

  return (
    <main className="mx-auto max-w-2xl space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="page-title">Profile</h1>
        <Link
          href="/"
          className="text-sm text-accent hover:text-accentHover font-semibold transition-colors"
        >
          Done
        </Link>
      </header>

      {/* About you — identity + training profile */}
      <section className="rounded-card border border-border bg-surface shadow-card p-6 space-y-5">
        <div className="space-y-3">
          <h2 className="section-label">Name</h2>
          <input
            className="input text-base py-3"
            placeholder="Your name"
            value={profile.displayName ?? ""}
            onChange={(e) =>
              updateProfile({ displayName: e.target.value || null })
            }
            onBlur={() => toast("Saved")}
          />
        </div>

        <div className="border-t border-border pt-5 space-y-3">
          <h2 className="section-label">Goal</h2>
          <div className="flex flex-wrap gap-3">
            {GOALS.map((g) => (
              <button
                key={g.key}
                onClick={() => {
                  updateProfile({ goal: g.key });
                  toast("Saved");
                }}
                className={`rounded-full border px-5 py-3 text-base font-semibold transition-colors ${
                  profile.goal === g.key
                    ? "border-accent bg-accent text-onAccent"
                    : "border-border bg-surface2 text-inkSoft hover:bg-border/60"
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-border pt-5 space-y-3">
          <h2 className="section-label">Experience</h2>
          <div className="flex flex-wrap gap-3">
            {LEVELS.map((l) => (
              <button
                key={l.key}
                onClick={() => {
                  updateProfile({ experience: l.key });
                  toast("Saved");
                }}
                className={`rounded-full border px-5 py-3 text-base font-semibold transition-colors ${
                  profile.experience === l.key
                    ? "border-accent bg-accent text-onAccent"
                    : "border-border bg-surface2 text-inkSoft hover:bg-border/60"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Preferences — appearance + units */}
      <section className="rounded-card border border-border bg-surface shadow-card p-6 space-y-5">
        <div className="space-y-3">
          <h2 className="section-label">Appearance</h2>
          <ThemeToggle />
        </div>

        <div className="border-t border-border pt-5 space-y-3">
          <h2 className="section-label">Units</h2>
          <div className="grid grid-cols-2 overflow-hidden rounded-control border border-border">
            {(["kg", "lb"] as Units[]).map((u) => (
              <button
                key={u}
                onClick={() => {
                  setUnits(u);
                  toast("Saved");
                }}
                className={`py-4 text-base font-semibold transition-colors ${
                  units === u
                    ? "bg-accent text-onAccent"
                    : "bg-surface2 text-inkSoft hover:bg-border/60"
                }`}
              >
                {u}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Account — session status + quiet, low-emphasis account actions */}
      <section className="rounded-card border border-border bg-surface shadow-card p-6 space-y-5">
        <div className="space-y-2">
          <h2 className="section-label">Account</h2>
          <p className="text-body-sm text-inkSoft">
            {session?.mode === "account" ? (
              <>
                Signed in as <b className="text-ink">{session.email}</b>.
              </>
            ) : (
              <>
                <b className="text-ink">Guest</b> — data is stored on this
                device only. Sign in to sync across devices (available once
                Supabase is connected). Role:{" "}
                <b className="text-ink">{profile.role}</b>.
              </>
            )}
          </p>
        </div>

        {isTrainerOrAdmin && (
          <div className="border-t border-border pt-2 -mx-6">
            <Link
              href="/trainer"
              className="flex items-center justify-between px-6 py-3 text-base text-ink hover:bg-border/60 transition-colors"
            >
              <span>🧑‍🏫 Trainer · clients</span>
              <span className="text-muted">→</span>
            </Link>
            {isAdmin && (
              <Link
                href="/admin"
                className="flex items-center justify-between px-6 py-3 text-base text-ink hover:bg-border/60 transition-colors border-t border-border"
              >
                <span>⚙️ Admin panel</span>
                <span className="text-muted">→</span>
              </Link>
            )}
          </div>
        )}

        <div className="border-t border-border pt-4 text-center">
          <button
            className="text-sm font-semibold text-inkSoft hover:text-ink transition-colors"
            onClick={exit}
          >
            {session?.mode === "account"
              ? "Sign out"
              : "Switch account / sign in"}
          </button>
        </div>
      </section>
    </main>
  );
}
