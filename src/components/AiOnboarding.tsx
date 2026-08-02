"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { getToken } from "@/lib/auth";

const GOALS = [
  "Build muscle",
  "Lose fat",
  "Get stronger",
  "Stay healthy",
  "Improve endurance",
];
const EXPERIENCE_LEVELS = [
  "Beginner (0-6 months)",
  "Intermediate (6-24 months)",
  "Advanced (2+ years)",
];
const EQUIPMENT_OPTIONS = [
  "Full gym with machines and free weights",
  "Home gym with dumbbells",
  "Bodyweight only",
  "Barbell and plates",
  "Resistance bands",
  "Minimal equipment",
];

interface OnboardingFormData {
  goal: string;
  timeline: number;
  experience: string;
  daysPerWeek: number;
  sessionDuration: number;
  equipment: string;
  age: number;
  sex: string;
  height: string;
  weight: string;
  bodyFatPercentage?: number;
  measurements?: {
    chest?: number;
    waist?: number;
    hips?: number;
    leftArm?: number;
    rightArm?: number;
    leftThigh?: number;
    rightThigh?: number;
  };
  injuries: string;
  sleepQuality: number;
  stressLevel: number;
  nutrition: string;
  enjoyActivities: string;
  hateActivities: string;
  supplements: string;
}

