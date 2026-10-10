// Mistral client plus model selection.
//
// Which models a key may call depends on its subscription tier (the free tier
// rejects mistral-large with 403 "tier_not_allowed"). Rather than hard-coding
// one model, calls go through `chatComplete`, which tries the preferred models
// in order, skips ones the key can't use, and remembers the first that works.
// Set MISTRAL_MODEL to pin a model.

import { Mistral } from "@mistralai/mistralai";

let client: Mistral | null = null;

export function getMistralClient(): Mistral {
  if (!client) {
    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) throw new Error("MISTRAL_API_KEY environment variable is not set");
    client = new Mistral({ apiKey });
  }
  return client;
}

/** Best first; all support JSON mode. */
const PREFERRED_MODELS = ["mistral-large-latest", "mistral-medium-latest", "mistral-small-latest"];

let workingModel: string | null = null;
const deniedModels = new Set<string>();

export function candidateModels(): string[] {
  const pinned = process.env.MISTRAL_MODEL?.trim();
  const list = pinned ? [pinned, ...PREFERRED_MODELS] : PREFERRED_MODELS;
  const ordered = workingModel ? [workingModel, ...list] : list;
  return [...new Set(ordered)].filter((m) => !deniedModels.has(m));
}

/** 403 (tier) / 404 (unknown model): this model is unusable with this key, try the next. */
export function isModelDenied(e: unknown): boolean {
  const status = (e as { statusCode?: number })?.statusCode;
  if (status === 403 || status === 404) return true;
  const msg = e instanceof Error ? e.message : String(e);
  return /Status (403|404)\b|tier_not_allowed|invalid_model/i.test(msg);
}

type CompleteRequest = Omit<Parameters<Mistral["chat"]["complete"]>[0], "model">;
type CompleteOptions = Parameters<Mistral["chat"]["complete"]>[1];

/** chat.complete on the best model this key may use. Rethrows other errors. */
export async function chatComplete(req: CompleteRequest, opts?: CompleteOptions) {
  const models = candidateModels();
  if (models.length === 0) throw new Error("No Mistral model is available for this API key.");
  let lastError: unknown;
  for (const model of models) {
    try {
      const res = await getMistralClient().chat.complete({ ...req, model }, opts);
      if (workingModel !== model) console.info(`[ai] using Mistral model ${model}`);
      workingModel = model;
      return res;
    } catch (e) {
      if (!isModelDenied(e)) throw e;
      console.warn(`[ai] Mistral model ${model} not available for this key, trying the next one`);
      deniedModels.add(model);
      if (workingModel === model) workingModel = null;
      lastError = e;
    }
  }
  throw lastError;
}
