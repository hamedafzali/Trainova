"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import type { UserProfile, Units } from "@/domain/types";

const GOALS: { key: NonNullable<UserProfile["goal"]>; label: string }[] = [
  { key: "strength", label: "Get stronger" },
  { key: "hypertrophy", label: "Build muscle" },
  { key: "fat_loss", label: "Lose fat" },
  { key: "health", label: "Stay healthy" },
];
const LEVELS: { key: NonNullable<UserProfile["experience"]>; label: string }[] = [
  { key: "beginner", label: "Beginner" },
  { key: "intermediate", label: "Intermediate" },
  { key: "advanced", label: "Advanced" },
];

/** One-screen onboarding (local). Real cross-device accounts come with the backend phase. */
export function Onboarding() {
  const setUnits = useStore((s) => s.setUnits);
  const units = useStore((s) => s.units);
  const completeOnboarding = useStore((s) => s.completeOnboarding);
  const [goal, setGoal] = useState<UserProfile["goal"]>(null);
  const [experience, setExperience] = useState<UserProfile["experience"]>(null);

  return (
    <main className="flex min-h-screen flex-col justify-center p-6">
      <div className="card mx-auto w-full max-w-md space-y-6">
        <header>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Welcome to Trainova
          </h1>
          <p className="mt-1 text-sm text-white/50">
            A couple of taps and you’re training.
          </p>
        </header>

        <Section title="Units">
          <div className="flex overflow-hidden rounded-xl border border-white/10 text-sm">
            {(["kg", "lb"] as Units[]).map((u) => (
              <button
                key={u}
                onClick={() => setUnits(u)}
                className={`flex-1 py-2.5 font-semibold transition-colors ${
                  units === u
                    ? "bg-blue-600 text-white"
                    : "bg-white/[0.03] text-white/60 hover:bg-white/[0.07]"
                }`}
              >
                {u}
              </button>
            ))}
          </div>
        </Section>

        <Section title="Your goal">
          <Chips options={GOALS} value={goal} onPick={(k) => setGoal(k)} />
        </Section>

        <Section title="Experience">
          <Chips options={LEVELS} value={experience} onPick={(k) => setExperience(k)} />
        </Section>

        <button
          className="btn-primary w-full py-3.5 text-base"
          onClick={() => completeOnboarding({ goal, experience, role: "user" })}
        >
          Start training →
        </button>
        <p className="text-center text-xs text-white/40">
          Your data stays on this device. Cloud sync &amp; coaching arrive with accounts.
        </p>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="section-label">{title}</h2>
      {children}
    </section>
  );
}

function Chips<T extends string>({
  options,
  value,
  onPick,
}: {
  options: { key: T; label: string }[];
  value: T | null;
  onPick: (k: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => onPick(o.key)}
          className={`rounded-full border px-4 py-2 text-sm transition-colors ${
            value === o.key
              ? "border-blue-600 bg-blue-600 text-white"
              : "border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.07]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
