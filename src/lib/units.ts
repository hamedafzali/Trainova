"use client";

import { useStore } from "./store";
import type { Units } from "@/domain/types";

// Weights are stored in kilograms everywhere. These helpers convert at the UI
// boundary so switching units never changes the logged data.

export const KG_PER_LB = 0.45359237;

export function toDisplay(kg: number, units: Units): number {
  return units === "kg" ? kg : kg / KG_PER_LB;
}

export function fromDisplay(value: number, units: Units): number {
  return units === "kg" ? value : value * KG_PER_LB;
}

/** Rounded display number: 0.5 kg / 1 lb precision, trailing zeros dropped. */
export function displayWeight(kg: number, units: Units): number {
  const v = toDisplay(kg, units);
  return units === "kg" ? Math.round(v * 2) / 2 : Math.round(v);
}

export function formatWeight(kg: number | null | undefined, units: Units, withUnit = true): string {
  if (kg == null) return "—";
  const v = displayWeight(kg, units);
  const s = Number.isInteger(v) ? String(v) : v.toFixed(1);
  return withUnit ? `${s} ${units}` : s;
}

/** Large totals (volume) — thousands separators, no decimals. */
export function formatVolume(kg: number, units: Units): string {
  return `${Math.round(toDisplay(kg, units)).toLocaleString()} ${units}`;
}

/** Stepper increment in display units (stack machines step finer in kg). */
export function weightStep(units: Units): number {
  return units === "kg" ? 2.5 : 5;
}

export function useUnits(): Units {
  return useStore((s) => s.units);
}
