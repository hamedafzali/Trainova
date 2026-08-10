import { NextResponse } from "next/server";
import { getPool } from "@/server/db";
import { requireTrainer } from "@/server/trainer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SnapshotSession = { status?: string; completedAt?: string; startedAt?: string };
type SnapshotFeedback = {
  difficulty?: string;
  energy?: number;
  pain?: string | null;
  createdAt?: string;
};

export async function GET(request: Request) {
  const pool = getPool();
  if (!pool) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  const trainerId = await requireTrainer(request, pool);
  if (!trainerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const result = await pool.query(
    `select c.client_id, u.email, us.data
     from coach_clients c
     join users u on u.id = c.client_id
     left join user_state us on us.user_id = c.client_id
     where c.trainer_id = $1 and c.status = 'active'`,
    [trainerId],
  );
  const now = Date.now();
  const attention: Array<{
    clientId: string;
    email: string;
    severity: "high" | "medium";
    type: "pain" | "fatigue" | "inactive";
    message: string;
  }> = [];

  for (const row of result.rows) {
    const data = (row.data ?? {}) as { sessions?: SnapshotSession[]; feedback?: SnapshotFeedback[] };
    const sessions = Array.isArray(data.sessions) ? data.sessions : [];
    const latestCompleted = sessions
      .filter((session) => session.status === "completed")
      .sort((a, b) => String(b.completedAt ?? b.startedAt).localeCompare(String(a.completedAt ?? a.startedAt)))[0];
    const feedback = Array.isArray(data.feedback) ? data.feedback : [];
    const latestFeedback = feedback.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0];
    const base = { clientId: row.client_id as string, email: row.email as string };

    if (latestFeedback?.pain) {
      attention.push({ ...base, severity: "high", type: "pain", message: "Reported pain or a limitation in the latest workout." });
      continue;
    }
    if (latestFeedback?.difficulty === "hard" || (latestFeedback?.energy ?? 5) <= 2) {
      attention.push({ ...base, severity: "medium", type: "fatigue", message: "Latest check-in indicates elevated fatigue." });
      continue;
    }
    const lastAt = latestCompleted?.completedAt ?? latestCompleted?.startedAt;
    if (!lastAt || now - new Date(lastAt).getTime() > 7 * 24 * 60 * 60 * 1000) {
      attention.push({ ...base, severity: "medium", type: "inactive", message: "No completed workout in the last seven days." });
    }
  }

  return NextResponse.json({ attention });
}