export function AiOnboarding() {
  const router = useRouter();
  const importGeneratedPlan = useStore((s) => s.importGeneratedPlan);
  const completeOnboarding = useStore((s) => s.completeOnboarding);
  const setUnits = useStore((s) => s.setUnits);

  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedProgram, setGeneratedProgram] = useState<any>(null);

  const [formData, setFormData] = useState<OnboardingFormData>({
    goal: "",
    timeline: 12,
    experience: "",
    daysPerWeek: 3,
    sessionDuration: 45,
    equipment: "Full gym with machines and free weights",
    age: 25,
    sex: "male",
    height: "180cm",
    weight: "75kg",
    injuries: "",
    sleepQuality: 4,
    stressLevel: 3,
    nutrition: "Balanced diet",
    enjoyActivities: "",
    hateActivities: "",
    supplements: "",
  });

  const generateProgram = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/ai/onboarding", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          action: "generate_program",
          data: {
            goal: formData.goal,
            timeline: formData.timeline,
            experience: formData.experience.split(" ")[0].toLowerCase(),
            daysPerWeek: formData.daysPerWeek,
            sessionDuration: formData.sessionDuration,
            equipment: formData.equipment,
            age: formData.age,
            sex: formData.sex,
            height: formData.height,
            weight: formData.weight,
            bodyFatPercentage: formData.bodyFatPercentage,
            measurements: formData.measurements,
            injuries: formData.injuries || "None",
            sleepQuality: formData.sleepQuality,
            stressLevel: formData.stressLevel,
            nutrition: formData.nutrition,
            enjoyActivities: formData.enjoyActivities || "None specified",
            hateActivities: formData.hateActivities || "None specified",
            supplements: formData.supplements || "None",
          },
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Failed to generate program");

      setGeneratedProgram(j.program);
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate program");
    } finally {
      setBusy(false);
    }
  };

  const importProgram = () => {
    if (!generatedProgram) return;

    // Convert each session to a template
    generatedProgram.sessions.forEach((session: any, index: number) => {
      const template = {
        name: `${generatedProgram.name} - Day ${session.day}`,
        notes: session.focus,
        exercises: session.exercises.map((ex: any) => ({
          name: ex.name,
          muscle: ex.muscleGroup || null,
          sets: ex.sets,
          reps:
            typeof ex.reps === "string"
              ? parseInt(ex.reps.split("-")[0])
              : ex.reps,
        })),
      };
      importGeneratedPlan(template);
    });

    completeOnboarding({
      goal: formData.goal as any,
      experience: formData.experience.split(" ")[0].toLowerCase() as any,
      role: "user",
    });
    router.push("/templates");
  };

  const updateField = (field: keyof OnboardingFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  if (step === 3 && generatedProgram) {
    return (
      <main className="flex justify-center p-6">
        <div className="w-full max-w-2xl space-y-6">
          <header className="pt-6">
            <h1 className="text-3xl font-bold tracking-tight text-white">
              Your AI Program
            </h1>
            <p className="mt-1 text-muted">{generatedProgram.name}</p>
          </header>

          <div className="card space-y-4">
            <div>
              <h3 className="font-semibold text-white">Program Overview</h3>
              <p className="text-sm text-muted">{generatedProgram.description}</p>
              <p className="text-sm text-muted mt-2">
                <strong>Focus:</strong> {generatedProgram.focus}
              </p>
              <p className="text-sm text-muted">
                <strong>Split:</strong> {generatedProgram.split}
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-white">
                Weekly Sessions ({generatedProgram.sessions.length})
              </h3>
              {generatedProgram.sessions.map((session: any, index: number) => (
                <div key={index} className="mt-3 p-3 bg-surface2 rounded-lg">
                  <p className="font-semibold text-white">
                    Day {session.day}: {session.focus}
                  </p>
                  <p className="text-sm text-muted">
                    {session.exercises.length} exercises
                  </p>
                </div>
              ))}
            </div>

            <div>
              <h3 className="font-semibold text-white">Recommendations</h3>
              <p className="text-sm text-muted mt-1">
                {generatedProgram.recommendations?.nutrition}
              </p>
              <p className="text-sm text-muted mt-2">
                {generatedProgram.recommendations?.recovery}
              </p>
            </div>
          </div>

          <button
            className="btn-primary w-full py-4 text-base"
            onClick={importProgram}
          >
            Import Program & Start Training →
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex justify-center p-4 pb-20">
      <div className="w-full max-w-2xl space-y-6">
        <header className="pt-4">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            AI-Powered Onboarding
          </h1>
          <p className="mt-2 text-base text-muted">
            Step {step} of 2: {step === 1 ? "Basic Info" : "Details"}
          </p>
        </header>

        {error && (
          <div className="card bg-danger/10 border-danger text-danger p-4">
            {error}
          </div>
        )}

        {step === 1 ? (
        <div className="space-y-5">
          <Section title="Primary Goal">
            <Chips
              options={GOALS.map((g) => ({ key: g, label: g }))}
              value={formData.goal}
              onPick={(k) => updateField("goal", k)}
            />
          </Section>

          <Section title="Timeline (weeks)">
            <input
              className="input text-base py-3"
              type="number"
              min="4"
              max="52"
              value={formData.timeline}
              onChange={(e) => updateField("timeline", Number(e.target.value))}
            />
          </Section>

          <Section title="Training Experience">
            <Chips
              options={EXPERIENCE_LEVELS.map((l) => ({ key: l, label: l }))}
              value={formData.experience}
              onPick={(k) => updateField("experience", k)}
            />
          </Section>

          <Section title="Training Days per Week">
            <div className="grid grid-cols-4 gap-2">
              {[3, 4, 5, 6].map((days) => (
                <button
                  key={days}
                  onClick={() => updateField("daysPerWeek", days)}
                  className={`py-4 rounded-xl font-semibold text-base ${
                    formData.daysPerWeek === days
                      ? "bg-accent text-onAccent"
                      : "bg-surface2 text-inkSoft"
                  }`}
                >
                  {days}
                </button>
              ))}
            </div>
          </Section>

          <Section title="Session Duration (minutes)">
            <input
              className="input text-base py-3"
              type="number"
              min="15"
              max="120"
              value={formData.sessionDuration}
              onChange={(e) =>
                updateField("sessionDuration", Number(e.target.value))
              }
            />
          </Section>

          <Section title="Available Equipment">
            <select
              className="input text-base py-3"
              value={formData.equipment}
              onChange={(e) => updateField("equipment", e.target.value)}
            >
              {EQUIPMENT_OPTIONS.map((eq) => (
                <option key={eq} value={eq}>
                  {eq}
                </option>
              ))}
            </select>
          </Section>

          <button
            className="btn-primary w-full py-4 text-base font-semibold"
            onClick={() => setStep(2)}
            disabled={!formData.goal || !formData.experience}
          >
            Continue →
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          <Section title="Age">
            <input
              className="input text-base py-3"
              type="number"
              min="16"
              max="80"
              value={formData.age}
              onChange={(e) => updateField("age", Number(e.target.value))}
            />
          </Section>

          <Section title="Sex">
            <Chips
              options={[
                { key: "male", label: "Male" },
                { key: "female", label: "Female" },
                { key: "other", label: "Other" },
              ]}
              value={formData.sex}
              onPick={(k) => updateField("sex", k)}
            />
          </Section>

          <Section title="Height">
            <input
              className="input text-base py-3"
              placeholder="e.g., 180cm or 5'11&quot;"
              value={formData.height}
              onChange={(e: any) => updateField("height", e.target.value)}
            />
          </Section>

          <Section title="Weight">
            <input
              className="input text-base py-3"
              placeholder="e.g., 75kg or 165lbs"
              value={formData.weight}
              onChange={(e) => updateField("weight", e.target.value)}
            />
          </Section>

          <Section title="Body Fat Percentage (optional)">
            <input
              className="input text-base py-3"
              type="number"
              min="0"
              max="50"
              step="0.1"
              placeholder="e.g., 15.5"
              value={formData.bodyFatPercentage || ""}
              onChange={(e) =>
                updateField(
                  "bodyFatPercentage",
                  Number(e.target.value) || undefined,
                )
              }
            />
            <p className="text-sm text-muted mt-2">
              Optional - helps with more accurate program design
            </p>
          </Section>

          <Section title="Body Measurements (optional, in cm)">
            <div className="grid grid-cols-2 gap-2">
              <input
                className="input text-base py-3"
                type="number"
                placeholder="Chest"
                value={formData.measurements?.chest || ""}
                onChange={(e) =>
                  updateField("measurements", {
                    ...formData.measurements,
                    chest: Number(e.target.value) || undefined,
                  })
                }
              />
              <input
                className="input text-base py-3"
                type="number"
                placeholder="Waist"
                value={formData.measurements?.waist || ""}
                onChange={(e) =>
                  updateField("measurements", {
                    ...formData.measurements,
                    waist: Number(e.target.value) || undefined,
                  })
                }
              />
              <input
                className="input text-base py-3"
                type="number"
                placeholder="Hips"
                value={formData.measurements?.hips || ""}
                onChange={(e) =>
                  updateField("measurements", {
                    ...formData.measurements,
                    hips: Number(e.target.value) || undefined,
                  })
                }
              />
              <input
                className="input text-base py-3"
                type="number"
                placeholder="Left Arm"
                value={formData.measurements?.leftArm || ""}
                onChange={(e) =>
                  updateField("measurements", {
                    ...formData.measurements,
                    leftArm: Number(e.target.value) || undefined,
                  })
                }
              />
              <input
                className="input text-base py-3"
                type="number"
                placeholder="Right Arm"
                value={formData.measurements?.rightArm || ""}
                onChange={(e) =>
                  updateField("measurements", {
                    ...formData.measurements,
                    rightArm: Number(e.target.value) || undefined,
                  })
                }
              />
              <input
                className="input text-base py-3"
                type="number"
                placeholder="Left Thigh"
                value={formData.measurements?.leftThigh || ""}
                onChange={(e) =>
                  updateField("measurements", {
                    ...formData.measurements,
                    leftThigh: Number(e.target.value) || undefined,
                  })
                }
              />
              <input
                className="input text-base py-3"
                type="number"
                placeholder="Right Thigh"
                value={formData.measurements?.rightThigh || ""}
                onChange={(e) =>
                  updateField("measurements", {
                    ...formData.measurements,
                    rightThigh: Number(e.target.value) || undefined,
                  })
                }
              />
            </div>
            <p className="text-sm text-muted mt-2">
              Optional - helps with personalized exercise selection
            </p>
          </Section>

          <Section title="Injuries or Limitations (optional)">
            <textarea
              className="input text-base py-3"
              placeholder="Any injuries or physical limitations?"
              value={formData.injuries}
              onChange={(e) => updateField("injuries", e.target.value)}
              rows={3}
            />
          </Section>

          <Section title="Sleep Quality (1-5)">
            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map((level) => (
                <button
                  key={level}
                  onClick={() => updateField("sleepQuality", level)}
                  className={`py-4 rounded-xl font-semibold text-base ${
                    formData.sleepQuality === level
                      ? "bg-accent text-onAccent"
                      : "bg-surface2 text-inkSoft"
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </Section>

          <Section title="Stress Level (1-5)">
            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map((level) => (
                <button
                  key={level}
                  onClick={() => updateField("stressLevel", level)}
                  className={`py-4 rounded-xl font-semibold text-base ${
                    formData.stressLevel === level
                      ? "bg-accent text-onAccent"
                      : "bg-surface2 text-inkSoft"
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </Section>

          <Section title="Nutrition Situation">
            <textarea
              className="input text-base py-3"
              placeholder="Briefly describe your current nutrition"
              value={formData.nutrition}
              onChange={(e) => updateField("nutrition", e.target.value)}
              rows={3}
            />
          </Section>

          <Section title="Activities You Enjoy (optional)">
            <input
              className="input text-base py-3"
              placeholder="e.g., Weightlifting, running, swimming"
              value={formData.enjoyActivities}
              onChange={(e) => updateField("enjoyActivities", e.target.value)}
            />
          </Section>

          <Section title="Activities You Hate (optional)">
            <input
              className="input text-base py-3"
              placeholder="e.g., Long cardio, burpees"
              value={formData.hateActivities}
              onChange={(e) => updateField("hateActivities", e.target.value)}
            />
          </Section>

          <Section title="Supplements (optional)">
            <input
              className="input text-base py-3"
              placeholder="e.g., Protein powder, creatine"
              value={formData.supplements}
              onChange={(e) => updateField("supplements", e.target.value)}
            />
          </Section>

          <div className="grid grid-cols-2 gap-3 pt-4">
            <button
              className="btn-ghost py-4 text-base font-semibold"
              onClick={() => setStep(1)}
              disabled={busy}
            >
              ← Back
            </button>
            <button
              className="btn-primary py-4 text-base font-semibold"
              onClick={generateProgram}
              disabled={busy}
            >
              {busy ? "Generating..." : "Generate Program →"}
            </button>
          </div>
        </div>
      )}
      </div>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Chips<T extends string>({
  options,
  value,
  onPick,
}: {
  options: { key: T; label: string }[];
  value: T | string;
  onPick: (k: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => onPick(o.key)}
          className={`rounded-full border px-4 py-2 text-sm ${
            value === o.key
              ? "border-accent bg-accent text-onAccent"
              : "border-border bg-surface2 text-inkSoft"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
