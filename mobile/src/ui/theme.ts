// Trainova's colour tokens (src/app/globals.css) for native. The hero surfaces
// stay navy with lime in both themes; everything else follows light/dark.
import { useColorScheme } from "react-native";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type ThemePreference = "system" | "light" | "dark";

const shared = {
  night: "#141B25",
  nightSoft: "#1E252F",
  volt: "#C3E201",
  onVolt: "#0A1119",
  chart: ["#C3E201", "#8AA313", "#818591", "#E5C63A", "#4A4F52"],
};

export const light = {
  ...shared,
  dark: false,
  bg: "#F3F5F8",
  card: "#FFFFFF",
  well: "#E8ECF1",
  border: "#DBE0E7",
  ink: "#0E151E",
  inkSoft: "#545E6B",
  muted: "#58626F",
  accent: "#546500",
  accentFill: "#C3E201",
  onAccent: "#0A1119",
  success: "#1D7A44",
  info: "#1F6FB2",
  ai: "#6E4FD8",
  error: "#B42F2F",
  warning: "#8A5A00",
  gold: "#876400",
  flame: "#B24012",
};

export type Palette = typeof light;

export const dark: Palette = {
  ...shared,
  dark: true,
  bg: "#0A1119",
  card: "#141B25",
  well: "#1E252F",
  border: "#252D39",
  ink: "#F5F7FA",
  inkSoft: "#A6AFBA",
  muted: "#8F98A4",
  accent: "#C3E201",
  accentFill: "#C3E201",
  onAccent: "#0A1119",
  success: "#49C77A",
  info: "#70B8F5",
  ai: "#B9A0FF",
  error: "#F16C6C",
  warning: "#F2B84B",
  gold: "#F5D06B",
  flame: "#FF9A57",
};

export const useThemePref = create<{ pref: ThemePreference; set: (p: ThemePreference) => void }>()(
  persist((set) => ({ pref: "system", set: (pref) => set({ pref }) }), {
    name: "trainova-theme",
    storage: createJSONStorage(() => localStorage),
  }),
);

export function usePalette(): Palette {
  const system = useColorScheme();
  const pref = useThemePref((s) => s.pref);
  const mode = pref === "system" ? (system ?? "dark") : pref;
  return mode === "dark" ? dark : light;
}

/** `#RRGGBB` at an alpha, for tints like accent/10. */
export function alpha(hex: string, a: number): string {
  const n = Math.round(a * 255)
    .toString(16)
    .padStart(2, "0");
  return hex + n;
}

export const font = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  heavy: "Inter_800ExtraBold",
};

export const radius = { chip: 8, control: 12, card: 16, sheet: 24 };
