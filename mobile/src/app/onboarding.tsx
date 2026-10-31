import { useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import {
  Activity,
  ArrowLeft,
  Building2,
  Check,
  ChevronDown,
  Clock,
  Cog,
  Dumbbell,
  Flame,
  HeartPulse,
  PersonStanding,
  Sprout,
  TrendingUp,
  Trophy,
} from "lucide-react-native";
import { useStore } from "@/lib/store";
import { PROGRAM_BLUEPRINTS, recommendBlueprint, type ProgramBlueprint, type ProgramSetting } from "@/data/programs";
import { label } from "@/domain/taxonomy";
import { normalizeCoaching } from "@/domain/coachingProfile";
import type { UserProfile, Units } from "@/domain/types";
import { Badge, Button, Card, Row, Screen, Segmented, Txt, type Icon } from "~/ui/kit";
import { alpha, font, radius, usePalette } from "~/ui/theme";

type Option<T extends string> = { key: T; label: string; blurb: string; icon: Icon };

const GOALS: Option<NonNullable<UserProfile["goal"]>>[] = [
  { key: "strength", label: "Get stronger", blurb: "Heavier lifts, more reps", icon: Dumbbell },
  { key: "hypertrophy", label: "Build muscle", blurb: "Size and definition", icon: TrendingUp },
  { key: "fat_loss", label: "Lose fat", blurb: "Lean out, stay strong", icon: Flame },
  { key: "health", label: "Stay healthy", blurb: "Move well, feel good", icon: HeartPulse },
];

const LEVELS: Option<NonNullable<UserProfile["experience"]>>[] = [
  { key: "beginner", label: "New to lifting", blurb: "Less than a year", icon: Sprout },
  { key: "intermediate", label: "Some experience", blurb: "1–3 years of training", icon: Activity },
  { key: "advanced", label: "Experienced", blurb: "3+ years, know the lifts", icon: Trophy },
];

const SETTINGS: Option<ProgramSetting>[] = [
  { key: "gym", label: "Full gym", blurb: "Barbells, machines, cables", icon: Building2 },
  { key: "machines", label: "Mostly machines", blurb: "Guided, beginner-friendly", icon: Cog },
  { key: "dumbbells", label: "Dumbbells", blurb: "Home gym or busy floor", icon: Dumbbell },
  { key: "bodyweight", label: "No equipment", blurb: "Bodyweight anywhere", icon: PersonStanding },
];

const DAYS = [2, 3, 4, 5];
const UNIT_OPTIONS: { key: Units; label: string }[] = [
  { key: "kg", label: "Kilograms (kg)" },
  { key: "lb", label: "Pounds (lb)" },
];
const STEPS = ["Goal", "Experience", "Schedule", "Equipment", "Program"] as const;

/** Guided setup: a few questions, then a matching program is installed (src/components/Onboarding.tsx). */
export default function Onboarding() {
  const p = usePalette();
  const setUnits = useStore((s) => s.setUnits);
  const units = useStore((s) => s.units);
  const completeOnboarding = useStore((s) => s.completeOnboarding);
  const installProgram = useStore((s) => s.installProgram);
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<UserProfile["goal"]>(null);
  const [experience, setExperience] = useState<UserProfile["experience"]>(null);
  const [days, setDays] = useState<number | null>(null);
  const [setting, setSetting] = useState<ProgramSetting | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [showOthers, setShowOthers] = useState(false);

  const recommended = recommendBlueprint({ goal, experience, daysPerWeek: days, setting });
  const pick = PROGRAM_BLUEPRINTS.find((b) => b.id === chosen) ?? recommended;
  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));

  const finish = (blueprintId: string | null) => {
    if (blueprintId) installProgram(blueprintId);
    completeOnboarding({
      goal,
      experience,
      role: "user",
      coaching: normalizeCoaching({ daysPerWeek: days, equipment: setting }),
    });
    router.replace("/");
  };

  const footer = (
    <View style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 10 }}>
      {step === 4 ? (
        <>
          <Button icon={Check} label={`Start with ${pick.name}`} onPress={() => finish(pick.id)} />
          <Button variant="ghost" label="Skip — I'll build my own plan" onPress={() => finish(null)} />
        </>
      ) : (
        <Button variant="secondary" label={step === 2 ? "Continue" : "Skip this question"} onPress={next} />
      )}
      <Txt v="meta" style={{ textAlign: "center" }}>
        Your answers stay on this phone and can be changed in Profile.
      </Txt>
    </View>
  );

  return (
    <Screen edges={["top", "bottom"]} footer={footer}>
      <Row gap={12}>
        <Pressable
          onPress={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", opacity: step === 0 ? 0 : 1 }}
        >
          <ArrowLeft color={p.inkSoft} size={22} />
        </Pressable>
        <View
          style={{ flex: 1, flexDirection: "row", gap: 6 }}
          accessibilityRole="progressbar"
          accessibilityLabel="Setup progress"
          accessibilityValue={{ min: 1, max: STEPS.length, now: step + 1 }}
        >
          {STEPS.map((s, i) => (
            <View key={s} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i <= step ? p.accentFill : p.border }} />
          ))}
        </View>
        <Txt v="meta" style={{ width: 32, textAlign: "right" }}>
          {`${step + 1}/${STEPS.length}`}
        </Txt>
      </Row>

      {step === 0 && (
        <>
          <Heading title="What's your main goal?" sub="We'll pick sets, reps and a program to match." />
          <Cards options={GOALS} value={goal} onPick={(k) => (setGoal(k), next())} />
        </>
      )}

      {step === 1 && (
        <>
          <Heading title="How experienced are you?" sub="Beginners get simpler, machine-friendly programs." />
          <Cards options={LEVELS} value={experience} onPick={(k) => (setExperience(k), next())} columns={1} />
        </>
      )}

      {step === 2 && (
        <>
          <Heading title="How many days a week can you train?" sub="Be realistic — consistency beats volume." />
          <Row gap={8}>
            {DAYS.map((d) => {
              const on = days === d;
              return (
                <Pressable
                  key={d}
                  onPress={() => (setDays(d), next())}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${d}${d === 5 ? " or more" : ""} days a week`}
                  style={{
                    flex: 1,
                    paddingVertical: 18,
                    alignItems: "center",
                    borderRadius: radius.card,
                    borderWidth: 1,
                    borderColor: on ? p.accentFill : p.border,
                    backgroundColor: on ? p.accentFill : p.card,
                  }}
                >
                  <Txt v="display" color={on ? p.onAccent : p.ink}>
                    {`${d}${d === 5 ? "+" : ""}`}
                  </Txt>
                  <Txt v="meta" color={on ? alpha(p.onAccent, 0.8) : p.muted}>
                    days
                  </Txt>
                </Pressable>
              );
            })}
          </Row>
          <View style={{ gap: 8 }}>
            <Txt v="label">Weight unit</Txt>
            <Segmented label="Weight unit" options={UNIT_OPTIONS} value={units} onChange={setUnits} />
          </View>
        </>
      )}

      {step === 3 && (
        <>
          <Heading title="Where do you train?" sub="We'll only use equipment you have." />
          <Cards options={SETTINGS} value={setting} onPick={(k) => (setSetting(k), setChosen(null), next())} />
        </>
      )}

      {step === 4 && (
        <>
          <Heading title="Your program" sub="Recommended from your answers. You can edit every exercise later." />
          <ProgramCard bp={pick} recommended={pick.id === recommended.id} />
          <Pressable
            onPress={() => setShowOthers((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: showOthers }}
            style={{ flexDirection: "row", alignItems: "center", gap: 4, minHeight: 40 }}
          >
            <Txt v="label" color={p.accent}>
              Choose a different program
            </Txt>
            <View style={{ transform: [{ rotate: showOthers ? "180deg" : "0deg" }] }}>
              <ChevronDown color={p.accent} size={16} />
            </View>
          </Pressable>
          {showOthers && (
            <View style={{ gap: 8, marginTop: -8 }}>
              {PROGRAM_BLUEPRINTS.filter((b) => b.id !== pick.id).map((b) => (
                <Pressable
                  key={b.id}
                  onPress={() => (setChosen(b.id), setShowOthers(false))}
                  accessibilityRole="button"
                  style={({ pressed }) => ({
                    padding: 12,
                    borderRadius: radius.control,
                    borderWidth: 1,
                    borderColor: p.border,
                    backgroundColor: pressed ? p.well : p.card,
                  })}
                >
                  <Txt v="h3">{b.name}</Txt>
                  <Txt v="meta">{`${b.daysPerWeek}×/week · ${label(b.level)} · ~${b.minutes} min`}</Txt>
                </Pressable>
              ))}
            </View>
          )}
        </>
      )}
    </Screen>
  );
}

function Heading({ title, sub }: { title: string; sub: string }) {
  return (
    <View style={{ gap: 4 }}>
      <Txt v="title">{title}</Txt>
      <Txt v="bodySm">{sub}</Txt>
    </View>
  );
}

function ProgramCard({ bp, recommended }: { bp: ProgramBlueprint; recommended: boolean }) {
  const p = usePalette();
  return (
    <Card style={{ gap: 12, borderColor: alpha(p.accent, 0.3), padding: 20 }}>
      <Row style={{ justifyContent: "space-between", alignItems: "flex-start" }} gap={12}>
        <Txt v="h2" style={{ flex: 1 }}>
          {bp.name}
        </Txt>
        {recommended ? <Badge tone="accent">Best match</Badge> : null}
      </Row>
      <Txt v="bodySm">{bp.summary}</Txt>
      <Row gap={6} style={{ flexWrap: "wrap" }}>
        <Badge>{`${bp.daysPerWeek}× / week`}</Badge>
        <Badge>{label(bp.level)}</Badge>
        <Row gap={4} style={{ backgroundColor: p.well, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
          <Clock color={p.inkSoft} size={12} />
          <Txt v="meta" color={p.inkSoft} style={{ fontFamily: font.semibold, fontSize: 11 }}>
            {`~${bp.minutes} min`}
          </Txt>
        </Row>
      </Row>
      <View style={{ gap: 6, borderTopWidth: 1, borderTopColor: p.border, paddingTop: 12 }}>
        {bp.days.map((d) => (
          <Row key={d.name} gap={8}>
            <Txt v="label">{d.name}</Txt>
            <Txt v="bodySm" color={p.muted} lines={1} style={{ flex: 1 }}>
              {d.focus}
            </Txt>
          </Row>
        ))}
      </View>
    </Card>
  );
}

function Cards<T extends string>({
  options,
  value,
  onPick,
  columns = 2,
}: {
  options: Option<T>[];
  value: T | null;
  onPick: (k: T) => void;
  columns?: 1 | 2;
}) {
  const p = usePalette();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
      {options.map((o) => {
        const on = value === o.key;
        return (
          <Pressable
            key={o.key}
            onPress={() => onPick(o.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={({ pressed }) => ({
              width: columns === 2 ? "47.5%" : "100%",
              flexGrow: 1,
              flexDirection: columns === 2 ? "column" : "row",
              alignItems: columns === 2 ? "flex-start" : "center",
              gap: 12,
              padding: 16,
              borderRadius: radius.card,
              borderWidth: 1,
              borderColor: on ? p.accentFill : p.border,
              backgroundColor: on ? p.accentFill : pressed ? p.well : p.card,
            })}
          >
            <o.icon color={on ? p.onAccent : p.accent} size={22} />
            <View style={{ flexShrink: 1 }}>
              <Txt v="label" color={on ? p.onAccent : p.ink}>
                {o.label}
              </Txt>
              <Txt v="meta" color={on ? alpha(p.onAccent, 0.75) : p.muted}>
                {o.blurb}
              </Txt>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
