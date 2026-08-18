"use client";

import { useState } from "react";
import {
  Dumbbell,
  TrendingUp,
  Flame,
  HeartPulse,
  Sprout,
  Activity,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { useStore } from "@/lib/store";
import type { UserProfile, Units } from "@/domain/types";

const GOALS: {
  key: NonNullable<UserProfile["goal"]>;
  label: string;
  blurb: string;
  icon: LucideIcon;
}[] = [
  { key: "strength", label: "Get stronger", blurb: "Heavier lifts, more reps", icon: Dumbbell },
  { key: "hypertrophy", label: "Build muscle", blurb: "Size and definition", icon: TrendingUp },
  { key: "fat_loss", label: "Lose fat", blurb: "Lean out, stay strong", icon: Flame },
  { key: "health", label: "Stay healthy", blurb: "Move well, feel good", icon: HeartPulse },
];
const LEVELS: {
  key: NonNullable<UserProfile["experience"]>;
  label: string;
  blurb: string;
  icon: LucideIcon;
}[] = [
  { key: "beginner", label: "Beginner", blurb: "0–1 year training", icon: Sprout },
  { key: "intermediate", label: "Intermediate", blurb: "1–3 years training", icon: Activity },
  { key: "advanced", label: "Advanced", blurb: "3+ years training", icon: Trophy },
];

/** One-screen onboarding (local). Real cross-device accounts come with the backend phase. */
export function Onboarding({ onUseAiOnboarding }: { onUseAiOnboarding?: () => void }) {
  const setUnits = useStore((s) => s.setUnits);
  const units = useStore((s) => s.units);
  const completeOnboarding = useStore((s) => s.completeOnboarding);
  const [goal, setGoal] = useState<UserProfile["goal"]>(null);
  const [experience, setExperience] = useState<UserProfile["experience"]>(null);

  return (
    <main className="flex min-h-screen flex-col">
      <div className="bg-gradient-to-br from-accentPressed via-accent to-accentHover px-6 pb-10 pt-14 text-center">
        <p className="section-label mb-2 text-onAccent/70">Quick setup</p>
        <h1 className="text-h1 text-onAccent">Set up your training</h1>
        <p className="mx-auto mt-1.5 max-w-xs text-body-sm text-onAccent/80">
          A couple of taps and you’re training.
        </p>
      </div>

      <div className="-mt-6 flex-1 px-6 pb-8">
        <div className="card mx-auto w-full max-w-2xl space-y-7 shadow-elevated">
          <Section title="Units">
            <div className="flex overflow-hidden rounded-control border border-border text-sm">
              {(["kg", "lb"] as Units[]).map((u) => (
                <button
                  key={u}
                  onClick={() => setUnits(u)}
                  className={`flex-1 py-2.5 font-semibold transition-colors ${
                    units === u
                      ? "bg-accentFill text-onAccent"
                      : "bg-surface2 text-inkSoft hover:bg-border/60"
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </Section>

          <Section title="Your goal">
            <IconCards options={GOALS} value={goal} onPick={(k) => setGoal(k)} />
          </Section>

          <Section title="Experience">
            <IconCards options={LEVELS} value={experience} onPick={(k) => setExperience(k)} />
          </Section>

          <button
            className="btn-primary w-full py-3.5 text-base"
            onClick={() => completeOnboarding({ goal, experience, role: "user" })}
          >
            Start training →
          </button>
          <p className="text-center text-xs text-muted">
            Your data stays on this device. Cloud sync &amp; coaching arrive with accounts.
          </p>

          {onUseAiOnboarding && (
            <div className="border-t border-border pt-4">
              <button
                className="btn-ghost w-full py-3 text-sm"
                onClick={onUseAiOnboarding}
              >
                ✨ Use AI-Powered Onboarding Instead
              </button>
            </div>
          )}
        </div>
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

function IconCards<T extends string>({
  options,
  value,
  onPick,
}: {
  options: { key: T; label: string; blurb: string; icon: LucideIcon }[];
  value: T | null;
  onPick: (k: T) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {options.map((o) => {
        const active = value === o.key;
        const Icon = o.icon;
        return (
          <button
            key={o.key}
            onClick={() => onPick(o.key)}
            className={`flex flex-col items-start gap-2.5 rounded-card border p-4 text-left transition-colors duration-150 ${
              active
                ? "border-accentFill bg-accentFill text-onAccent"
                : "border-border bg-surface2 text-ink hover:bg-border/60"
            }`}
          >
            <Icon
              className={active ? "text-onAccent" : "text-accent"}
              size={22}
              strokeWidth={2}
            />
            <span>
              <span className="block text-sm font-semibold leading-tight">
                {o.label}
              </span>
              <span
                className={`block text-xs leading-tight ${active ? "text-onAccent/75" : "text-muted"}`}
              >
                {o.blurb}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
