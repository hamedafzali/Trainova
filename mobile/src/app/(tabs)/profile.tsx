import { useState, type ReactNode } from "react";
import { Alert, Pressable, TextInput, View } from "react-native";
import { router } from "expo-router";
import Constants from "expo-constants";
import { LogIn, LogOut, Trash2, UserX } from "lucide-react-native";
import { COACHING_LIMITS, normalizeCoaching, type EquipmentAccess, type RpePreference, type Weekday } from "@/domain/coachingProfile";
import type { Units, UserProfile } from "@/domain/types";
import { apiFetch, signOut } from "@/lib/auth";
import { pushState } from "@/lib/sync";
import { useStore } from "@/lib/store";
import { toast } from "@/lib/toast";
import { Button, Card, Chip, Field, ListCard, ListRow, PageHeader, Screen, Segmented, Sheet, Txt } from "~/ui/kit";
import { font, radius, usePalette, useThemePref, type ThemePreference } from "~/ui/theme";

const GOALS: { key: NonNullable<UserProfile["goal"]>; label: string }[] = [
  { key: "strength", label: "Strength" },
  { key: "hypertrophy", label: "Muscle" },
  { key: "fat_loss", label: "Fat loss" },
  { key: "health", label: "Health" },
];
const LEVELS: { key: NonNullable<UserProfile["experience"]>; label: string }[] = [
  { key: "beginner", label: "Beginner" },
  { key: "intermediate", label: "Intermediate" },
  { key: "advanced", label: "Advanced" },
];
const WEEKDAYS: { day: Weekday; label: string; name: string }[] = [
  { day: 1, label: "M", name: "Monday" },
  { day: 2, label: "T", name: "Tuesday" },
  { day: 3, label: "W", name: "Wednesday" },
  { day: 4, label: "T", name: "Thursday" },
  { day: 5, label: "F", name: "Friday" },
  { day: 6, label: "S", name: "Saturday" },
  { day: 0, label: "S", name: "Sunday" },
];
const DAYS = [1, 2, 3, 4, 5, 6, 7].map((n) => ({ key: String(n), label: String(n) }));
const MINUTES = [30, 45, 60, 75, 90].map((n) => ({ key: String(n), label: `${n} min` }));
const EQUIPMENT: { key: EquipmentAccess; label: string }[] = [
  { key: "gym", label: "Full gym" },
  { key: "machines", label: "Mostly machines" },
  { key: "dumbbells", label: "Dumbbells" },
  { key: "bodyweight", label: "No equipment" },
];
const RPE: { key: RpePreference; label: string }[] = [
  { key: "always", label: "Every set" },
  { key: "sometimes", label: "Sometimes" },
  { key: "never", label: "Never" },
];
const THEMES: { key: ThemePreference; label: string }[] = [
  { key: "system", label: "System" },
  { key: "light", label: "Light" },
  { key: "dark", label: "Dark" },
];
const UNITS: { key: Units; label: string }[] = [
  { key: "kg", label: "Kilograms" },
  { key: "lb", label: "Pounds" },
];

