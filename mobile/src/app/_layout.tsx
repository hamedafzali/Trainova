import { useEffect, useState } from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from "@expo-google-fonts/inter";
import { useStore } from "@/lib/store";
import { useCoachChat } from "@/lib/coachChat";
import { loadToken } from "~/platform/auth";
import { useSync } from "~/features/sync";
import { useRestAlerts } from "~/features/restAlerts";
import { ToastHost } from "~/ui/kit";
import { usePalette, useThemePref } from "~/ui/theme";

SplashScreen.preventAutoHideAsync().catch(() => undefined);

/** Loads fonts, the saved training data and the session token, then shows the app. */
export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold });
  const [dataLoaded, setDataLoaded] = useState(false);
  const p = usePalette();

  useEffect(() => {
    Promise.all([
      useStore.persist.rehydrate(),
      useCoachChat.persist.rehydrate(),
      useThemePref.persist.rehydrate(),
      loadToken(),
    ]).finally(() => setDataLoaded(true));
  }, []);

  const ready = fontsLoaded && dataLoaded;
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  if (!ready) return <View style={{ flex: 1, backgroundColor: p.bg }} />;
  return (
    <SafeAreaProvider>
      <StatusBar style={p.dark ? "light" : "dark"} />
      <Background />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: p.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="session/[id]" options={{ gestureEnabled: false }} />
      </Stack>
      <ToastHost />
    </SafeAreaProvider>
  );
}

/** Background work that runs while the app is open. */
function Background() {
  useSync();
  useRestAlerts();
  return null;
}
