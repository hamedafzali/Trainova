// Per-request AI run metering. A route opens a run with `meteredAi` (src/server/aiRuns.ts); the
// model client and the services report into it through AsyncLocalStorage, so
// nothing has to thread a logger through every call. The meter holds only
// metadata (model, token counts, codes), never prompt or reply text.

import { AsyncLocalStorage } from "node:async_hooks";
import { AI_TASKS, type AiTask, type AiTier } from "./tasks";

export interface AiRunMeter {
  task: AiTask;
  tier: AiTier;
  promptVersion: string | null;
  /** Model calls attempted (0 = answered without the model). */
  calls: number;
  /** The model that answered (last success). */
  model: string | null;
  inputTokens: number;
  outputTokens: number;
  /** RATE_LIMITED | UNAVAILABLE | INTERNAL | BAD_OUTPUT | a validation code such as INVALID or UNSAFE. */
  errorCode: string | null;
  validationIssues: number;
}

const storage = new AsyncLocalStorage<AiRunMeter>();

export function currentRun(): AiRunMeter | undefined {
  return storage.getStore();
}

export function newMeter(task: AiTask): AiRunMeter {
  return {
    task,
    tier: AI_TASKS[task].tier,
    promptVersion: null,
    calls: 0,
    model: null,
    inputTokens: 0,
    outputTokens: 0,
    errorCode: null,
    validationIssues: 0,
  };
}

/** Runs `fn` with `meter` as the current run, so model calls inside it report into it. */
export function runWithMeter<T>(meter: AiRunMeter, fn: () => Promise<T>): Promise<T> {
  return storage.run(meter, fn);
}

/** The task's system prompt version, set by the service before it calls the model. */
export function notePromptVersion(version: string) {
  const m = storage.getStore();
  if (m) m.promptVersion = version;
}

/** A model reply was thrown away by validation (`code` e.g. INVALID, UNSAFE). */
export function noteRejected(code: string) {
  const m = storage.getStore();
  if (!m) return;
  m.validationIssues += 1;
  m.errorCode ??= code;
}

/** Parts of a reply that validation dropped while the rest was kept (e.g. invalid plan actions). */
export function noteIssues(count: number) {
  const m = storage.getStore();
  if (m && count > 0) m.validationIssues += count;
}

export type AiOutcome = "success" | "rejected" | "failed" | "rate_limited";

/** The ai_runs outcome for a finished meter. */
export function outcomeOf(m: Pick<AiRunMeter, "errorCode" | "validationIssues">): AiOutcome {
  if (m.errorCode === "RATE_LIMITED") return "rate_limited";
  if (m.errorCode === "UNAVAILABLE" || m.errorCode === "INTERNAL") return "failed";
  if (m.errorCode) return "rejected";
  return "success";
}
