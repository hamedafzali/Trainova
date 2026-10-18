// @vitest-environment node
// Route handlers against a real (in-process) Postgres: sessions, sync
// concurrency, trainer consent, AI consent and account deletion.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import { createTestPool } from "@/test/pgPool";
import { runMigrations } from "./migrations";

let pool: Pool;
let close: () => Promise<void>;

vi.mock("@/server/db", () => ({ getPool: () => pool }));
// No Redis in tests: every call fails, so the in-memory limiter is exercised.
vi.mock("@/lib/cache/redisClient", () => ({
  getRedisClient: () => {
    throw new Error("redis unavailable");
  },
}));

const ORIGIN = "http://trainova.test";

function req(path: string, init: { method?: string; body?: unknown; cookie?: string | null; raw?: string } = {}) {
  const headers: Record<string, string> = { host: "trainova.test", origin: ORIGIN };
  if (init.cookie) headers.cookie = init.cookie;
  if (init.body !== undefined || init.raw !== undefined) headers["content-type"] = "application/json";
  return new Request(ORIGIN + path, {
    method: init.method ?? "GET",
    headers,
    body: init.raw ?? (init.body !== undefined ? JSON.stringify(init.body) : undefined),
  });
}

function cookieFrom(res: Response): string {
  const set = res.headers.get("set-cookie") ?? "";
  const m = /tv_session=([^;]*)/.exec(set);
  if (!m) throw new Error("no session cookie set");
  return `tv_session=${m[1]}`;
}

let ipCounter = 0;
async function signup(email: string, password = "correct horse battery") {
  const { POST } = await import("@/app/api/auth/signup/route");
  // Distinct client per signup so the per-IP limiter doesn't interfere.
  process.env.TRUST_PROXY = "1";
  const r = new Request(ORIGIN + "/api/auth/signup", {
    method: "POST",
    headers: { host: "trainova.test", origin: ORIGIN, "content-type": "application/json", "x-forwarded-for": `10.0.0.${++ipCounter}` },
    body: JSON.stringify({ email, password }),
  });
  const res = await POST(r);
  expect(res.status).toBe(200);
  const id = (await pool.query("select id from users where email = $1", [email])).rows[0].id as string;
  return { cookie: cookieFrom(res), id };
}

beforeAll(async () => {
  process.env.JWT_SECRET = "x".repeat(48);
  ({ pool, close } = await createTestPool());
  await runMigrations(pool);
});

afterAll(async () => {
  await close();
});

beforeEach(async () => {
  await pool.query("delete from users");
});

describe("sessions", () => {
  it("issues an HttpOnly cookie that authenticates, and logout everywhere revokes it", async () => {
    const { cookie } = await signup("a@example.com");
    const me = await import("@/app/api/auth/me/route");
    const ok = await me.GET(req("/api/auth/me", { cookie }));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ email: "a@example.com", role: "user", aiConsent: null });

    const { POST: logout } = await import("@/app/api/auth/logout/route");
    await logout(req("/api/auth/logout", { method: "POST", body: { everywhere: true }, cookie }));
    expect((await me.GET(req("/api/auth/me", { cookie }))).status).toBe(401);
  });

  it("rejects cookie-authenticated writes from another origin", async () => {
    const { cookie } = await signup("b@example.com");
    const { PUT } = await import("@/app/api/state/route");
    const r = new Request(ORIGIN + "/api/state", {
      method: "PUT",
      headers: { host: "trainova.test", origin: "https://evil.example", cookie, "content-type": "application/json" },
      body: JSON.stringify({ data: {} }),
    });
    expect((await PUT(r)).status).toBe(401);
  });

  it("set-cookie is HttpOnly and SameSite=Lax", async () => {
    const { POST } = await import("@/app/api/auth/login/route");
    await signup("c@example.com");
    const res = await POST(req("/api/auth/login", { method: "POST", body: { email: "c@example.com", password: "correct horse battery" } }));
    expect(res.status).toBe(200);
    const set = res.headers.get("set-cookie") ?? "";
    expect(set).toMatch(/HttpOnly/i);
    expect(set).toMatch(/SameSite=lax/i);
    expect(await res.json()).not.toHaveProperty("token");
  });
});

describe("PUT /api/state", () => {
  it("uses compare-and-set on the version and returns the current copy on conflict", async () => {
    const { cookie } = await signup("s@example.com");
    const { GET, PUT } = await import("@/app/api/state/route");
    const put = (body: unknown) => PUT(req("/api/state", { method: "PUT", body, cookie }));

    const first = await put({ data: { sessions: [] } });
    expect(first.status).toBe(200);
    expect((await first.json()).version).toBe(1);

    // A row exists now: writing without proof of having seen it conflicts.
    const blind = await put({ data: { sessions: [] } });
    expect(blind.status).toBe(409);
    expect((await blind.json()).version).toBe(1);

    const second = await put({ data: { units: "lb" }, baseVersion: 1 });
    expect((await second.json()).version).toBe(2);

    const stale = await put({ data: { units: "kg" }, baseVersion: 1 });
    expect(stale.status).toBe(409);
    expect((await stale.json()).data).toEqual({ units: "lb" });

    const pulled = await (await GET(req("/api/state", { cookie }))).json();
    expect(pulled).toMatchObject({ data: { units: "lb" }, version: 2 });
  });

  it("rejects implausible data and oversized payloads without storing them", async () => {
    const { cookie } = await signup("v@example.com");
    const { PUT } = await import("@/app/api/state/route");
    const bad = await PUT(
      req("/api/state", { method: "PUT", cookie, body: { data: { sets: [{ id: "s1", actualWeight: 99999 }] } } })
    );
    expect(bad.status).toBe(422);
    const huge = await PUT(
      req("/api/state", { method: "PUT", cookie, raw: JSON.stringify({ data: { notes: "x".repeat(5 * 1024 * 1024 + 10) } }) })
    );
    expect(huge.status).toBe(413);
    expect((await pool.query("select count(*)::int as n from user_state")).rows[0].n).toBe(0);
  });
});

