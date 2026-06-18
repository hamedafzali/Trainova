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
      className={`flex shrink-0 items-center justify-center overflow-hidden font-bold ${className} ${
        hasImg ? "bg-bg p-1" : machine ? "bg-accent text-onAccent" : "bg-surface2 text-ink"
      }`}
    >
      {hasImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={device!.imageUrl!} alt={device!.name} className="h-full w-full object-contain" />
      ) : (
        deviceBadge(device)
      )}
    </span>
  );
}
