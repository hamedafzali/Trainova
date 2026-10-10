"use client";

import { useState } from "react";
import {
  Activity,
  ArrowLeft,
  Building2,
  Check,
  ChevronDown,
  Clock,
  Cog,
  Dumbbell,
  Flame,
  HeartPulse,
  PersonStanding,
  Sparkles,
  Sprout,
  TrendingUp,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { PROGRAM_BLUEPRINTS, recommendBlueprint, type ProgramBlueprint, type ProgramSetting } from "@/data/programs";
import { label } from "@/domain/taxonomy";
import type { UserProfile, Units } from "@/domain/types";

type Option<T extends string> = { key: T; label: string; blurb: string; icon: LucideIcon };

const GOALS: Option<NonNullable<UserProfile["goal"]>>[] = [
  { key: "strength", label: "Get stronger", blurb: "Heavier lifts, more reps", icon: Dumbbell },
  { key: "hypertrophy", label: "Build muscle", blurb: "Size and definition", icon: TrendingUp },
  { key: "fat_loss", label: "Lose fat", blurb: "Lean out, stay strong", icon: Flame },
  { key: "health", label: "Stay healthy", blurb: "Move well, feel good", icon: HeartPulse },
];
const LEVELS: Option<NonNullable<UserProfile["experience"]>>[] = [
  { key: "beginner", label: "New to lifting", blurb: "Less than a year", icon: Sprout },
  { key: "intermediate", label: "Some experience", blurb: "1–3 years of training", icon: Activity },
  { key: "advanced", label: "Experienced", blurb: "3+ years, know the lifts", icon: Trophy },
];
const SETTINGS: Option<ProgramSetting>[] = [
  { key: "gym", label: "Full gym", blurb: "Barbells, machines, cables", icon: Building2 },
  { key: "machines", label: "Mostly machines", blurb: "Guided, beginner-friendly", icon: Cog },
  { key: "dumbbells", label: "Dumbbells", blurb: "Home gym or busy floor", icon: Dumbbell },
  { key: "bodyweight", label: "No equipment", blurb: "Bodyweight anywhere", icon: PersonStanding },
];
const DAYS = [2, 3, 4, 5];
const STEPS = ["Goal", "Experience", "Schedule", "Equipment", "Program"] as const;

/** Guided setup: a few questions, then a matching program is installed. */
export function Onboarding({ onUseAiOnboarding }: { onUseAiOnboarding?: () => void }) {
  const setUnits = useStore((s) => s.setUnits);
  const units = useStore((s) => s.units);
  const completeOnboarding = useStore((s) => s.completeOnboarding);
  const installProgram = useStore((s) => s.installProgram);
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<UserProfile["goal"]>(null);
  const [experience, setExperience] = useState<UserProfile["experience"]>(null);
  const [days, setDays] = useState<number | null>(null);
  const [setting, setSetting] = useState<ProgramSetting | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);

  const recommended = recommendBlueprint({ goal, experience, daysPerWeek: days, setting });
  const pick = PROGRAM_BLUEPRINTS.find((b) => b.id === chosen) ?? recommended;
  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));
  const finish = (blueprintId: string | null) => {
    if (blueprintId) installProgram(blueprintId);
    completeOnboarding({ goal, experience, role: "user" });
  };

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-xl flex-col px-4 pb-8 pt-6 sm:pt-12">
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          aria-label="Back"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          className={`grid h-9 w-9 place-items-center rounded-control text-muted hover:bg-surface2 hover:text-ink ${step === 0 ? "invisible" : ""}`}
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </button>
        <div
          className="flex flex-1 gap-1.5"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
          aria-valuenow={step + 1}
          aria-label="Setup progress"
        >
          {STEPS.map((s, i) => (
            <span key={s} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-accent" : "bg-border"}`} />
          ))}
        </div>
        <span className="w-9 text-right text-xs tabular-nums text-muted">
          {step + 1}/{STEPS.length}
        </span>
      </div>

      <div key={step} className="enter-fade flex-1 space-y-6">
        {step === 0 && (
          <>
            <Heading title="What's your main goal?" sub="We'll pick sets, reps and a program to match." />
            <Cards options={GOALS} value={goal} onPick={(k) => { setGoal(k); next(); }} />
          </>
        )}
        {step === 1 && (
          <>
            <Heading title="How experienced are you?" sub="Beginners get simpler, machine-friendly programs." />
            <Cards options={LEVELS} value={experience} onPick={(k) => { setExperience(k); next(); }} columns={1} />
          </>
        )}
        {step === 2 && (
          <>
            <Heading title="How many days a week can you train?" sub="Be realistic — consistency beats volume." />
            <div className="grid grid-cols-4 gap-2">
              {DAYS.map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={days === d}
                  onClick={() => {
                    setDays(d);
                    next();
                  }}
                  className={`rounded-card border py-5 text-center transition-colors ${
                    days === d ? "border-accentFill bg-accentFill text-onAccent" : "border-border bg-surface hover:bg-surface2"
                  }`}
                >
                  <span className="block text-2xl font-bold tabular-nums">{d}{d === 5 ? "+" : ""}</span>
                  <span className={`text-xs ${days === d ? "text-onAccent/80" : "text-muted"}`}>days</span>
                </button>
              ))}
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-ink">Weight unit</p>
              <div role="radiogroup" aria-label="Weight unit" className="grid grid-cols-2 gap-2">
                {(["kg", "lb"] as Units[]).map((u) => (
                  <button
                    key={u}
                    type="button"
                    role="radio"
                    aria-checked={units === u}
                    onClick={() => setUnits(u)}
                    className={`rounded-control border py-2.5 text-sm font-semibold transition-colors ${
                      units === u ? "border-accentFill bg-accentFill text-onAccent" : "border-border bg-surface text-inkSoft"
                    }`}
                  >
                    {u === "kg" ? "Kilograms (kg)" : "Pounds (lb)"}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
        {step === 3 && (
          <>
            <Heading title="Where do you train?" sub="We'll only use equipment you have." />
            <Cards options={SETTINGS} value={setting} onPick={(k) => { setSetting(k); setChosen(null); next(); }} />
          </>
        )}
        {step === 4 && (
          <>
            <Heading title="Your program" sub="Recommended from your answers. You can edit every exercise later." />
            <ProgramCard bp={pick} recommended={pick.id === recommended.id} />
            <details className="group">
              <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-sm font-semibold text-accent [&::-webkit-details-marker]:hidden">
                Choose a different program
                <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <ul className="mt-3 space-y-2">
                {PROGRAM_BLUEPRINTS.filter((b) => b.id !== pick.id).map((b) => (
                  <li key={b.id}>
                    <button
                      type="button"
                      onClick={() => setChosen(b.id)}
                      className="flex w-full items-center gap-3 rounded-control border border-border bg-surface p-3 text-left hover:bg-surface2"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-ink">{b.name}</span>
                        <span className="block text-xs text-muted">
                          {b.daysPerWeek}×/week · {label(b.level)} · ~{b.minutes} min
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          </>
        )}
      </div>

      <div className="mt-8 space-y-3">
        {step === 4 ? (
          <>
            <button className="btn-primary w-full py-3.5 text-base" onClick={() => finish(pick.id)}>
              <Check className="h-5 w-5" aria-hidden /> Start with {pick.name}
            </button>
            <button className="btn-ghost w-full" onClick={() => finish(null)}>
              Skip — I&apos;ll build my own plan
            </button>
          </>
        ) : (
          <button className="btn-secondary w-full" onClick={next}>
            {step === 2 ? "Continue" : "Skip this question"}
          </button>
        )}
        {onUseAiOnboarding && step === 0 && (
          <button className="btn-ghost w-full text-sm" onClick={onUseAiOnboarding}>
            <Sparkles className="h-4 w-4" aria-hidden /> Set up with the AI coach instead
          </button>
        )}
        <p className="text-center text-xs text-muted">Your answers stay on this device and can be changed in Profile.</p>
      </div>
    </main>
  );
}

function Heading({ title, sub }: { title: string; sub: string }) {
  return (
    <div>
      <h1 className="text-h1 text-ink">{title}</h1>
      <p className="mt-1 text-sm text-inkSoft">{sub}</p>
    </div>
  );
}

function ProgramCard({ bp, recommended }: { bp: ProgramBlueprint; recommended: boolean }) {
  return (
    <div className="card space-y-3 border-accent/30 p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xl font-bold text-ink">{bp.name}</p>
        {recommended && <span className="badge-accent shrink-0">Best match</span>}
      </div>
      <p className="text-sm text-inkSoft">{bp.summary}</p>
      <div className="flex flex-wrap gap-1.5 text-xs">
        <span className="badge-neutral">{bp.daysPerWeek}× / week</span>
        <span className="badge-neutral">{label(bp.level)}</span>
        <span className="badge-neutral inline-flex items-center gap-1">
          <Clock className="h-3 w-3" aria-hidden /> ~{bp.minutes} min
        </span>
      </div>
      <ul className="space-y-1 border-t border-border pt-3 text-sm">
        {bp.days.map((d) => (
          <li key={d.name} className="flex justify-between gap-3">
            <span className="font-medium text-ink">{d.name}</span>
            <span className="truncate text-muted">{d.focus}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Cards<T extends string>({
  options,
  value,
  onPick,
  columns = 2,
}: {
  options: Option<T>[];
  value: T | null;
  onPick: (k: T) => void;
  columns?: 1 | 2;
}) {
  return (
    <div className={`grid gap-3 ${columns === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
      {options.map((o) => {
        const active = value === o.key;
        const Icon = o.icon;
        return (
          <button
            key={o.key}
            type="button"
            aria-pressed={active}
            onClick={() => onPick(o.key)}
            className={`flex items-start gap-3 rounded-card border p-4 text-left transition-colors duration-150 ${
              columns === 2 ? "flex-col" : "flex-row items-center"
            } ${active ? "border-accentFill bg-accentFill text-onAccent" : "border-border bg-surface text-ink hover:bg-surface2"}`}
          >
            <Icon className={active ? "text-onAccent" : "text-accent"} size={22} strokeWidth={2} aria-hidden />
            <span>
              <span className="block text-sm font-semibold leading-tight">{o.label}</span>
              <span className={`mt-0.5 block text-xs leading-tight ${active ? "text-onAccent/75" : "text-muted"}`}>{o.blurb}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
