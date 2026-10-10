// AI trainer chat: one model call per user message, grounded in a snapshot of
// the client's plans and training, returning text plus validated plan actions.

import {
  LIMITS,
  parseTrainerReview,
  validateTrainerActions,
  type TrainerAction,
  type TrainerConsistency,
  type TrainerContext,
  type TrainerReview,
} from "@/domain/trainer";
import { completeJson, LlmError, type ChatMessage } from "./llm";
import { harmfulAdviceReason, hasRedFlagSymptoms, sanitizeContent } from "./safety";
import { renderTrainerContext, REVIEW_SYSTEM_PROMPT, TRAINER_SYSTEM_PROMPT } from "./prompts/trainer";

export const MAX_MESSAGE_CHARS = 2000;
export const MAX_HISTORY = 12;

export type TrainerTurn = { role: "user" | "assistant"; content: string };

export interface TrainerReply {
  reply: string;
  actions: TrainerAction[];
  /** Shown above the reply, e.g. for red-flag symptoms. */
  notice: string | null;
}

const RED_FLAG_NOTICE =
  "What you describe can be a warning sign. Stop training today and get checked by a doctor before your next session — urgently if it's chest pain, fainting or trouble breathing.";

const SAFE_FALLBACK =
  "I can't help with that one safely. For pain or anything medical, a physiotherapist or doctor is the right call — happy to adjust your plan around what they tell you.";

const s = (v: unknown, max = 80): string => (typeof v === "string" ? v.slice(0, max) : "");
const n = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const nn = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const arr = (v: unknown, max: number): Record<string, unknown>[] =>
  Array.isArray(v) ? v.slice(0, max).filter((x): x is Record<string, unknown> => !!x && typeof x === "object") : [];

function parseConsistency(raw: unknown): TrainerConsistency {
  const c = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const count = (v: unknown, max: number) => Math.min(max, Math.max(0, Math.round(n(v))));
  const days = nn(c.daysSinceLast);
  return {
    program: typeof c.program === "string" ? s(c.program) : null,
    programDays: nn(c.programDays) === null ? null : count(c.programDays, 14),
    sessionsThisWeek: count(c.sessionsThisWeek, 21),
    sessionsLast28: count(c.sessionsLast28, 84),
    weeksTrainedLast4: count(c.weeksTrainedLast4, 4),
    daysSinceLast: days === null ? null : count(days, 3650),
    weekStreak: count(c.weekStreak, 520),
  };
}

/** Coerces an untrusted request body into a well-formed, size-bounded context. */
export function parseTrainerContext(raw: unknown): TrainerContext | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const p = (r.profile && typeof r.profile === "object" ? r.profile : {}) as Record<string, unknown>;
  const pick = <T extends string>(v: unknown, opts: readonly T[]): T | null => (opts.includes(v as T) ? (v as T) : null);
  return {
    today: s(r.today, 10),
    viewing: typeof r.viewing === "string" && r.viewing.trim() ? s(r.viewing, 600) : null,
    units: r.units === "lb" ? "lb" : "kg",
    profile: {
      goal: pick(p.goal, ["strength", "hypertrophy", "fat_loss", "health"] as const),
      experience: pick(p.experience, ["beginner", "intermediate", "advanced"] as const),
      sex: pick(p.sex, ["male", "female"] as const),
      ageYears: nn(p.ageYears),
      weightKg: nn(p.weightKg),
    },
    nextWorkout: typeof r.nextWorkout === "string" ? s(r.nextWorkout, 4) : null,
    consistency: parseConsistency(r.consistency),
    workouts: arr(r.workouts, LIMITS.workouts).map((w) => ({
      ref: s(w.ref, 4),
      templateId: s(w.templateId),
      name: s(w.name),
      program: typeof w.program === "string" ? s(w.program) : null,
      slots: arr(w.slots, LIMITS.slotsPerWorkout).map((x) => ({
        slot: n(x.slot),
        teId: s(x.teId),
        exerciseId: s(x.exerciseId),
        name: s(x.name),
        sets: n(x.sets),
        reps: n(x.reps),
        weightKg: nn(x.weightKg),
        restSeconds: n(x.restSeconds),
      })),
    })),
    recent: arr(r.recent, LIMITS.recentSessions).map((x) => ({
      date: s(x.date, 10),
      title: s(x.title),
      minutes: nn(x.minutes),
      difficulty: (["easy", "right", "hard"] as const).find((d) => d === x.difficulty) ?? null,
      pain: typeof x.pain === "string" ? s(x.pain, 200) : null,
      exercises: arr(x.exercises, 15).map((e) => ({ name: s(e.name), sets: n(e.sets), best: s(e.best, 30) })),
    })),
    records: arr(r.records, LIMITS.records).map((x) => ({
      name: s(x.name),
      kind: (["e1rm", "max_weight", "max_reps"] as const).find((k) => k === x.kind) ?? "max_weight",
      value: n(x.value),
      date: s(x.date, 10),
    })),
    catalogue: arr(r.catalogue, LIMITS.catalogue).map((c) => ({
      id: s(c.id),
      name: s(c.name),
      muscle: typeof c.muscle === "string" ? s(c.muscle, 30) : null,
      equipment: typeof c.equipment === "string" ? s(c.equipment, 30) : null,
      type: (["weight_reps", "bodyweight_reps", "weighted_bodyweight", "assisted_bodyweight", "duration", "cardio"] as const).find(
        (t) => t === c.type,
      ) ?? "weight_reps",
    })),
  };
}

export async function askTrainer(ctx: TrainerContext, history: TrainerTurn[]): Promise<TrainerReply> {
  const turns = history.slice(-MAX_HISTORY).map((t) => ({
    role: t.role,
    content: sanitizeContent(t.content.slice(0, MAX_MESSAGE_CHARS)),
  }));
  const lastUser = [...turns].reverse().find((t) => t.role === "user")?.content ?? "";
  const redFlag = hasRedFlagSymptoms(lastUser);

  const messages: ChatMessage[] = [
    { role: "system", content: TRAINER_SYSTEM_PROMPT },
    { role: "system", content: renderTrainerContext(ctx) },
    ...turns,
  ];
  const out = await completeJson(messages, { temperature: 0.4, maxTokens: 1200 });

  let reply = typeof out.reply === "string" ? sanitizeContent(out.reply.trim()) : "";
  let actions = validateTrainerActions(out.actions, ctx);
  if (!reply) reply = actions.length ? "Here's what I'd change:" : "Sorry — I didn't catch that. Could you rephrase?";
  if (harmfulAdviceReason(reply)) {
    reply = SAFE_FALLBACK;
    actions = [];
  }
  if (redFlag) actions = [];
  return { reply, actions, notice: redFlag ? RED_FLAG_NOTICE : null };
}

/** Status review of the client's training against their active plan. */
export async function reviewTraining(ctx: TrainerContext): Promise<TrainerReview> {
  const out = await completeJson(
    [
      { role: "system", content: REVIEW_SYSTEM_PROMPT },
      { role: "system", content: renderTrainerContext(ctx) },
      { role: "user", content: "Write my status review." },
    ],
    { temperature: 0.3, maxTokens: 1200 },
  );
  const review = parseTrainerReview(out, ctx, (text) => !harmfulAdviceReason(text));
  if (!review) throw new LlmError("The coach couldn't put a review together. Try again.", "BAD_OUTPUT");
  // Logged pain in recent sessions: advice only, no automatic plan edits.
  if (ctx.recent.some((r) => r.pain && hasRedFlagSymptoms(r.pain))) review.actions = [];
  return review;
}
