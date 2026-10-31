import { Redirect } from "expo-router";
import { Tabs } from "expo-router/js-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChartColumnIncreasing, ClipboardList, Dumbbell, Home, User } from "lucide-react-native";
import { useStore } from "@/lib/store";
import { font, usePalette } from "~/ui/theme";
import type { Icon } from "~/ui/kit";

const TABS: { name: string; title: string; icon: Icon }[] = [
  { name: "index", title: "Home", icon: Home },
  { name: "plan", title: "Plan", icon: ClipboardList },
  { name: "workouts", title: "Workouts", icon: Dumbbell },
  { name: "progress", title: "Progress", icon: ChartColumnIncreasing },
  { name: "profile", title: "Profile", icon: User },
];

/** The five main tabs. Without a session or setup the app routes to the gate screens first. */
export default function TabsLayout() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const session = useStore((s) => s.session);
  const onboarded = useStore((s) => s.profile.onboarded);
  if (!session) return <Redirect href="/welcome" />;
  if (!onboarded) return <Redirect href="/onboarding" />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: p.bg },
        tabBarActiveTintColor: p.dark ? p.volt : p.ink,
        tabBarInactiveTintColor: p.muted,
        // Room for the label on phones without a home indicator (bottom inset 0).
        tabBarStyle: {
          backgroundColor: p.card,
          borderTopColor: p.border,
          height: 58 + Math.max(insets.bottom, 6),
          paddingTop: 6,
          paddingBottom: Math.max(insets.bottom, 6),
        },
        tabBarLabelStyle: { fontFamily: font.semibold, fontSize: 11, lineHeight: 14 },
      }}
    >
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarIcon: ({ color, size, focused }) => <t.icon color={String(color)} size={size - 2} strokeWidth={focused ? 2.4 : 2} />,
          }}
        />
      ))}
    </Tabs>
  );
}
