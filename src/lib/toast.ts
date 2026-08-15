"use client";

export type ToastVariant = "neutral" | "success" | "error";
export type ToastMessage = {
  id: number;
  message: string;
  variant: ToastVariant;
  leaving: boolean;
};

let toasts: ToastMessage[] = [];
let nextId = 0;
const listeners = new Set<(toasts: ToastMessage[]) => void>();

function emit() {
  for (const listener of listeners) listener(toasts);
}

export function subscribeToasts(listener: (toasts: ToastMessage[]) => void) {
  listeners.add(listener);
  listener(toasts);
  return () => {
    listeners.delete(listener);
  };
}

export function dismissToast(id: number) {
  toasts = toasts.map((t) => (t.id === id ? { ...t, leaving: true } : t));
  emit();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    emit();
  }, 150);
}

export function toast(
  message: string,
  opts: { variant?: ToastVariant; duration?: number } = {},
) {
  const id = nextId++;
  toasts = [...toasts, { id, message, variant: opts.variant ?? "neutral", leaving: false }];
  emit();
  setTimeout(() => dismissToast(id), opts.duration ?? 2500);
  return id;
}
