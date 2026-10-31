// Rest timer, native side: when a rest starts, a local notification is
// scheduled for its end so the phone buzzes even when locked or in a pocket.
// In the foreground the app's own bar shows the countdown and a haptic fires.
import { useEffect } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { AndroidImportance } from "expo-notifications";
import { useRestTimer } from "@/lib/restTimer";
import { haptic } from "@/lib/haptics";

const supported = Platform.OS === "ios" || Platform.OS === "android";

if (supported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: false,
      shouldShowList: false,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

let asked = false;
async function allowed(): Promise<boolean> {
  const now = await Notifications.getPermissionsAsync();
  if (now.granted) return true;
  if (asked || !now.canAskAgain) return false;
  asked = true;
  return (await Notifications.requestPermissionsAsync()).granted;
}

let scheduled: string | null = null;

async function schedule(endsAt: number | null) {
  if (scheduled) {
    await Notifications.cancelScheduledNotificationAsync(scheduled).catch(() => undefined);
    scheduled = null;
  }
  if (!endsAt) return;
  const seconds = Math.round((endsAt - Date.now()) / 1000);
  if (seconds < 3 || !(await allowed())) return;
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("rest", {
      name: "Rest timer",
      importance: AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 120, 250],
    });
  }
  scheduled = await Notifications.scheduleNotificationAsync({
    content: { title: "Rest over", body: "Time for your next set.", sound: true },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds, channelId: "rest" },
  });
}

export function useRestAlerts() {
  const endsAt = useRestTimer((s) => s.endsAt);
  useEffect(() => {
    if (supported) schedule(endsAt).catch(() => undefined);
    if (!endsAt) return;
    const t = setTimeout(() => haptic("restOver"), Math.max(0, endsAt - Date.now()));
    return () => clearTimeout(t);
  }, [endsAt]);
}
