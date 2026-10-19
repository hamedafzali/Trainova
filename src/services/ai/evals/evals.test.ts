// @vitest-environment node
// AI eval suite (pnpm eval). Plays every case in the versioned dataset through
// the real services with the Mistral SDK stubbed, and fails on any case whose
// reply is kept or dropped differently than the dataset says.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { EVAL_DATASET, runEvalCase, type EvalResult } from "./runner";

const complete = vi.fn();
vi.mock("@mistralai/mistralai", () => ({
  Mistral: class {
    chat = { complete };
  },
}));

const respond = (content: string) =>
  complete.mockResolvedValue({ choices: [{ message: { content } }], usage: { promptTokens: 1, completionTokens: 1 } });

const results: EvalResult[] = [];

beforeAll(() => {
  process.env.MISTRAL_API_KEY = "test-key-test-key-test-key";
  process.env.MISTRAL_MIN_INTERVAL_MS = "0";
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterAll(() => {
  const byTask = new Map<string, { passed: number; total: number }>();
  for (const r of results) {
    const t = byTask.get(r.task) ?? { passed: 0, total: 0 };
    t.total++;
    if (r.passed) t.passed++;
    byTask.set(r.task, t);
  }
  const lines = [...byTask].map(([task, t]) => `  ${task.padEnd(16)} ${t.passed}/${t.total}`);
  process.stdout.write(`\nAI evals (dataset v${EVAL_DATASET.version}):\n${lines.join("\n")}\n`);
});

describe(`AI eval dataset v${EVAL_DATASET.version}`, () => {
  it("has unique case ids", () => {
    const ids = EVAL_DATASET.cases.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(EVAL_DATASET.cases.map((c) => [c.id, c] as const))("%s", async (_id, c) => {
    const r = await runEvalCase(c, respond);
    results.push(r);
    expect(r.failures).toEqual([]);
  });
});
