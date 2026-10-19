// @vitest-environment node
// ai_runs logging against a real (in-process) Postgres with the Mistral SDK
// mocked: one content-free row per request that reached the model, with the
// routed model, token counts and an outcome; admin stats aggregate them.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import { createTestPool } from "@/test/pgPool";
import { runMigrations } from "./migrations";
import { getAiRunStats, meteredAi } from "./aiRuns";
import { completeJson } from "@/services/ai/llm";
import { noteRejected } from "@/services/ai/runMeter";

let pool: Pool;
let close: () => Promise<void>;
const complete = vi.fn();

vi.mock("@/server/db", () => ({ getPool: () => pool }));
vi.mock("@mistralai/mistralai", () => ({
  Mistral: class {
    chat = { complete };
  },
}));

const SECRET_PROMPT = "my left knee hurts when I squat";
const reply = (content: string) => ({ choices: [{ message: { content } }], usage: { promptTokens: 210, completionTokens: 40 } });
const limited = Object.assign(new Error("Status 429 rate_limited"), { statusCode: 429 });
const ask = () => completeJson([{ role: "user", content: SECRET_PROMPT }], {});

beforeAll(async () => {
  ({ pool, close } = await createTestPool());
  await runMigrations(pool);
  process.env.MISTRAL_API_KEY = "test-key-test-key-test-key";
  process.env.MISTRAL_MIN_INTERVAL_MS = "0";
  process.env.MISTRAL_RETRY_BASE_MS = "0";
});
afterAll(() => close());
beforeEach(async () => {
  complete.mockReset();
  await pool.query("delete from ai_runs");
});

const rows = async () => (await pool.query("select * from ai_runs order by created_at")).rows;

describe("meteredAi", () => {
  it("logs a successful run with the routed model and token counts, and no content", async () => {
    complete.mockResolvedValue(reply('{"answer":"Keep the weight."}'));
    const out = await meteredAi({ userId: null, task: "exercise_coach", inputVersion: "exercise-coach/1" }, ask);
    expect(out).toEqual({ answer: "Keep the weight." });
    const [row] = await rows();
    expect(row).toMatchObject({
      capability: "exercise_coach",
      task: "exercise_coach",
      outcome: "success",
      model: "mistral-small-latest",
      input_version: "exercise-coach/1",
      input_tokens: 210,
      output_tokens: 40,
      validation_issues: 0,
      error_code: null,
      fallback: false,
    });
    expect(row.latency_ms).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(row)).not.toContain("knee");
    expect(JSON.stringify(row)).not.toContain("Keep the weight");
  });

  it("logs a reply that failed validation as rejected, with the fallback used", async () => {
    complete.mockResolvedValue(reply('{"answer":"Add 40 kg."}'));
    await meteredAi({ userId: null, task: "analyst" }, async () => {
      await ask();
      noteRejected("INVALID");
      return "rule-based reading";
    });
    expect((await rows())[0]).toMatchObject({ outcome: "rejected", error_code: "INVALID", validation_issues: 1, fallback: true, model: "mistral-large-latest" });
  });

  it("logs an unparseable reply and a rate-limited outage", async () => {
    complete.mockResolvedValueOnce(reply("not json at all"));
    await expect(meteredAi({ userId: null, task: "trainer.chat" }, ask)).rejects.toThrow("unreadable");
    complete.mockRejectedValue(limited);
    await expect(meteredAi({ userId: null, task: "trainer.review" }, ask)).rejects.toThrow("busy");
    const [bad, busy] = await rows();
    expect(bad).toMatchObject({ outcome: "rejected", error_code: "BAD_OUTPUT", fallback: false });
    expect(busy).toMatchObject({ outcome: "rate_limited", error_code: "RATE_LIMITED", model: null });
  });

  it("doesn't log requests answered without the model", async () => {
    await meteredAi({ userId: null, task: "analyst" }, async () => "rules");
    expect(await rows()).toHaveLength(0);
  });

  it("never fails the request when logging fails", async () => {
    complete.mockResolvedValue(reply('{"ok":true}'));
    const spy = vi.spyOn(pool, "query").mockRejectedValueOnce(new Error("db down"));
    vi.spyOn(console, "error").mockImplementationOnce(() => {});
    await expect(meteredAi({ userId: null, task: "coach.meals" }, ask)).resolves.toEqual({ ok: true });
    spy.mockRestore();
  });
});

describe("getAiRunStats", () => {
  it("aggregates outcomes, latency, models, error codes and prompt versions", async () => {
    const insert = (task: string, outcome: string, latency: number, extra: Record<string, unknown> = {}) =>
      pool.query(
        `insert into ai_runs (capability, task, outcome, model, latency_ms, prompt_version, input_tokens, output_tokens, error_code, fallback)
         values ($1, $1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [task, outcome, extra.model ?? "mistral-small-latest", latency, extra.prompt ?? `${task}@aaaa0000`, 100, 20, extra.code ?? null, extra.fallback ?? false],
      );
    await insert("analyst", "success", 1000, { model: "mistral-large-latest" });
    await insert("analyst", "success", 3000, { model: "mistral-large-latest" });
    await insert("analyst", "rejected", 2000, { model: "mistral-large-latest", code: "INVALID", fallback: true });
    await insert("exercise_coach", "rate_limited", 50, { code: "RATE_LIMITED", model: null });
    await pool.query(`insert into ai_runs (capability, task, outcome, created_at) values ('analyst', 'analyst', 'success', now() - interval '30 days')`);

    const s = await getAiRunStats(pool, 7);
    expect(s.totals).toMatchObject({ runs: 4, success: 2, rejected: 1, rateLimited: 1, fallbacks: 1, inputTokens: 400, outputTokens: 80 });
    const analyst = s.tasks.find((t) => t.task === "analyst")!;
    expect(analyst).toMatchObject({ runs: 3, success: 2, rejected: 1, p50Ms: 2000, avgInputTokens: 100 });
    expect(s.models[0]).toEqual({ model: "mistral-large-latest", runs: 3 });
    expect(s.errors).toEqual(expect.arrayContaining([{ code: "INVALID", runs: 1 }, { code: "RATE_LIMITED", runs: 1 }]));
    expect(s.prompts.find((p) => p.task === "analyst")).toMatchObject({ promptVersion: "analyst@aaaa0000", runs: 3, rejected: 1 });
    expect(s.daily.reduce((n, d) => n + d.runs, 0)).toBe(4);
  });
});
