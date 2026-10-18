import { NextResponse } from "next/server";
import { getPool } from "@/server/db";
import { getSessionUser, unauthorized } from "@/server/session";
import { checkRateLimit } from "@/server/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXPORT_FORMAT = "trainova-export/1";

// Everything stored about the account, as one JSON download (data portability).
// Password hashes and session/reset tokens are never included.
export async function GET(req: Request) {
  const pool = getPool();
  if (!pool) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  const user = await getSessionUser(req);
  if (!user) return unauthorized();
  if (await checkRateLimit(`ratelimit:export:${user.userId}`, { windowMs: 3_600_000, max: 10 })) {
    return NextResponse.json({ error: "Too many exports. Try again later." }, { status: 429 });
  }

  const q = (sql: string) => pool.query(sql, [user.userId]).then((r) => r.rows);
  const [account, state, checkins, feedback, links, assignments, aiRuns] = await Promise.all([
    q(`select email, role, created_at, ai_consent_at, ai_consent_version, analytics_opt_out
       from users where id = $1`),
    q("select data, updated_at, version from user_state where user_id = $1"),
    q("select * from daily_checkins where user_id = $1 order by created_at"),
    q("select * from session_feedback where user_id = $1 order by created_at"),
    q(`select t.email as trainer_email, c.status, c.created_at, c.responded_at
       from coach_clients c join users t on t.id = c.trainer_id where c.client_id = $1`),
    q("select name, payload, imported, created_at from assignments where client_id = $1"),
    // Only metadata is stored for AI calls; no prompts or replies.
    q("select * from ai_runs where user_id = $1 order by created_at"),
  ]);

  const strip = (rows: Record<string, unknown>[]) => rows.map(({ user_id: _u, ...rest }) => rest);
  const body = {
    format: EXPORT_FORMAT,
    exportedAt: new Date().toISOString(),
    account: account[0] ?? null,
    trainingData: state[0] ?? null,
    checkins: strip(checkins),
    sessionFeedback: strip(feedback),
    coaches: links,
    assignments,
    aiRuns: strip(aiRuns),
  };
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="trainova-export-${body.exportedAt.slice(0, 10)}.json"`,
      "cache-control": "no-store",
    },
  });
}
