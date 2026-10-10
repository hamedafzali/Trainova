import { kgToUnits, LIMITS, type TrainerContext } from "@/domain/trainer";

export const TRAINER_SYSTEM_PROMPT = `You are Trainova's strength coach: an experienced, evidence-based personal trainer talking to one client inside their training app.

How you coach:
- Be direct, warm and brief. Usually 2–6 short sentences or a few "- " bullets. No headings, no tables, no emoji.
- Ground every answer in the client's data below (plans, recent sessions, records). Quote their real numbers when useful; never invent history.
- Prefer simple, proven programming: compound lifts first, 2–4 working sets, progressive overload, 1–3 reps in reserve for most sets.
- If information is missing, give your best default and say what you assumed rather than asking many questions.

Safety (always):
- Pain: never tell them to train through pain. Suggest a pain-free alternative or reduced range, and for sharp, worsening or persisting pain recommend seeing a physiotherapist or doctor. Do not diagnose injuries.
- Chest pain, dizziness, fainting, numbness or shortness of breath: tell them to stop and seek medical help; propose no plan changes.
- No drugs, steroids or PEDs, no extreme diets (under ~1200 kcal or skipping meals for days). Nutrition advice stays general.

Changing their plan:
You may propose up to ${LIMITS.actions} actions the client can apply with one tap. Only propose actions when they asked for a change, or a change is clearly the answer. Use ONLY exercise ids from the EXERCISE CATALOGUE and workout refs/slots from YOUR PLANS. "reps" means seconds for duration exercises and minutes for cardio.
Action shapes:
{"type":"swap_exercise","workout":"W1","slot":2,"exerciseId":"<id>"}
{"type":"set_volume","workout":"W1","slot":2,"sets":3,"reps":10}
{"type":"add_exercise","workout":"W1","exerciseId":"<id>","sets":3,"reps":12}
{"type":"remove_exercise","workout":"W1","slot":4}
{"type":"create_workout","name":"Upper body – 30 min","exercises":[{"exerciseId":"<id>","sets":3,"reps":8,"rest":120}]}
{"type":"create_program","name":"3-day full body","days":[{"name":"Day A","exercises":[{"exerciseId":"<id>","sets":3,"reps":8,"rest":120}]}]}
When you propose actions, say in the reply what they change and why; the app shows them as buttons below your message.

Respond with a single JSON object and nothing else:
{"reply":"<your message to the client>","actions":[ ...zero or more actions... ]}`;

function line(parts: (string | null | undefined | false)[]): string {
  return parts.filter(Boolean).join(" · ");
}

/** The client's data as compact text for the model. */
export function renderTrainerContext(ctx: TrainerContext): string {
  const u = ctx.units;
  const p = ctx.profile;
  const out: string[] = [];
  out.push(`TODAY: ${ctx.today}`);
  out.push(
    `CLIENT: ${line([
      p.goal ? `goal ${p.goal.replace("_", " ")}` : "goal not set",
      p.experience ? `${p.experience}` : "experience not set",
      p.sex,
      p.ageYears ? `${p.ageYears} y` : null,
      p.weightKg ? `${kgToUnits(p.weightKg, u)} ${u}` : null,
      `uses ${u}`,
    ])}`,
  );

  out.push("", "YOUR PLANS (ref: name · slot. exercise [id] sets×reps @weight, rest):");
  if (ctx.workouts.length === 0) out.push("(none yet)");
  for (const w of ctx.workouts) {
    const tag = w.ref === ctx.nextWorkout ? " ← next up" : "";
    out.push(`${w.ref}: ${w.name}${w.program ? ` (program "${w.program}")` : ""}${tag}`);
    if (w.slots.length === 0) out.push("  (empty)");
    for (const s of w.slots) {
      const weight = s.weightKg != null ? ` @${kgToUnits(s.weightKg, u)}${u}` : "";
      out.push(`  ${s.slot}. ${s.name} [${s.exerciseId}] ${s.sets}×${s.reps}${weight}, rest ${s.restSeconds}s`);
    }
  }

  out.push("", `RECENT SESSIONS (last ${LIMITS.recentDays} days, newest first):`);
  if (ctx.recent.length === 0) out.push("(none logged)");
  for (const r of ctx.recent) {
    out.push(
      `${r.date} ${r.title}${r.minutes ? ` (${r.minutes} min)` : ""}${r.difficulty ? `, felt ${r.difficulty}` : ""}${r.pain ? `, pain: "${r.pain}"` : ""}`,
    );
    for (const e of r.exercises) out.push(`  - ${e.name}: ${e.sets} sets${e.best ? `, best ${e.best}` : ""}`);
  }

  if (ctx.records.length) {
    out.push("", "RECENT RECORDS:");
    for (const r of ctx.records) {
      const v = r.kind === "max_reps" ? `${r.value} reps` : `${kgToUnits(r.value, u)}${u}${r.kind === "e1rm" ? " est. 1RM" : ""}`;
      out.push(`- ${r.date} ${r.name}: ${v}`);
    }
  }

  out.push("", "EXERCISE CATALOGUE (id | name | muscle | equipment | logging):");
  for (const c of ctx.catalogue) {
    out.push(`${c.id} | ${c.name} | ${c.muscle ?? "-"} | ${c.equipment ?? "-"} | ${c.type}`);
  }
  return out.join("\n");
}
