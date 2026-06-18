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

/** Remove a trailing date suffix from a name (templates must be undated). */
export function stripDate(name: string): string {
  return name
    .replace(/\s*[—–-]\s*\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?\s*$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
