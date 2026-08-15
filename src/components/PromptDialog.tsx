"use client";

import { useEffect, useRef, useState } from "react";
import { useDialogA11y } from "@/lib/useDialogA11y";

export function PromptDialog({
  open,
  title,
  body,
  label,
  placeholder,
  confirmLabel = "Save",
  cancelLabel = "Cancel",
  minLength,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body?: string;
  label: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  minLength?: number;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState("");
  useDialogA11y(open, onCancel, panelRef);

  useEffect(() => {
    if (open) setValue("");
  }, [open]);

  if (!open) return null;

  const trimmed = value.trim();
  const invalid = minLength != null && trimmed.length > 0 && trimmed.length < minLength;
  const canSubmit = trimmed.length > 0 && !invalid;

  const submit = () => {
    if (!canSubmit) return;
    onConfirm(trimmed);
  };

  return (
    <div
      className="sheet-enter-backdrop fixed inset-0 z-50 flex items-end bg-black/60 p-4 md:items-center md:justify-center"
      onClick={onCancel}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        data-testid="prompt-dialog"
        className="sheet-enter-panel enter-fade w-full max-w-sm rounded-sheet border border-border bg-surface shadow-elevated p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-1.5">
          <h2 className="text-h3 font-semibold text-ink">{title}</h2>
          {body && <p className="text-body-sm text-inkSoft">{body}</p>}
        </div>
        <div className="space-y-1.5">
          <label htmlFor="prompt-dialog-input" className="text-caption text-inkSoft">
            {label}
          </label>
          <input
            id="prompt-dialog-input"
            type="password"
            autoComplete="new-password"
            className="input"
            placeholder={placeholder}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            data-testid="prompt-dialog-input"
          />
          {invalid && minLength != null && (
            <p className="text-caption text-danger">Must be at least {minLength} characters.</p>
          )}
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost flex-1" onClick={onCancel} data-testid="prompt-dialog-cancel">
            {cancelLabel}
          </button>
          <button
            className="btn-primary flex-1"
            onClick={submit}
            disabled={!canSubmit}
            data-testid="prompt-dialog-confirm"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
