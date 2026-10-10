import Image from "next/image";
import { Cable, Cog, Dumbbell, HeartPulse, PersonStanding, type LucideIcon } from "lucide-react";
import type { Device, DeviceCategory } from "@/domain/types";

const CATEGORY_ICON: Record<DeviceCategory, LucideIcon> = {
  machine: Cog,
  free_weight: Dumbbell,
  cable: Cable,
  bodyweight: PersonStanding,
  cardio: HeartPulse,
};

/**
 * Visual device avatar: the device's bundled image when present, else its
 * machine number, else a category icon. Used everywhere a device appears so
 * equipment looks consistent across the app.
 */
export function DeviceAvatar({
  device,
  className = "h-11 w-11 rounded-xl text-base",
}: {
  device?: Device;
  className?: string;
}) {
  const hasImg = Boolean(device?.imageUrl);
  const numbered = Boolean(device?.machineNumber);
  const Icon = CATEGORY_ICON[device?.category ?? "free_weight"] ?? Dumbbell;
  return (
    <span
      className={`relative flex shrink-0 items-center justify-center overflow-hidden font-bold ${className} ${
        hasImg ? "bg-bg p-1" : numbered ? "bg-accentFill text-onAccent" : "bg-surface2 text-inkSoft"
      }`}
    >
      {hasImg ? (
        <Image src={device!.imageUrl!} alt={device!.name} fill sizes="64px" className="object-contain" />
      ) : numbered ? (
        device!.machineNumber
      ) : (
        <Icon className="h-[55%] w-[55%]" strokeWidth={1.75} aria-hidden />
      )}
    </span>
  );
}
