import type { Exercise } from "@/domain/types";

/** Pulls a machine/floor number out of a name like "Leg Press (No.22)" → "22". */
export function machineNo(name: string): string | null {
  const m = name.match(/no\.?\s*(\d+)/i);
  return m ? m[1] : null;
}

/** Name without the "(No.x)" suffix, for cleaner display next to a number badge. */
export function cleanName(name: string): string {
  return name.replace(/\s*\(no\.?\s*\d+\)\s*/i, "").trim();
}

/** Short label for an exercise: its machine number if present, else first letters. */
export function exerciseBadge(ex: Pick<Exercise, "name">): string {
  return machineNo(ex.name) ?? cleanName(ex.name).slice(0, 2).toUpperCase();
}
