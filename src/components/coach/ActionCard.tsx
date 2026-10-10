"use client";

import Link from "next/link";
import { useState } from "react";
import { Check } from "lucide-react";
import { describeAction, type TrainerAction } from "@/domain/trainer";
import { applyTrainerAction } from "@/lib/trainerActions";
import { useStore } from "@/lib/store";

/** One proposed plan change with an Apply button. */
export function ActionCard({
  action,
  applied,
  onApplied,
}: {
  action: TrainerAction;
  applied: boolean;
  onApplied: () => void;
}) {
  const [href, setHref] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { title, detail } = describeAction(action);
  // What the plan says today, so the change reads as before → after.
  const before = useStore((s) => {
    if (action.type !== "set_volume") return null;
    const te = s.templates.find((t) => t.id === action.templateId)?.exercises.find((x) => x.id === action.teId);
    if (!te || te.sets.length === 0) return null;
    const reps = [...new Set(te.sets.map((x) => x.targetReps))];
    return `${te.sets.length} × ${reps.length === 1 ? reps[0] : `${Math.min(...reps)}–${Math.max(...reps)}`}`;
  });
  return (
    <li className="flex items-center gap-3 rounded-control border border-border bg-surface px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">
          {title}
          {before && !applied && <span className="ml-1.5 font-normal text-muted">(now {before})</span>}
        </p>
        <p className={`truncate text-xs ${error ? "text-danger" : "text-muted"}`}>{error ?? detail}</p>
      </div>
      {applied ? (
        href ? (
          <Link href={href} className="inline-flex shrink-0 animate-popIn items-center gap-1 text-sm font-semibold text-green">
            <Check className="h-4 w-4" aria-hidden /> View
          </Link>
        ) : (
          <span className="inline-flex shrink-0 animate-popIn items-center gap-1 text-sm font-semibold text-green">
            <Check className="h-4 w-4" aria-hidden /> Applied
          </span>
        )
      ) : (
        <button
          type="button"
          className="btn-primary shrink-0 px-3 py-1.5 text-sm"
          onClick={() => {
            const r = applyTrainerAction(action);
            if (r.ok) {
              setHref(r.href);
              onApplied();
            } else setError(r.error);
          }}
        >
          Apply
        </button>
      )}
    </li>
  );
}
