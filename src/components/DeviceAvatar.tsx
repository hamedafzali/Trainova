import Image from "next/image";
import { deviceBadge } from "@/lib/format";
import type { Device } from "@/domain/types";

/**
 * Visual device avatar: the device's bundled image when present, else a
 * category-coloured badge (machine number / category icon). Used everywhere a
 * device appears so equipment looks consistent across the app.
 */
export function DeviceAvatar({
  device,
  className = "h-11 w-11 rounded-xl text-base",
}: {
  device?: Device;
  className?: string;
}) {
  const hasImg = Boolean(device?.imageUrl);
  const machine = device?.category === "machine";
  return (
    <span
      className={`relative flex shrink-0 items-center justify-center overflow-hidden font-bold ${className} ${
        hasImg ? "bg-bg p-1" : machine ? "bg-accentFill text-onAccent" : "bg-surface2 text-ink"
      }`}
    >
      {hasImg ? (
        <Image
          src={device!.imageUrl!}
          alt={device!.name}
          fill
          sizes="64px"
          className="object-contain"
        />
      ) : (
        deviceBadge(device)
      )}
    </span>
  );
}
