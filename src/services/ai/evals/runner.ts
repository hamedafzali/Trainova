// Deterministic eval runner. Each case plays a canned model reply through the
// real service (prompt → JSON parsing → validators → safety → fallback) under
// a run meter, then checks what the user would see and the ai_runs outcome it
// would log. The model is a stub: the caller's `respond` decides what the
// Mistral SDK returns, so no network and the same result on every run.

import { analyse } from "../analyst";
import { getCoachIntro, getMealIdeas } from "../coach";
import { coachExercise } from "../exerciseCoach";
import { newMeter, outcomeOf, runWithMeter, type AiRunMeter } from "../runMeter";
import type { AiTask } from "../tasks";
import { askTrainer, reviewTraining } from "../trainer";
import {
  ANALYST_FIXTURES,
  COACH_INTRO_FIXTURES,
  EVAL_TODAY,
  EXERCISE_FIXTURES,
  MEAL_FIXTURES,
  TRAINER_FIXTURES,
} from "./fixtures";
import dataset from "./dataset.v1.json";

export interface EvalExpect {
  /** The model's reply reached the user (after validation). */
  accepted: boolean;
  /** ai_runs outcome; null when the model must not be called at all. */
  outcome: "success" | "rejected" | "failed" | "rate_limited" | null;
  fallback?: string | null;
  errorCode?: string;
  actions?: number;
  notice?: boolean;
  validationIssues?: number;
  /** Text that must not appear in what the user sees. */
  mustNotContain?: string[];
}

export interface EvalCase {
  id: string;
  task: AiTask;
  fixture: string;
  reply: unknown;
  question?: string;
  message?: string;
  expect: EvalExpect;
}

export interface EvalResult {
  id: string;
  task: AiTask;
  passed: boolean;
  failures: string[];
  outcome: string | null;
}

export const EVAL_DATASET = dataset as { version: string; cases: EvalCase[] };

type Observed = { accepted: boolean; shown: string; fallback?: string | null; actions?: number; notice?: boolean };

function fixture<T>(table: Record<string, T>, name: string): T {
  const v = table[name];
  if (!v) throw new Error(`Unknown eval fixture "${name}"`);
  return v;
}

async function play(c: EvalCase): Promise<Observed> {
  switch (c.task) {
    case "analyst": {
      const f = fixture(ANALYST_FIXTURES, c.fixture);
      const r = await analyse(f.input, f.weeks, EVAL_TODAY, { ai: true });
      const shown = [r.interpretation.summary, ...r.interpretation.points.flatMap((p) => [p.title, p.detail])].join("\n");
      return { accepted: r.interpretation.source === "ai", shown, fallback: r.fallback };
    }
    case "exercise_coach": {
      const f = fixture(EXERCISE_FIXTURES, c.fixture);
      const r = await coachExercise(f.input, f.sessionId, f.exerciseId, c.question ?? null, { ai: true });
      if (!r) throw new Error(`Fixture "${c.fixture}" has no such exercise`);
      return { accepted: r.reading.source === "ai" && !r.fallback, shown: [r.reading.answer, ...r.reading.cues].join("\n"), fallback: r.fallback };
    }
    case "trainer.chat": {
      const ctx = fixture(TRAINER_FIXTURES, c.fixture);
      const raw = c.reply as { reply?: string };
      const r = await askTrainer(ctx, [{ role: "user", content: c.message ?? "Hi" }]);
      return { accepted: r.reply === raw.reply, shown: r.reply, actions: r.actions.length, notice: r.notice !== null };
    }
    case "trainer.review": {
      const ctx = fixture(TRAINER_FIXTURES, c.fixture);
      try {
        const r = await reviewTraining(ctx);
        return { accepted: true, shown: [r.headline, r.summary, ...r.wins, ...r.focus].join("\n"), actions: r.actions.length };
      } catch {
        return { accepted: false, shown: "" };
      }
    }
    case "coach.intro": {
      const intro = await getCoachIntro(fixture(COACH_INTRO_FIXTURES, c.fixture));
      return { accepted: intro !== null, shown: intro ?? "" };
    }
    case "coach.meals": {
      const raw = c.reply as { mealIdeas?: { idea: string }[] };
      const r = await getMealIdeas(fixture(MEAL_FIXTURES, c.fixture));
      const shown = r.mealIdeas.map((m) => m.idea).join("\n");
      return { accepted: shown === (raw.mealIdeas ?? []).map((m) => m.idea).join("\n"), shown };
    }
  }
}

function check(c: EvalCase, o: Observed, m: AiRunMeter): string[] {
  const e = c.expect;
  const f: string[] = [];
  const want = (what: string, expected: unknown, actual: unknown) => {
    if (expected !== undefined && expected !== actual) f.push(`${what}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  };
  want("accepted", e.accepted, o.accepted);
  want("outcome", e.outcome, m.calls === 0 ? null : outcomeOf(m));
  if ("fallback" in e) want("fallback", e.fallback, o.fallback ?? null);
  want("errorCode", e.errorCode, m.errorCode);
  want("actions", e.actions, o.actions);
  want("notice", e.notice, o.notice);
  want("validationIssues", e.validationIssues, m.validationIssues);
  for (const s of e.mustNotContain ?? []) if (o.shown.toLowerCase().includes(s.toLowerCase())) f.push(`shown text contains "${s}"`);
  return f;
}

/** Runs one case. `respond` sets the stubbed model's reply text for this case. */
export async function runEvalCase(c: EvalCase, respond: (content: string) => void): Promise<EvalResult> {
  respond(typeof c.reply === "string" ? c.reply : JSON.stringify(c.reply));
  const meter = newMeter(c.task);
  let failures: string[];
  try {
    const observed = await runWithMeter(meter, () => play(c));
    failures = check(c, observed, meter);
  } catch (e) {
    failures = [`threw: ${e instanceof Error ? e.message : String(e)}`];
  }
  return { id: c.id, task: c.task, passed: failures.length === 0, failures, outcome: meter.calls === 0 ? null : outcomeOf(meter) };
}