describe("trainer invitations", () => {
  it("needs the client's acceptance and doesn't reveal whether an email exists", async () => {
    const trainer = await signup("coach@example.com");
    await pool.query("update users set role = 'trainer' where id = $1", [trainer.id]);
    const client = await signup("member@example.com");

    const clients = await import("@/app/api/trainer/clients/route");
    const invite = (email: string) =>
      clients.POST(req("/api/trainer/clients", { method: "POST", body: { email }, cookie: trainer.cookie }));
    const known = await invite("member@example.com");
    const unknown = await invite("nobody@example.com");
    expect(known.status).toBe(unknown.status);
    expect(await known.json()).toEqual(await unknown.json());

    const progress = await import("@/app/api/trainer/progress/route");
    const view = () =>
      progress.GET(req(`/api/trainer/progress?clientId=${client.id}`, { cookie: trainer.cookie }));
    expect((await view()).status).toBe(403); // still pending

    const coaches = await import("@/app/api/account/coaches/route");
    const listed = await (await coaches.GET(req("/api/account/coaches", { cookie: client.cookie }))).json();
    expect(listed.links).toEqual([expect.objectContaining({ trainerEmail: "coach@example.com", status: "pending" })]);

    const answer = (action: string) =>
      coaches.POST(req("/api/account/coaches", { method: "POST", body: { trainerId: trainer.id, action }, cookie: client.cookie }));
    expect((await answer("accept")).status).toBe(200);
    expect((await view()).status).toBe(200);

    expect((await answer("revoke")).status).toBe(200);
    expect((await view()).status).toBe(403);
    // Revoking again is not a valid transition.
    expect((await answer("revoke")).status).toBe(404);
  });

  it("validates assigned plans", async () => {
    const trainer = await signup("coach2@example.com");
    await pool.query("update users set role = 'trainer' where id = $1", [trainer.id]);
    const client = await signup("member2@example.com");
    await pool.query("insert into coach_clients (trainer_id, client_id, status) values ($1, $2, 'active')", [
      trainer.id,
      client.id,
    ]);
    const { POST } = await import("@/app/api/trainer/assign/route");
    const assign = (payload: unknown) =>
      POST(req("/api/trainer/assign", { method: "POST", body: { clientId: client.id, payload }, cookie: trainer.cookie }));
    expect((await assign({ name: "Day A", exercises: [] })).status).toBe(400);
    expect(
      (await assign({ name: "Day A", exercises: [{ name: "Squat", sets: [{ targetReps: 5, targetWeight: 5000 }] }] })).status
    ).toBe(400);
    expect(
      (await assign({ name: "Day A", notes: null, exercises: [{ name: "Squat", muscle: "quads", sets: [{ targetReps: 5, targetWeight: 100 }] }] }))
        .status
    ).toBe(200);
  });
});

describe("AI consent", () => {
  it("is enforced server-side until the user allows data sharing", async () => {
    const { cookie } = await signup("ai@example.com");
    const { authorizeAiRequest } = await import("./aiGuard");
    const before = await authorizeAiRequest(req("/api/ai/review", { method: "POST", cookie }));
    expect("response" in before && before.response.status).toBe(403);

    const { POST } = await import("@/app/api/account/privacy/route");
    await POST(req("/api/account/privacy", { method: "POST", body: { aiConsent: true }, cookie }));
    const after = await authorizeAiRequest(req("/api/ai/review", { method: "POST", cookie }));
    expect("user" in after).toBe(true);
  });
});

describe("account deletion", () => {
  it("requires the password and removes the account with its events", async () => {
    const { cookie, id } = await signup("bye@example.com");
    await pool.query("insert into product_events (user_id, event_name) values ($1, 'workout_finished')", [id]);
    const { DELETE } = await import("@/app/api/account/route");
    const wrong = await DELETE(req("/api/account", { method: "DELETE", body: { password: "nope nope nope" }, cookie }));
    expect(wrong.status).toBe(403);

    const ok = await DELETE(req("/api/account", { method: "DELETE", body: { password: "correct horse battery" }, cookie }));
    expect(ok.status).toBe(200);
    expect((await pool.query("select count(*)::int as n from users where id = $1", [id])).rows[0].n).toBe(0);
    expect((await pool.query("select count(*)::int as n from product_events")).rows[0].n).toBe(0);
  });
});
