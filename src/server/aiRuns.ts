// AI run log: one content-free row in ai_runs per AI request that reached the
// model. Rows hold the task, model, latency, token counts and outcome codes,
// never the prompt, the reply or anything the user typed.

import type { Pool } from "pg";
import { getPool } from "./db";
import { newMeter, outcomeOf, runWithMeter, type AiRunMeter } from "@/services/ai/runMeter";
import { AI_TASKS, type AiTask } from "@/services/ai/tasks";

export async function recordAiRun(
  pool: Pool,
  row: { userId: string | null; meter: AiRunMeter; latencyMs: number; fallback: boolean; inputVersion?: string | null },
): Promise<void> {
  const m = row.meter;
  await pool.query(
    `insert into ai_runs
       (user_id, capability, task, outcome, model, latency_ms, input_version, prompt_version,
        input_tokens, output_tokens, validation_issues, error_code, fallback)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [
      row.userId,
      AI_TASKS[m.task].capability,
      m.task,
      outcomeOf(m),
      m.model,
      Math.round(row.latencyMs),
      row.inputVersion ?? null,
      m.promptVersion,
      m.inputTokens || null,
      m.outputTokens || null,
      m.validationIssues,
      m.errorCode,
      row.fallback,
    ],
  );
}

/**
 * Runs one AI request under a meter and logs it. Requests answered without
 * the model (cache hit, AI off, red flag, no data) aren't logged. A failure to
 * log never fails the request.
 */
export async function meteredAi<T>(
  ctx: { userId: string | null; task: AiTask; inputVersion?: string | null },
  fn: () => Promise<T>,
): Promise<T> {
  const meter = newMeter(ctx.task);
  const started = Date.now();
  const log = async (fallback: boolean) => {
    const pool = getPool();
    if (!pool || meter.calls === 0) return;
    try {
      await recordAiRun(pool, { userId: ctx.userId, meter, latencyMs: Date.now() - started, fallback, inputVersion: ctx.inputVersion });
    } catch (e) {
      console.error("Failed to record AI run:", e instanceof Error ? e.message : e);
    }
  };
  let result: T;
  try {
    result = await runWithMeter(meter, fn);
  } catch (e) {
    meter.errorCode ??= "INTERNAL";
    await log(false);
    throw e;
  }
  // The service answered anyway after a failed or rejected model reply: it used its fallback.
  await log(outcomeOf(meter) !== "success");
  return result;
}

// ---------------------------------------------------------------------------
// Admin observability

export interface AiTaskStats {
  task: string;
  runs: number;
  success: number;
  rejected: number;
  failed: number;
  rateLimited: number;
  fallbacks: number;
  p50Ms: number | null;
  p95Ms: number | null;
  avgInputTokens: number | null;
  avgOutputTokens: number | null;
}

export interface AiRunStats {
  days: number;
  totals: { runs: number; success: number; rejected: number; failed: number; rateLimited: number; fallbacks: number; users: number; inputTokens: number; outputTokens: number };
  tasks: AiTaskStats[];
  models: { model: string; runs: number }[];
  errors: { code: string; runs: number }[];
  prompts: { task: string; promptVersion: string; runs: number; rejected: number; lastSeen: string }[];
  daily: { day: string; runs: number; success: number }[];
}

const num = (v: unknown) => Number(v ?? 0);
const numOrNull = (v: unknown) => (v === null || v === undefined ? null : Math.round(Number(v)));

/** Aggregates over the last `days` days. Counts and timings only. */
export async function getAiRunStats(pool: Pool, days: number): Promise<AiRunStats> {
  const since = [String(days)];
  const window = `created_at > now() - ($1 || ' days')::interval`;
  const counts = `
    count(*) as runs,
    count(*) filter (where outcome = 'success') as success,
    count(*) filter (where outcome = 'rejected') as rejected,
    count(*) filter (where outcome = 'failed') as failed,
    count(*) filter (where outcome = 'rate_limited') as rate_limited,
    count(*) filter (where fallback) as fallbacks`;

  const [totals, tasks, models, errors, prompts, daily] = await Promise.all([
    pool.query(
      `select ${counts}, count(distinct user_id) as users,
              coalesce(sum(input_tokens), 0) as input_tokens, coalesce(sum(output_tokens), 0) as output_tokens
       from ai_runs where ${window}`,
      since,
    ),
    pool.query(
      `select coalesce(task, capability) as task, ${counts},
              percentile_cont(0.5) within group (order by latency_ms) as p50,
              percentile_cont(0.95) within group (order by latency_ms) as p95,
              avg(input_tokens) as avg_in, avg(output_tokens) as avg_out
       from ai_runs where ${window} group by 1 order by runs desc`,
      since,
    ),
    pool.query(
      `select model, count(*) as runs from ai_runs where ${window} and model is not null group by model order by runs desc`,
      since,
    ),
    pool.query(
      `select error_code as code, count(*) as runs from ai_runs where ${window} and error_code is not null
       group by error_code order by runs desc`,
      since,
    ),
    pool.query(
      `select coalesce(task, capability) as task, prompt_version, count(*) as runs,
              count(*) filter (where outcome = 'rejected') as rejected, max(created_at) as last_seen
       from ai_runs where ${window} and prompt_version is not null
       group by 1, 2 order by last_seen desc limit 20`,
      since,
    ),
    pool.query(
      `select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day, count(*) as runs,
              count(*) filter (where outcome = 'success') as success
       from ai_runs where ${window} group by 1 order by 1`,
      since,
    ),
  ]);

  const t = totals.rows[0] ?? {};
  return {
    days,
    totals: {
      runs: num(t.runs),
      success: num(t.success),
      rejected: num(t.rejected),
      failed: num(t.failed),
      rateLimited: num(t.rate_limited),
      fallbacks: num(t.fallbacks),
      users: num(t.users),
      inputTokens: num(t.input_tokens),
      outputTokens: num(t.output_tokens),
    },
    tasks: tasks.rows.map((r) => ({
      task: String(r.task),
      runs: num(r.runs),
      success: num(r.success),
      rejected: num(r.rejected),
      failed: num(r.failed),
      rateLimited: num(r.rate_limited),
      fallbacks: num(r.fallbacks),
      p50Ms: numOrNull(r.p50),
      p95Ms: numOrNull(r.p95),
      avgInputTokens: numOrNull(r.avg_in),
      avgOutputTokens: numOrNull(r.avg_out),
    })),
    models: models.rows.map((r) => ({ model: String(r.model), runs: num(r.runs) })),
    errors: errors.rows.map((r) => ({ code: String(r.code), runs: num(r.runs) })),
    prompts: prompts.rows.map((r) => ({
      task: String(r.task),
      promptVersion: String(r.prompt_version),
      runs: num(r.runs),
      rejected: num(r.rejected),
      lastSeen: new Date(r.last_seen).toISOString(),
    })),
    daily: daily.rows.map((r) => ({ day: String(r.day), runs: num(r.runs), success: num(r.success) })),
  };
}
