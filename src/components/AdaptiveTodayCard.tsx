"use client";

import { recommendToday } from "@/domain/adaptive";
import { useStore } from "@/lib/store";

export function AdaptiveTodayCard({ onStart }: { onStart: (templateId: string) => void }) {
  const templates = useStore((state) => state.templates);
  const programs = useStore((state) => state.programs);
  const sessions = useStore((state) => state.sessions);
  const feedback = useStore((state) => state.feedback);
  const recommendation = recommendToday({ templates, programs, sessions, feedback });

  if (!recommendation) return null;

  return (
    <section className={`card border-l-4 ${recommendation.mode === "recovery" ? "border-amber-400" : "border-blue-500"}`}>
      <p className="section-label">Adaptive Today</p>
      <h2 className="mt-1 text-xl font-bold text-white">{recommendation.headline}</h2>
      <p className="mt-2 text-base font-semibold text-white">{recommendation.planName}</p>
      <p className="mt-1 text-sm leading-6 text-white/60">{recommendation.reason}</p>
      <button className="btn-primary mt-4 w-full py-4" onClick={() => onStart(recommendation.templateId)}>
        {recommendation.mode === "recovery" ? "Start controlled session" : "Start recommended session"}
      </button>
    </section>
  );
}
