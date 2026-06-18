import type { Device, DeviceCategory } from "@/domain/types";

const ICONS: Record<DeviceCategory, string> = {
  machine: "🏋️",
  free_weight: "🔩",
  cable: "🪢",
  bodyweight: "🤸",
  cardio: "🏃",
};

export function categoryIcon(c: DeviceCategory): string {
  return ICONS[c] ?? "🏋️";
}

/** Short badge for a device: its machine number, else a category icon. */
export function deviceBadge(d: Device | undefined): string {
  if (!d) return "•";
  return d.machineNumber ?? categoryIcon(d.category);
}

/** A warm dot colour for a muscle group, used as a quick visual tag. */
export function muscleColor(muscle: string | null | undefined): string {
  const m = (muscle ?? "").toLowerCase();
  if (/quad|leg|ham|glute|calf/.test(m)) return "#7C8254"; // olive
  if (/back|lat/.test(m)) return "#BC6B47"; // terracotta
  if (/chest|pec/.test(m)) return "#C98A5E"; // amber
  if (/shoulder|delt/.test(m)) return "#C7A24B"; // gold
  if (/bicep|tricep|arm/.test(m)) return "#9E5B3B"; // clay deep
  if (/ab|core/.test(m)) return "#6E9E6B"; // green
  return "#9A8B79"; // muted
}

/** Remove a trailing date suffix from a name (templates must be undated). */
export function stripDate(name: string): string {
  return name
    .replace(/\s*[—–-]\s*\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?\s*$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