/** Profile tab: who you are, how you train, preferences and the account. */
export default function ProfileTab() {
  const p = usePalette();
  const profile = useStore((s) => s.profile);
  const session = useStore((s) => s.session);
  const units = useStore((s) => s.units);
  const completed = useStore((s) => s.sessions.filter((x) => x.status === "completed").length);
  const setUnits = useStore((s) => s.setUnits);
  const updateProfile = useStore((s) => s.updateProfile);
  const resetUserData = useStore((s) => s.resetUserData);
  const leaveSession = useStore((s) => s.leaveSession);
  const themePref = useThemePref((s) => s.pref);
  const setThemePref = useThemePref((s) => s.set);
  const [deleting, setDeleting] = useState(false);
  const account = session?.mode === "account";

  const exit = async () => {
    // Flush pending changes, then clear this device so the next account starts clean.
    if (account) await pushState();
    await signOut();
    leaveSession({ wipe: account });
    router.replace("/welcome");
  };

  const confirmExit = () =>
    account
      ? Alert.alert("Sign out?", "Your data stays in your account. This phone is cleared.", [
          { text: "Cancel", style: "cancel" },
          { text: "Sign out", style: "destructive", onPress: () => void exit() },
        ])
      : void exit();

  const confirmReset = () =>
    Alert.alert("Delete all your data?", "Every workout, plan, record and measurement will be permanently removed. This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete everything",
        style: "destructive",
        onPress: () => {
          resetUserData({ forget: true });
          toast("All data deleted");
          router.replace("/");
        },
      },
    ]);

  return (
    <Screen>
      <PageHeader title="Profile" subtitle="Your details, preferences and data." />

      <View style={{ flexDirection: "row", alignItems: "center", gap: 16, backgroundColor: p.night, borderRadius: radius.card, padding: 18 }}>
        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: p.volt, alignItems: "center", justifyContent: "center" }}>
          <Txt v="h2" color={p.onVolt}>
            {(profile.displayName?.trim() || "Athlete")[0].toUpperCase()}
          </Txt>
        </View>
        <View style={{ flex: 1 }}>
          <Txt v="h2" color="#FFFFFF" lines={1}>
            {profile.displayName?.trim() || "Athlete"}
          </Txt>
          <Txt v="bodySm" color="rgba(255,255,255,0.6)">
            {completed} workout{completed === 1 ? "" : "s"} logged
          </Txt>
        </View>
      </View>

      <Section title="About you">
        <Item label="Name">
          <Field
            placeholder="Your name"
            accessibilityLabel="Name"
            maxLength={40}
            defaultValue={profile.displayName ?? ""}
            onEndEditing={(e) => {
              const v = e.nativeEvent.text.trim() || null;
              if (v !== profile.displayName) {
                updateProfile({ displayName: v });
                toast("Saved");
              }
            }}
          />
        </Item>
        <Item label="Goal" hint="Shapes program recommendations and coaching.">
          <Choices options={GOALS} value={profile.goal} onChange={(goal) => updateProfile({ goal })} />
        </Item>
        <Item label="Experience" last>
          <Choices options={LEVELS} value={profile.experience} onChange={(experience) => updateProfile({ experience })} />
        </Item>
      </Section>

      <TrainingSetup />

      <Section title="Preferences">
        <Item label="Weight unit" hint="Everything is stored precisely; switching only changes how weights are shown.">
          <Segmented label="Weight unit" options={UNITS} value={units} onChange={setUnits} />
        </Item>
        <Item label="Appearance" last>
          <Segmented label="Appearance" options={THEMES} value={themePref} onChange={setThemePref} />
        </Item>
      </Section>

      <Section title="Account">
        <Item label={account ? (session.email ?? "Signed in") : "Guest"}>
          <Txt v="meta">
            {account
              ? "Signed in — your data syncs with the web app and your other devices."
              : "Your data is stored on this phone only. Create a free account to back it up and sync."}
          </Txt>
        </Item>
        {!account && <ListRow icon={LogIn} tone="accent" title="Sign in or create an account" onPress={() => void exit()} />}
        {account && <ListRow icon={LogOut} title="Sign out" onPress={confirmExit} />}
        <ListRow icon={Trash2} tone="danger" title="Delete all workout data" onPress={confirmReset} last={!account} />
        {account && <ListRow icon={UserX} tone="danger" title="Delete account" onPress={() => setDeleting(true)} last />}
      </Section>

      <Txt v="meta" style={{ textAlign: "center" }}>
        Trainova v{Constants.expoConfig?.version ?? "1.0.0"}
      </Txt>

      <DeleteAccountSheet open={deleting} onClose={() => setDeleting(false)} />
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Txt v="eyebrow" style={{ paddingHorizontal: 4 }}>
        {title}
      </Txt>
      <ListCard>{children}</ListCard>
    </View>
  );
}

function Item({ label, hint, children, last }: { label: string; hint?: string; children: ReactNode; last?: boolean }) {
  const p = usePalette();
  return (
    <View style={[{ padding: 16, gap: 10 }, !last && { borderBottomWidth: 1, borderBottomColor: p.border }]}>
      <View style={{ gap: 2 }}>
        <Txt v="label">{label}</Txt>
        {hint ? <Txt v="meta">{hint}</Txt> : null}
      </View>
      {children}
    </View>
  );
}

/** Wrapping pills; tapping the selected one clears it when `onClear` is given. */
function Choices<K extends string>({
  options,
  value,
  onChange,
  onClear,
}: {
  options: { key: K; label: string }[];
  value: K | null;
  onChange: (k: K) => void;
  onClear?: () => void;
}) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {options.map((o) => (
        <Chip key={o.key} label={o.label} on={value === o.key} onPress={() => (onClear && value === o.key ? onClear() : onChange(o.key))} />
      ))}
    </View>
  );
}

