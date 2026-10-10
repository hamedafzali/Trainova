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

const denied = Object.assign(new Error('API error occurred: Status 403\\nBody: {"type":"tier_not_allowed"}'), { statusCode: 403 });

describe("chatComplete", () => {
  beforeEach(() => {
    complete.mockReset();
    process.env.MISTRAL_API_KEY = "test-key-test-key-test-key";
    delete process.env.MISTRAL_MODEL;
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

  it("recognises tier and unknown-model errors", async () => {
    const m = await load();
    expect(m.isModelDenied(denied)).toBe(true);
    expect(m.isModelDenied(new Error("Status 404 invalid_model"))).toBe(true);
    expect(m.isModelDenied(new Error("Status 429"))).toBe(false);
  });
});
