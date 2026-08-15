"use client";

import { useRef } from "react";
import { useDialogA11y } from "@/lib/useDialogA11y";

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogA11y(open, onCancel, panelRef);

  if (!open) return null;

  return (
    <div
      className="sheet-enter-backdrop fixed inset-0 z-50 flex items-end bg-black/60 p-4 md:items-center md:justify-center"
      onClick={onCancel}
    >
      <div
        ref={panelRef}
        className="sheet-enter-panel enter-fade w-full max-w-sm rounded-sheet border border-border bg-surface shadow-elevated p-6 space-y-4"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        data-testid="confirm-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-1.5">
          <h2 className="text-h3 font-semibold text-ink">{title}</h2>
          {body && <p className="text-body-sm text-inkSoft">{body}</p>}
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost flex-1" onClick={onCancel} data-testid="confirm-dialog-cancel">
            {cancelLabel}
          </button>
          <button
            className={danger ? "btn-danger flex-1" : "btn-primary flex-1"}
            onClick={onConfirm}
            data-testid="confirm-dialog-confirm"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
