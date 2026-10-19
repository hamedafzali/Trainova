import { beforeEach, describe, expect, it, vi } from "vitest";

const complete = vi.fn();
vi.mock("@mistralai/mistralai", () => ({
  Mistral: class {
    chat = { complete };
  },
}));

async function load() {
  vi.resetModules();
  return import("./mistralClient");
}

const limited = Object.assign(new Error("Status 429 rate_limited"), { statusCode: 429 });
const denied = Object.assign(new Error('API error occurred: Status 403\\nBody: {"type":"tier_not_allowed"}'), { statusCode: 403 });

describe("chatComplete", () => {
  beforeEach(() => {
    complete.mockReset();
    process.env.MISTRAL_API_KEY = "test-key-test-key-test-key";
    delete process.env.MISTRAL_MODEL;
    process.env.MISTRAL_MIN_INTERVAL_MS = "0";
    process.env.MISTRAL_RETRY_BASE_MS = "0";
  });

  it("retries a rate-limited call once on the same model", async () => {
    const m = await load();
    complete.mockRejectedValueOnce(limited).mockResolvedValueOnce({ choices: [] });
    await m.chatComplete({ messages: [] });
    expect(complete.mock.calls.map((c) => c[0].model)).toEqual(Array(2).fill("mistral-large-latest"));
  });

  it("moves on from a model whose quota is used up and skips it while it cools down", async () => {
    const m = await load();
    complete.mockImplementation(async (req: { model: string }) => {
      if (req.model === "mistral-large-latest") throw denied;
      if (req.model !== "open-mistral-nemo") throw limited;
      return { choices: [] };
    });
    await m.chatComplete({ messages: [] });
    expect(complete.mock.calls.map((c) => c[0].model)).toEqual([
      "mistral-large-latest",
      "mistral-medium-latest",
      "mistral-medium-latest",
      "mistral-small-latest",
      "mistral-small-latest",
      "open-mistral-nemo",
    ]);
    complete.mockClear();
    await m.chatComplete({ messages: [] });
    expect(complete.mock.calls.map((c) => c[0].model)).toEqual(["open-mistral-nemo"]);
  });

  it("still tries cooling models when nothing else is left", async () => {
    const m = await load();
    complete.mockRejectedValue(limited);
    await expect(m.chatComplete({ messages: [] })).rejects.toThrow("429");
    complete.mockReset();
    complete.mockResolvedValue({ choices: [] });
    await m.chatComplete({ messages: [] });
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it("spaces requests out", async () => {
    process.env.MISTRAL_MIN_INTERVAL_MS = "60";
    const m = await load();
    const starts: number[] = [];
    complete.mockImplementation(async () => {
      starts.push(Date.now());
      return { choices: [] };
    });
    await Promise.all([m.chatComplete({ messages: [] }), m.chatComplete({ messages: [] })]);
    expect(starts[1] - starts[0]).toBeGreaterThanOrEqual(55);
  });

  it("falls back past models the key's tier can't use and remembers the one that works", async () => {
    const m = await load();
    complete.mockImplementation(async (req: { model: string }) => {
      if (req.model !== "mistral-small-latest") throw denied;
      return { choices: [] };
    });
    await m.chatComplete({ messages: [] });
    expect(complete.mock.calls.map((c) => c[0].model)).toEqual([
      "mistral-large-latest",
      "mistral-medium-latest",
      "mistral-small-latest",
    ]);
    complete.mockClear();
    await m.chatComplete({ messages: [] });
    expect(complete.mock.calls.map((c) => c[0].model)).toEqual(["mistral-small-latest"]);
  });

  it("tries a pinned MISTRAL_MODEL first and rethrows non-model errors", async () => {
    process.env.MISTRAL_MODEL = "open-mistral-nemo";
    const m = await load();
    complete.mockRejectedValueOnce(new Error("Status 500"));
    await expect(m.chatComplete({ messages: [] })).rejects.toThrow("Status 500");
    expect(complete.mock.calls[0][0].model).toBe("open-mistral-nemo");
  });

  it("starts fast tasks on a small model and reports the model and tokens to the run", async () => {
    const m = await load();
    const { newMeter, runWithMeter } = await import("./runMeter");
    complete.mockResolvedValue({ choices: [], usage: { promptTokens: 120, completionTokens: 30 } });
    const meter = newMeter("exercise_coach");
    await runWithMeter(meter, () => m.chatComplete({ messages: [] }));
    expect(complete.mock.calls[0][0].model).toBe("mistral-small-latest");
    expect(meter).toMatchObject({ calls: 1, model: "mistral-small-latest", inputTokens: 120, outputTokens: 30, errorCode: null });

    const deep = newMeter("analyst");
    await runWithMeter(deep, () => m.chatComplete({ messages: [] }));
    expect(complete.mock.calls[1][0].model).toBe("mistral-large-latest");
  });

  it("honours a per-tier pin and marks a rate-limited run", async () => {
    process.env.MISTRAL_MODEL_FAST = "ministral-8b-latest";
    const m = await load();
    const { newMeter, runWithMeter } = await import("./runMeter");
    complete.mockRejectedValue(limited);
    const meter = newMeter("coach.intro");
    await expect(runWithMeter(meter, () => m.chatComplete({ messages: [] }))).rejects.toThrow("429");
    expect(complete.mock.calls[0][0].model).toBe("ministral-8b-latest");
    expect(meter.errorCode).toBe("RATE_LIMITED");
    delete process.env.MISTRAL_MODEL_FAST;
  });

  it("recognises tier and unknown-model errors", async () => {
    const m = await load();
    expect(m.isModelDenied(denied)).toBe(true);
    expect(m.isModelDenied(new Error("Status 404 invalid_model"))).toBe(true);
    expect(m.isModelDenied(new Error("Status 429"))).toBe(false);
  });
});
