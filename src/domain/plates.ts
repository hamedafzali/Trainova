// Plate math for bar exercises: which plates go on each side of the bar for a
// logged total. Works in display units (kg or lb) because gyms stock plates in
// one system; the caller converts from the stored kilograms first.

import type { Equipment } from "./taxonomy";
import type { Units } from "./types";

/** Empty-bar weight per bar type, in each unit system's usual bar. */
const BARS: Partial<Record<Equipment, Record<Units, number>>> = {
  barbell: { kg: 20, lb: 45 },
  ez_bar: { kg: 10, lb: 25 },
  trap_bar: { kg: 25, lb: 55 },
};

/** Standard plates, heaviest first. */
export const PLATES: Record<Units, number[]> = {
  kg: [25, 20, 15, 10, 5, 2.5, 1.25],
  lb: [45, 35, 25, 10, 5, 2.5],
};

/** Empty-bar weight for this equipment, or null when it isn't loaded on a bar. */
export function barWeight(equipment: Equipment | null | undefined, units: Units): number | null {
  if (!equipment) return null;
  return BARS[equipment]?.[units] ?? null;
}

export interface PlateLoad {
  bar: number;
  /** Plates for ONE side, heaviest first. */
  perSide: number[];
  /** Weight that standard plates can't make up (0 when the load is exact). */
  remainder: number;
  /** The total is lighter than the empty bar. */
  belowBar: boolean;
}

/**
 * Greedy plate breakdown. Standard plate sets are "canonical", so greedy gives
 * the fewest plates. Works in hundredths to dodge float drift (2.5 + 1.25…).
 */
export function loadPlates(total: number, bar: number, units: Units): PlateLoad {
  if (total < bar) return { bar, perSide: [], remainder: 0, belowBar: true };
  let side = Math.round(((total - bar) / 2) * 100);
  const perSide: number[] = [];
  for (const p of PLATES[units]) {
    const c = Math.round(p * 100);
    while (side >= c) {
      perSide.push(p);
      side -= c;
    }
  }
  return { bar, perSide, remainder: (side * 2) / 100, belowBar: false };
}
