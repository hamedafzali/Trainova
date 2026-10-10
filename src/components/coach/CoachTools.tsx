"use client";

import { Activity, CalendarPlus, Lightbulb, Target, Timer, TrendingUp, Wand2, type LucideIcon } from "lucide-react";
import { useCoachChat } from "@/lib/coachChat";

const TOOLS: { label: string; hint: string; icon: LucideIcon; prompt: string }[] = [
  {
    label: "Build a plan",
    hint: "A program for your goal",
    icon: CalendarPlus,
    prompt:
      "Build me a training plan that fits my goal, experience and how often I actually train. Make sensible assumptions instead of asking, and propose it as a program I can apply.",
  },
  {
    label: "Review my activity",
    hint: "Last 4 weeks vs your plan",
    icon: Activity,
    prompt:
      "Review my training over the last 4 weeks: how consistent I've been against my plan, what's progressing, what's stalling, and the one thing I should change.",
  },
  {
    label: "Improve my plan",
    hint: "Balance, volume, exercises",
    icon: Wand2,
    prompt:
      "Look at my current plan and suggest the most valuable improvements — muscle balance, weekly volume for my goal, and exercise choice. Propose changes I can apply.",
  },
  {
    label: "Prep next workout",
    hint: "Targets for every exercise",
    icon: Target,
    prompt:
      "Give me targets for my next workout: weight and reps for each exercise based on my recent sessions, plus one thing to focus on.",
  },
  {
    label: "Break a plateau",
    hint: "Lifts that stopped moving",
    icon: TrendingUp,
    prompt: "Which of my lifts are stalling or going backwards, why might that be, and what exactly should I change?",
  },
  {
    label: "Quick hints",
    hint: "3 tips for this week",
    icon: Lightbulb,
    prompt: "Give me 3 short, specific tips for this week based on my data — training, recovery or habits.",
  },
  {
    label: "Short on time",
    hint: "30-minute session",
    icon: Timer,
    prompt: "I only have 30 minutes today. Build a workout that fits my plan and goal, as something I can apply.",
  },
];

/** One-tap coaching requests; each is sent to the chat below. */
export function CoachTools({ disabled }: { disabled?: boolean }) {
  const queue = useCoachChat((s) => s.queue);
  return (
    <section aria-labelledby="coach-tools" className="space-y-2">
      <h2 id="coach-tools" className="section-label">
        Ask your coach to…
      </h2>
      {/* 7 tools: the last one widens to close its row at every column count. */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4 [&>*:last-child]:col-span-2 sm:[&>*:last-child]:col-span-3 xl:[&>*:last-child]:col-span-2">
        {TOOLS.map(({ label, hint, icon: Icon, prompt }) => (
          <button
            key={label}
            type="button"
            disabled={disabled}
            onClick={() => queue(prompt)}
            className="group flex items-start gap-2.5 rounded-card border border-border bg-surface p-3 text-left transition-all duration-200 ease-standard hover:-translate-y-0.5 hover:border-accent/40 hover:bg-surface2 hover:shadow-card active:translate-y-0 disabled:pointer-events-none disabled:opacity-50"
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-accent transition-transform duration-200 group-hover:scale-110" aria-hidden />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-ink">{label}</span>
              <span className="block text-xs text-muted">{hint}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
