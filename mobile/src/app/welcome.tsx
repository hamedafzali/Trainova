import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { BarChart3, Dumbbell, Eye, EyeOff, ListChecks, WifiOff } from "lucide-react-native";
import { useStore } from "@/lib/store";
import { signIn, signUp, apiFetch } from "@/lib/auth";
import { mergeRemote, pullState, pushState } from "@/lib/sync";
import { Button, Field, Row, Segmented, Txt } from "~/ui/kit";
import { alpha, font, usePalette } from "~/ui/theme";
import { Logo } from "~/ui/Logo";

const FEATURES = [
  { icon: ListChecks, title: "Ready-made programs", body: "Start from a proven plan or build your own." },
  { icon: Dumbbell, title: "100+ exercises", body: "Machines, free weights and cardio, with a 3D guide." },
  { icon: BarChart3, title: "Automatic progression", body: "Know exactly what to lift next time." },
  { icon: WifiOff, title: "Works offline", body: "Log in the gym basement; it syncs later." },
];

const MODES = [
  { key: "in", label: "Sign in" },
  { key: "up", label: "Create account" },
] as const;

/** First screen: sign in, create an account, or continue as a guest (data stays on the phone). */
export default function Welcome() {
  const p = usePalette();
  const enterGuest = useStore((s) => s.enterGuest);
  const enterAccount = useStore((s) => s.enterAccount);
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSubmit = !busy && emailValid && password.length > 0 && !(mode === "up" && password.length < 8);

  const submit = async () => {
    if (!canSubmit) return;
    setError(null);
    setNote(null);
    setBusy(true);
    try {
      const who = mode === "up" ? await signUp(email.trim(), password) : await signIn(email.trim(), password);
      enterAccount(who.email, who.role);
      // Merge the account copy with anything logged on this phone, then publish.
      const remote = await pullState();
      if (remote) mergeRemote(remote);
      await pushState();
      router.replace("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    setError(null);
    setNote(null);
    if (!emailValid) return setError("Enter your email above first.");
    try {
      const r = await apiFetch("/api/auth/forgot", { method: "POST", body: JSON.stringify({ email: email.trim() }) });
      if (r.ok) setNote("If that email is registered, a reset link is on its way.");
      else setError(((await r.json().catch(() => ({}))) as { error?: string }).error ?? "Couldn't start a reset.");
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={{ backgroundColor: p.night, paddingBottom: 56, overflow: "hidden" }}>
          <SafeAreaView edges={["top"]} style={{ paddingHorizontal: 24, paddingTop: 28, alignItems: "center" }}>
            <View style={{ position: "absolute", right: -60, top: -40, width: 220, height: 220, borderRadius: 110, backgroundColor: alpha(p.volt, 0.12) }} />
            <Logo size={56} />
            <Txt v="eyebrow" color={p.volt} style={{ marginTop: 22, letterSpacing: 2 }}>
              Strength training, logged
            </Txt>
            <Text style={{ fontFamily: font.heavy, fontSize: 46, letterSpacing: -1.4, color: "#FFFFFF", marginTop: 6 }}>Trainova</Text>
            <Txt v="body" color="rgba(255,255,255,0.75)" style={{ textAlign: "center", marginTop: 10 }}>
              Follow a plan, log every set in seconds and watch your strength climb.
            </Txt>
            <View style={{ marginTop: 26, gap: 14, alignSelf: "stretch" }}>
              {FEATURES.map((f) => (
                <Row key={f.title} gap={14}>
                  <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" }}>
                    <f.icon color={p.volt} size={19} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt v="h3" color="#FFFFFF">
                      {f.title}
                    </Txt>
                    <Txt v="meta" color="rgba(255,255,255,0.62)">
                      {f.body}
                    </Txt>
                  </View>
                </Row>
              ))}
            </View>
          </SafeAreaView>
        </View>

        <View style={{ marginTop: -32, marginHorizontal: 16, padding: 18, gap: 14, borderRadius: 20, backgroundColor: p.card, borderWidth: 1, borderColor: p.border }}>
          <Segmented label="Account" options={MODES} value={mode} onChange={(m) => (setMode(m), setError(null))} />
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
          />
          <View>
            <Field
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder={mode === "up" ? "At least 8 characters" : "Your password"}
              secureTextEntry={!show}
              autoCapitalize="none"
              autoComplete={mode === "up" ? "new-password" : "current-password"}
              textContentType={mode === "up" ? "newPassword" : "password"}
              onSubmitEditing={submit}
              style={{ paddingRight: 52 }}
            />
            <Pressable
              onPress={() => setShow((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={show ? "Hide password" : "Show password"}
              style={{ position: "absolute", right: 0, bottom: 0, width: 50, height: 50, alignItems: "center", justifyContent: "center" }}
            >
              {show ? <EyeOff color={p.muted} size={20} /> : <Eye color={p.muted} size={20} />}
            </Pressable>
          </View>
          {mode === "up" && password.length > 0 && password.length < 8 ? (
            <Txt v="meta" color={p.error}>
              Use at least 8 characters
            </Txt>
          ) : null}
          {error ? (
            <Txt v="bodySm" color={p.error} style={{ textAlign: "center" }}>
              {error}
            </Txt>
          ) : null}
          {note ? (
            <Txt v="bodySm" color={p.accent} style={{ textAlign: "center" }}>
              {note}
            </Txt>
          ) : null}
          <Button label={mode === "up" ? "Create account" : "Sign in"} onPress={submit} disabled={!canSubmit} busy={busy} />
          {mode === "in" ? (
            <Pressable onPress={forgot} accessibilityRole="button" style={{ alignSelf: "center", minHeight: 36, justifyContent: "center" }}>
              <Txt v="label" color={p.accent}>
                Forgot password?
              </Txt>
            </Pressable>
          ) : null}
        </View>

        <View style={{ marginHorizontal: 16, marginTop: 18, gap: 8 }}>
          <Button
            variant="ghost"
            label="Continue as guest"
            onPress={() => {
              enterGuest();
              router.replace("/");
            }}
          />
          <Txt v="meta" style={{ textAlign: "center" }}>
            As a guest your training stays on this phone. Create an account any time to back it up.
          </Txt>
        </View>
      </ScrollView>
    </View>
  );
}
