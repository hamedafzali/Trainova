"use client";

import { useRef } from "react";
import { X } from "lucide-react";
import { ExerciseBrowser } from "@/components/ExerciseBrowser";
import { useDialogA11y } from "@/lib/useDialogA11y";

/**
 * Bottom sheet (centered dialog on desktop) for choosing an exercise. Returns
 * an exerciseId; the device comes from the exercise's structured link.
 */
export function ExercisePicker({
  onPick,
  onClose,
}: {
  onPick: (exerciseId: string) => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogA11y(true, onClose, panelRef);

  return (
    <div
      className="sheet-enter-backdrop fixed inset-0 z-40 flex items-end bg-black/60 md:items-center md:p-6"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        className="sheet-enter-panel enter-fade mx-auto flex h-[88dvh] w-full max-w-lg flex-col rounded-t-sheet border-t border-border bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:h-[80dvh] md:rounded-sheet md:border"
        role="dialog"
        aria-modal="true"
        aria-label="Choose exercise"
        tabIndex={-1}
        data-testid="exercise-picker"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-border md:hidden" />
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-h3 text-ink">Add exercise</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-11 w-11 place-items-center rounded-control text-muted hover:bg-surface2 hover:text-ink"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <ExerciseBrowser onSelect={onPick} />
      </div>
    </div>
  );
}
