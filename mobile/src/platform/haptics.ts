// Native stand-in for src/lib/haptics.ts, on the Taptic Engine / vibrator.
import * as Haptics from "expo-haptics";

export type Haptic = "tick" | "pr" | "finish" | "restOver";

export function haptic(kind: Haptic): void {
  const run = async () => {
    if (kind === "tick") return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (kind === "pr") return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (kind === "finish") return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  };
  run().catch(() => undefined);
}
