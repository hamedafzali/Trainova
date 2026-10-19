// @vitest-environment node
// /api/ai/exercise-coach against a real (in-process) Postgres, with the model
// mocked: the context comes from the synced document, invented numbers and
// machine settings are rejected, red-flag questions never reach the model.
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

function post(body: unknown, cookie: string) {
  return new Request(ORIGIN + "/api/ai/exercise-coach", {
    method: "POST",
    headers: { host: "trainova.test", origin: ORIGIN, "content-type": "application/json", cookie },
    body: JSON.stringify(body),
  });
}

let n = 0;
async function account(): Promise<{ cookie: string; id: string }> {
  const { POST } = await import("@/app/api/auth/signup/route");
  process.env.TRUST_PROXY = "1";
  const email = `excoach${++n}@example.com`;
  const res = await POST(
    new Request(ORIGIN + "/api/auth/signup", {
      method: "POST",
      headers: { host: "trainova.test", origin: ORIGIN, "content-type": "application/json", "x-forwarded-for": `10.2.0.${n}` },
      body: JSON.stringify({ email, password: "correct horse battery" }),
    }),
  );
  const cookie = `tv_session=${/tv_session=([^;]*)/.exec(res.headers.get("set-cookie") ?? "")![1]}`;
  const id = (await pool.query("select id from users where email = $1", [email])).rows[0].id as string;
  await pool.query("update users set ai_consent_at = now() where id = $1", [id]);
  return { cookie, id };
}

const set = (sessionId: string, i: number, w: number | null, r: number | null, rpe: number | null, completed = true) => ({
  id: `${sessionId}-${i}`,
  owner: "u",
  sessionId,
  exerciseId: "lp",
  deviceId: "d-lp",
  setIndex: i,
  targetReps: 8,
  targetWeight: 100,
  actualReps: r,
  actualWeight: w,
  rpe,
  completed,
  completedAt: null,
});

/** One earlier leg-press session and a live one with a near-max first set. */
function doc() {
  return {
    units: "kg",
    sessions: [
      { id: "old", owner: "u", templateId: "t1", title: "Legs", date: "2026-10-11", status: "completed", startedAt: "2026-10-11T10:00:00Z", completedAt: "", reopenedAt: null, updatedAt: "" },
      { id: "now", owner: "u", templateId: "t1", title: "Legs", date: "2026-10-18", status: "active", startedAt: "2026-10-18T10:00:00Z", completedAt: null, reopenedAt: null, updatedAt: "" },
    ],
    sets: [set("old", 0, 95, 9, null), set("now", 0, 100, 8, 10), set("now", 1, null, null, null, false)],
    exercises: [
      { id: "lp", owner: null, name: "Leg Press", defaultDeviceId: "d-lp", isCompound: true, primaryMuscle: "quads", equipment: "machine" },
      { id: "hack", owner: null, name: "Hack Squat", defaultDeviceId: null, isCompound: true, primaryMuscle: "quads", equipment: "plate_loaded" },
    ],
    devices: [{ id: "d-lp", owner: null, name: "Leg Press", machineNumber: "22", category: "machine", primaryMuscle: "quads", guidance: null, loading: "stack" }],
    templates: [
      {
        id: "t1",
        owner: "u",
        name: "Legs",
        notes: null,
        exercises: [
          { exerciseId: "lp", deviceId: "d-lp", sets: [{ targetReps: 8, targetWeight: 100 }, { targetReps: 8, targetWeight: 100 }], restSeconds: 90, repMax: 10, substitution: "Hack Squat" },
        ],
      },
    ],
    profile: { coaching: { equipment: "gym" } },
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

describe("POST /api/ai/exercise-coach", () => {
  it("assesses from the synced document and keeps a grounded reply", async () => {
    const { cookie, id } = await account();
    await store(id, doc());
    completeJson.mockResolvedValue({ answer: "That was RPE 10. Drop to 95 kg and get 8 clean reps.", cues: ["Control the bottom"] });
    const { POST } = await import("@/app/api/ai/exercise-coach/route");
    // A body that tries to supply its own sets is ignored.
    const res = await POST(post({ sessionId: "now", exerciseId: "lp", sets: [{ actualWeight: 500 }] }, cookie) as never);
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.fallback).toBeNull();
    expect(j.reading).toMatchObject({ source: "ai", cues: ["Control the bottom"] });
    expect(j.evidence.assessment).toMatchObject({ status: "struggling", next: { action: "reduce", weight: 95, reps: 8 } });
    expect(j.evidence.substitutions[0]).toMatchObject({ exerciseId: "hack", fromPlan: true });
    const prompt = completeJson.mock.calls[0][0][1].content as string;
    expect(prompt).toContain("next.weight = 95 kg");
    expect(prompt).toContain("QUESTION: none");
  });

  it("falls back to the rule-based reading on invented numbers or machine settings", async () => {
    const { cookie, id } = await account();
    await store(id, doc());
    const { POST } = await import("@/app/api/ai/exercise-coach/route");
    completeJson.mockResolvedValueOnce({ answer: "Go to 140 kg." });
    const a = await (await POST(post({ sessionId: "now", exerciseId: "lp" }, cookie) as never)).json();
    expect(a).toMatchObject({ fallback: "invalid", reading: { source: "rules" } });
    expect(a.reading.answer).not.toContain("140");
    completeJson.mockResolvedValueOnce({ answer: "Put the seat at 4 and drop the weight." });
    const b = await (await POST(post({ sessionId: "now", exerciseId: "lp", question: "How do I set it up?" }, cookie) as never)).json();
    expect(b.fallback).toBe("invalid");
  });

  it("answers red-flag questions with a stop message and no model call", async () => {
    const { cookie, id } = await account();
    await store(id, doc());
    const { POST } = await import("@/app/api/ai/exercise-coach/route");
    const j = await (await POST(post({ sessionId: "now", exerciseId: "lp", question: "I get a sharp pain in my knee" }, cookie) as never)).json();
    expect(j.fallback).toBe("red_flag");
    expect(j.reading.answer).toMatch(/^Stop/);
    expect(completeJson).not.toHaveBeenCalled();
  });

  it("caches per data version and question, and validates input", async () => {
    const { cookie, id } = await account();
    await store(id, doc());
    completeJson.mockResolvedValue({ answer: "Drop to 95 kg." });
    const { POST } = await import("@/app/api/ai/exercise-coach/route");
    const call = async (q?: string) => (await POST(post({ sessionId: "now", exerciseId: "lp", question: q }, cookie) as never)).json();
    expect((await call()).cached).toBe(false);
    expect((await call()).cached).toBe(true);
    expect((await call("Why lower?")).cached).toBe(false);
    expect(completeJson).toHaveBeenCalledTimes(2);
    await store(id, doc(), 2);
    expect(await call()).toMatchObject({ cached: false, dataVersion: 2 });

    expect((await POST(post({ sessionId: "now" }, cookie) as never)).status).toBe(400);
    expect((await POST(post({ sessionId: "nope", exerciseId: "lp" }, cookie) as never)).status).toBe(404);
    await pool.query("update users set ai_consent_at = null where id = $1", [id]);
    expect((await POST(post({ sessionId: "now", exerciseId: "lp" }, cookie) as never)).status).toBe(403);
  });
});
