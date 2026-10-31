// Rest countdown pinned to the bottom of the workout screen while a timer
// runs. The buzz when it ends comes from features/restAlerts (haptic in the
// foreground, a local notification when the phone is locked).
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRestTimer } from "@/lib/restTimer";
import { Txt } from "~/ui/kit";
import { alpha, font, radius, usePalette } from "~/ui/theme";

function mmss(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function RestTimerBar() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { endsAt, duration, add, stop } = useRestTimer();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!endsAt) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [endsAt]);

  if (!endsAt) return null;
  const remainingSec = (endsAt - now) / 1000;
  const over = remainingSec <= 0;
  const pct = over ? 100 : Math.min(100, Math.max(0, ((duration - remainingSec) / duration) * 100));
  const fg = over ? "#FFFFFF" : p.ink;

  return (
    <View style={{ position: "absolute", left: 12, right: 12, bottom: insets.bottom + 10 }} accessibilityRole="timer" accessibilityLiveRegion="none">
      <View
        style={{
          borderRadius: radius.card,
          borderWidth: 1,
          overflow: "hidden",
          borderColor: over ? p.success : p.border,
          backgroundColor: over ? p.success : p.card,
          shadowColor: "#000",
          shadowOpacity: 0.18,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 6 },
          elevation: 8,
        }}
      >
        {!over ? <View style={{ height: 4, width: `${pct}%`, backgroundColor: p.accent }} /> : null}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10 }}>
          <View style={{ flex: 1, paddingLeft: 4 }}>
            <Txt v="eyebrow" color={over ? fg : p.muted} style={{ fontSize: 11 }}>
              {over ? "Rest over" : "Rest"}
            </Txt>
            <Text style={{ fontFamily: font.heavy, fontSize: 24, color: fg, fontVariant: ["tabular-nums"] }}>{over ? "Next set" : mmss(remainingSec)}</Text>
          </View>
          {!over ? (
            <>
              <TimerBtn label="−15" a11y="15 seconds less" onPress={() => add(-15)} bg={p.well} fg={p.ink} />
              <TimerBtn label="+15" a11y="15 seconds more" onPress={() => add(15)} bg={p.well} fg={p.ink} />
            </>
          ) : null}
          <TimerBtn
            label={over ? "Dismiss" : "Skip"}
            onPress={stop}
            bg={over ? alpha("#FFFFFF", 0.18) : p.accentFill}
            fg={over ? "#FFFFFF" : p.onAccent}
          />
        </View>
      </View>
    </View>
  );
}

function TimerBtn({ label, a11y, onPress, bg, fg }: { label: string; a11y?: string; onPress: () => void; bg: string; fg: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y ?? label}
      style={({ pressed }) => ({
        minHeight: 44,
        minWidth: 52,
        paddingHorizontal: 12,
        borderRadius: radius.control,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: bg,
        transform: [{ scale: pressed ? 0.95 : 1 }],
      })}
    >
      <Text style={{ fontFamily: font.bold, fontSize: 14, color: fg }}>{label}</Text>
    </Pressable>
  );
}
