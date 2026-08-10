"use client";

import { useState } from "react";
import type { SessionDifficulty } from "@/domain/types";

export function SessionFeedbackForm({
  onSubmit,
  onSkip,
}: {
  onSubmit: (input: {
    difficulty: SessionDifficulty;
    energy: 1 | 2 | 3 | 4 | 5;
    confidence: 1 | 2 | 3 | 4 | 5;
    pain: string | null;
    completedInMinutes: number | null;
  }) => void;
  onSkip: () => void;
}) {
  const [difficulty, setDifficulty] = useState<SessionDifficulty>("right");
  const [energy, setEnergy] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [confidence, setConfidence] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [pain, setPain] = useState("");

  return (
    <div className="card space-y-5 border-blue-500/30">
      <div>
        <p className="section-label">One-minute check-in</p>
        <h2 className="mt-1 text-xl font-bold text-white">How did that feel?</h2>
        <p className="mt-1 text-sm text-white/60">Your answer adjusts the next recommendation.</p>
      </div>
      <FeedbackScale label="Difficulty" value={difficulty} options={["easy", "right", "hard"]} onPick={setDifficulty} />
      <FeedbackScale label="Energy" value={energy} options={[1, 2, 3, 4, 5] as const} onPick={setEnergy} />
      <FeedbackScale label="Confidence" value={confidence} options={[1, 2, 3, 4, 5] as const} onPick={setConfidence} />
      <label className="block text-sm text-white/70">
        Pain or limitation? <span className="text-white/40">Optional</span>
        <input
          className="input mt-2"
          value={pain}
          onChange={(event) => setPain(event.target.value)}
          placeholder="Where and when did it occur?"
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <button className="btn-ghost py-4" onClick={onSkip}>Skip</button>
        <button
          className="btn-primary py-4"
          onClick={() => onSubmit({
            difficulty,
            energy,
            confidence,
            pain: pain.trim() || null,
            completedInMinutes: null,
          })}
        >
          Save & finish
        </button>
      </div>
    </div>
  );
}

function FeedbackScale<T extends string | number>({
  label,
  value,
  options,
  onPick,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onPick: (value: T) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-white/70">{label}</p>
      <div className="grid grid-cols-3 gap-2">
        {options.map((option) => (
          <button
            key={option}
            className={`rounded-xl px-3 py-3 text-sm font-semibold transition-colors ${
              value === option ? "bg-blue-600 text-white" : "bg-white/[0.04] text-white/60 hover:bg-white/[0.08]"
            }`}
            onClick={() => onPick(option)}
          >
            {typeof option === "string" ? option[0].toUpperCase() + option.slice(1) : option}
          </button>
        ))}
      </div>
    </div>
  );
}
