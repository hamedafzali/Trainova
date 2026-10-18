// @vitest-environment node
// /api/ai/analyst against a real (in-process) Postgres, with the model mocked:
// the evidence comes from the synced document, invented numbers are rejected,
// and results are cached per data version.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import { createTestPool } from "@/test/pgPool";
import { runMigrations } from "./migrations";

let pool: Pool;
let close: () => Promise<void>;
const completeJson = vi.fn();

vi.mock("@/server/db", () => ({ getPool: () => pool }));
vi.mock("@/lib/cache/redisClient", () => ({
  getRedisClient: () => {
    throw new Error("redis unavailable");
  },
}));
vi.mock("@/services/ai/llm", async (orig) => ({
  ...(await orig<typeof import("@/services/ai/llm")>()),
  completeJson: (...args: unknown[]) => completeJson(...args),
}));

const ORIGIN = "http://trainova.test";
const TODAY = new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

function post(body: unknown, cookie: string, extra: Record<string, string> = {}) {
  return new Request(ORIGIN + "/api/ai/analyst", {
    method: "POST",
    headers: { host: "trainova.test", origin: ORIGIN, "content-type": "application/json", cookie, ...extra },
    body: JSON.stringify(body),
  });
}

let n = 0;
async function account(): Promise<{ cookie: string; id: string }> {
  const { POST } = await import("@/app/api/auth/signup/route");
  process.env.TRUST_PROXY = "1";
  const email = `analyst${++n}@example.com`;
  const res = await POST(
    new Request(ORIGIN + "/api/auth/signup", {
      method: "POST",
      headers: { host: "trainova.test", origin: ORIGIN, "content-type": "application/json", "x-forwarded-for": `10.1.0.${n}` },
      body: JSON.stringify({ email, password: "correct horse battery" }),
    }),
  );
  const cookie = `tv_session=${/tv_session=([^;]*)/.exec(res.headers.get("set-cookie") ?? "")![1]}`;
  const id = (await pool.query("select id from users where email = $1", [email])).rows[0].id as string;
  await pool.query("update users set ai_consent_at = now() where id = $1", [id]);
  return { cookie, id };
}

function doc(weights: number[]) {
  const sessions = weights.map((_, i) => ({
    id: `s${i}`,
    owner: "u",
    templateId: null,
    title: "W",
    date: daysAgo(3 + (weights.length - 1 - i) * 5),
    status: "completed",
    startedAt: "",
    completedAt: "",
    reopenedAt: null,
    updatedAt: "",
  }));
  const sets = weights.map((w, i) => ({
    id: `x${i}`,
    owner: "u",
    sessionId: `s${i}`,
    exerciseId: "squat",
    deviceId: null,
    setIndex: 0,
    targetReps: null,
    targetWeight: null,
    actualReps: 5,
    actualWeight: w,
    rpe: null,
    completed: true,
    completedAt: null,
  }));
  return {
    units: "kg",
    sessions,
    sets,
    exercises: [{ id: "squat", owner: null, name: "Back Squat", defaultDeviceId: null, isCompound: true, primaryMuscle: "quads" }],
    devices: [],
    profile: { coaching: { daysPerWeek: 2 } },
  };
}

async function store(id: string, data: unknown, version = 1) {
  await pool.query(
    `insert into user_state (user_id, data, updated_at, version) values ($1, $2, now(), $3)
     on conflict (user_id) do update set data = excluded.data, version = excluded.version`,
    [id, JSON.stringify(data), version],
  );
}

beforeAll(async () => {
  process.env.JWT_SECRET = "x".repeat(48);
  process.env.MISTRAL_API_KEY = "k".repeat(32);
  ({ pool, close } = await createTestPool());
  await runMigrations(pool);
});

afterAll(async () => {
  delete process.env.MISTRAL_API_KEY;
  await close();
});

beforeEach(async () => {
  completeJson.mockReset();
  await pool.query("delete from users");
});

describe("POST /api/ai/analyst", () => {
  it("builds evidence from the synced document and keeps a reply that cites only facts", async () => {
    const { cookie, id } = await account();
    await store(id, doc([100, 105, 110, 115]));
    completeJson.mockResolvedValue({
      summary: "4 workouts and your squat is climbing.",
      points: [{ title: "Squat up", detail: "Estimated 1RM reached 134 kg.", factIds: ["lift.0.end"] }],
    });
    const { POST } = await import("@/app/api/ai/analyst/route");
    // A body that tries to supply its own data is ignored.
    const res = await POST(post({ weeks: 4, today: TODAY, sessions: [], evidence: { facts: [] } }, cookie) as never);
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.fallback).toBeNull();
    expect(j.interpretation).toMatchObject({ source: "ai", summary: "4 workouts and your squat is climbing." });
    expect(j.evidence.consistency.sessions).toBe(4);
    expect(j.evidence.lifts[0]).toMatchObject({ name: "Back Squat", status: "improving", endE1rm: 134 });
    // The prompt carried the facts, not raw history.
    const prompt = completeJson.mock.calls[0][0][1].content as string;
    expect(prompt).toContain("lift.0.end = 134 kg");
  });

  it("falls back to the rule-based reading when the model invents a number", async () => {
    const { cookie, id } = await account();
    await store(id, doc([100, 105, 110, 115]));
    completeJson.mockResolvedValue({
      summary: "Aim for 150 kg next month.",
      points: [{ title: "Squat", detail: "Keep going.", factIds: ["lift.0.end"] }],
    });
    const { POST } = await import("@/app/api/ai/analyst/route");
    const j = await (await POST(post({ weeks: 4, today: TODAY }, cookie) as never)).json();
    expect(j.fallback).toBe("invalid");
    expect(j.interpretation.source).toBe("rules");
    expect(JSON.stringify(j.interpretation)).not.toContain("150");
  });

  it("caches per data version", async () => {
    const { cookie, id } = await account();
    await store(id, doc([100, 105, 110]));
    completeJson.mockResolvedValue({ summary: "Steady.", points: [{ title: "Squat", detail: "Climbing.", factIds: ["lift.0.end"] }] });
    const { POST } = await import("@/app/api/ai/analyst/route");
    const call = async () => (await POST(post({ weeks: 8, today: TODAY }, cookie) as never)).json();
    expect((await call()).cached).toBe(false);
    expect((await call()).cached).toBe(true);
    expect(completeJson).toHaveBeenCalledTimes(1);
    await store(id, doc([100, 105, 110, 115]), 2);
    const fresh = await call();
    expect(fresh).toMatchObject({ cached: false, dataVersion: 2 });
    expect(completeJson).toHaveBeenCalledTimes(2);
  });

  it("doesn't call the model without data, rejects bad periods and needs consent", async () => {
    const { cookie, id } = await account();
    const { POST } = await import("@/app/api/ai/analyst/route");
    const empty = await (await POST(post({ weeks: 4, today: TODAY }, cookie) as never)).json();
    expect(empty.fallback).toBe("no_data");
    expect(completeJson).not.toHaveBeenCalled();
    expect((await POST(post({ weeks: 5 }, cookie) as never)).status).toBe(400);
    await pool.query("update users set ai_consent_at = null where id = $1", [id]);
    expect((await POST(post({ weeks: 4 }, cookie) as never)).status).toBe(403);
  });
});
