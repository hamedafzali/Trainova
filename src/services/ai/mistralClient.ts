// Mistral client plus model selection.
//
// Which models a key may call depends on its subscription tier (the free tier
// rejects mistral-large with 403 "tier_not_allowed"). Rather than hard-coding
// one model, calls go through `chatComplete`, which tries the preferred models
// in order, skips ones the key can't use, and remembers the first that works.
// Set MISTRAL_MODEL to pin a model.
//
// Lower tiers also allow about one request per second, and the coach page
// fires several at once (status review, insights line, chat). Requests are
// queued and spaced, and a 429 is retried once. A model that stays rate
// limited (its quota is used up) is skipped for a while and the next one is
// used, so the coach keeps working on a smaller model.
//
// The model order depends on the task's tier (see tasks.ts): deep tasks start
// on the largest model, fast ones on a small one. The task comes from the
// current AI run (runMeter.ts), which also receives the model used and the
// token counts for ai_runs.

import { Mistral } from "@mistralai/mistralai";
import { currentRun } from "./runMeter";
import { pinnedModel, TIER_MODELS, type AiTier } from "./tasks";

let client: Mistral | null = null;

export function getMistralClient(): Mistral {
  if (!client) {
    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) throw new Error("MISTRAL_API_KEY environment variable is not set");
    client = new Mistral({ apiKey });
  }
  return client;
}

/** Tier → the last model that answered for it. */
const workingModel = new Map<AiTier, string>();
const deniedModels = new Set<string>();
/** Model → time until which it is skipped because it kept returning 429. */
const coolingUntil = new Map<string, number>();

export function candidateModels(tier: AiTier = "deep"): string[] {
  const pinned = pinnedModel(tier);
  const list = pinned ? [pinned, ...TIER_MODELS[tier]] : TIER_MODELS[tier];
  const working = workingModel.get(tier);
  const ordered = working ? [working, ...list] : list;
  const usable = [...new Set(ordered)].filter((m) => !deniedModels.has(m));
  const now = Date.now();
  const ready = usable.filter((m) => (coolingUntil.get(m) ?? 0) <= now);
  // Everything cooling down: try anyway rather than fail without asking.
  return ready.length > 0 ? ready : usable;
}

/** 403 (tier) / 404 (unknown model): this model is unusable with this key, try the next. */
export function isModelDenied(e: unknown): boolean {
  const status = (e as { statusCode?: number })?.statusCode;
  if (status === 403 || status === 404) return true;
  const msg = e instanceof Error ? e.message : String(e);
  return /Status (403|404)\b|tier_not_allowed|invalid_model/i.test(msg);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const envMs = (name: string, fallback: number) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v >= 0 ? v : fallback;
};

let queue: Promise<void> = Promise.resolve();
let lastStart = 0;

/** Resolves when this process may start its next Mistral request. */
function nextSlot(): Promise<void> {
  const slot = queue.then(async () => {
    const wait = lastStart + envMs("MISTRAL_MIN_INTERVAL_MS", 1100) - Date.now();
    if (wait > 0) await sleep(wait);
    lastStart = Date.now();
  });
  queue = slot.catch(() => {});
  return slot;
}

export function isRateLimited(e: unknown): boolean {
  if ((e as { statusCode?: number })?.statusCode === 429) return true;
  const msg = e instanceof Error ? e.message : String(e);
  return /Status 429\b|rate_limited/i.test(msg);
}

const MAX_RATE_RETRIES = 1;

type CompleteRequest = Omit<Parameters<Mistral["chat"]["complete"]>[0], "model">;
type CompleteOptions = Parameters<Mistral["chat"]["complete"]>[1];

/** chat.complete on the best model this key may use for the current task's tier. Rethrows other errors. */
export async function chatComplete(req: CompleteRequest, opts?: CompleteOptions) {
  const run = currentRun();
  try {
    const { res, model } = await completeOnBestModel(run?.tier ?? "deep", req, opts);
    if (run) {
      run.model = model;
      run.inputTokens += res.usage?.promptTokens ?? 0;
      run.outputTokens += res.usage?.completionTokens ?? 0;
    }
    return res;
  } catch (e) {
    if (run) run.errorCode = isRateLimited(e) ? "RATE_LIMITED" : "UNAVAILABLE";
    throw e;
  }
}

async function completeOnBestModel(tier: AiTier, req: CompleteRequest, opts?: CompleteOptions) {
  const models = candidateModels(tier);
  if (models.length === 0) throw new Error("No Mistral model is available for this API key.");
  let lastError: unknown;
  for (const model of models) {
    try {
      const run = currentRun();
      if (run) run.calls++;
      const res = await completeWithRetry({ ...req, model }, opts);
      if (workingModel.get(tier) !== model) console.info(`[ai] using Mistral model ${model} for ${tier} tasks`);
      workingModel.set(tier, model);
      return { res, model };
    } catch (e) {
      if (isModelDenied(e)) {
        console.warn(`[ai] Mistral model ${model} not available for this key, trying the next one`);
        deniedModels.add(model);
      } else if (isRateLimited(e)) {
        console.warn(`[ai] Mistral model ${model} is rate limited, trying the next one`);
        coolingUntil.set(model, Date.now() + envMs("MISTRAL_RATE_COOLDOWN_MS", 10 * 60_000));
      } else {
        throw e;
      }
      if (workingModel.get(tier) === model) workingModel.delete(tier);
      lastError = e;
    }
  }
  throw lastError;
}

async function completeWithRetry(req: Parameters<Mistral["chat"]["complete"]>[0], opts?: CompleteOptions) {
  for (let attempt = 0; ; attempt++) {
    await nextSlot();
    try {
      return await getMistralClient().chat.complete(req, opts);
    } catch (e) {
      if (!isRateLimited(e) || attempt >= MAX_RATE_RETRIES) throw e;
      await sleep(envMs("MISTRAL_RETRY_BASE_MS", 1500) * 2 ** attempt);
    }
  }
}