/** Schedule, equipment, limitations and preferences the coach plans around. */
function TrainingSetup() {
  const p = usePalette();
  const raw = useStore((s) => s.profile.coaching);
  const coaching = normalizeCoaching(raw);
  const update = useStore((s) => s.updateCoaching);
  const toggleDay = (d: Weekday) =>
    update({ trainingDays: coaching.trainingDays.includes(d) ? coaching.trainingDays.filter((x) => x !== d) : [...coaching.trainingDays, d] });

  return (
    <Section title="Training setup">
      <Item label="Days per week" hint="How often you can realistically train. Tap again to clear.">
        <Choices
          options={DAYS}
          value={coaching.daysPerWeek ? String(coaching.daysPerWeek) : null}
          onChange={(v) => update({ daysPerWeek: Number(v) })}
          onClear={() => update({ daysPerWeek: null })}
        />
      </Item>
      <Item label="Usual days" hint="Optional — leave empty if it changes week to week.">
        <View style={{ flexDirection: "row", gap: 6 }} accessibilityRole="none" accessibilityLabel="Usual training days">
          {WEEKDAYS.map((w) => {
            const on = coaching.trainingDays.includes(w.day);
            return (
              <Pressable
                key={w.day}
                onPress={() => toggleDay(w.day)}
                accessibilityRole="checkbox"
                accessibilityLabel={w.name}
                accessibilityState={{ checked: on }}
                style={{
                  flex: 1,
                  maxWidth: 44,
                  aspectRatio: 1,
                  borderRadius: 999,
                  borderWidth: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  borderColor: on ? p.accentFill : p.border,
                  backgroundColor: on ? p.accentFill : p.well,
                }}
              >
                <Txt v="label" color={on ? p.onAccent : p.inkSoft}>
                  {w.label}
                </Txt>
              </Pressable>
            );
          })}
        </View>
      </Item>
      <Item label="Session length" hint="Plans and AI suggestions are sized to fit.">
        <Choices
          options={MINUTES}
          value={coaching.sessionMinutes ? String(coaching.sessionMinutes) : null}
          onChange={(v) => update({ sessionMinutes: Number(v) })}
          onClear={() => update({ sessionMinutes: null })}
        />
      </Item>
      <Item label="Equipment">
        <Choices options={EQUIPMENT} value={coaching.equipment} onChange={(equipment) => update({ equipment })} onClear={() => update({ equipment: null })} />
      </Item>
      <Item label="Effort rating (RPE)" hint="Choose Never to hide the RPE picker while logging.">
        <Choices options={RPE} value={coaching.rpe} onChange={(rpe) => update({ rpe })} onClear={() => update({ rpe: null })} />
      </Item>
      <Item label="Injuries and limitations" hint="Movements the coach should avoid. Not medical advice — see a clinician for pain.">
        <NoteField
          label="Injuries and limitations"
          value={coaching.limitations}
          max={COACHING_LIMITS.limitationsChars}
          placeholder="e.g. left knee hurts on deep squats"
          onSave={(limitations) => update({ limitations })}
        />
      </Item>
      <Item label="Notes for your coach" hint="Likes, dislikes, context — anything that helps." last>
        <NoteField
          label="Notes for your coach"
          value={coaching.coachNotes}
          max={COACHING_LIMITS.notesChars}
          placeholder="e.g. I enjoy deadlifts, hate lunges"
          onSave={(coachNotes) => update({ coachNotes })}
        />
      </Item>
    </Section>
  );
}

function NoteField({ label, value, max, placeholder, onSave }: { label: string; value: string | null; max: number; placeholder: string; onSave: (v: string | null) => void }) {
  const p = usePalette();
  return (
    <TextInput
      accessibilityLabel={label}
      multiline
      maxLength={max}
      placeholder={placeholder}
      placeholderTextColor={p.muted}
      defaultValue={value ?? ""}
      onEndEditing={(e) => {
        const v = e.nativeEvent.text.trim() || null;
        if (v !== value) {
          onSave(v);
          toast("Saved");
        }
      }}
      style={{
        minHeight: 80,
        borderWidth: 1,
        borderColor: p.border,
        borderRadius: radius.control,
        backgroundColor: p.well,
        color: p.ink,
        fontFamily: font.regular,
        fontSize: 15,
        padding: 12,
        textAlignVertical: "top",
      }}
    />
  );
}

/** Account deletion needs the password again; the server deletes the account and its data. */
function DeleteAccountSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const p = usePalette();
  const leaveSession = useStore((s) => s.leaveSession);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const r = await apiFetch("/api/account", { method: "DELETE", body: JSON.stringify({ password }) });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) {
        toast(j.error ?? "Couldn't delete the account.", { variant: "error" });
        return;
      }
      setPassword("");
      onClose();
      await signOut();
      leaveSession({ wipe: true });
      router.replace("/welcome");
      toast("Your account and its data were deleted.");
    } catch {
      toast("Couldn't reach the server. Nothing was deleted.", { variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={() => {
        setPassword("");
        onClose();
      }}
      title="Delete your account?"
    >
      <Card style={{ gap: 14 }}>
        <Txt v="bodySm">Your account and every workout, plan and measurement in it are permanently deleted on all devices. This can&apos;t be undone.</Txt>
        <Field label="Password" secureTextEntry autoCapitalize="none" autoComplete="current-password" value={password} onChangeText={setPassword} />
        <Button variant="danger" label="Delete account" busy={busy} disabled={!password} onPress={() => void submit()} />
        <Txt v="meta" color={p.muted}>
          Changed your mind? Close this sheet.
        </Txt>
      </Card>
    </Sheet>
  );
}
