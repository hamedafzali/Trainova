import { NextResponse } from "next/server";
import { getPool } from "@/server/db";
import { requireAdmin } from "@/server/admin";
import { ensureLibrary, getLibrary, updateDevice } from "@/server/library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Admin: full library (devices + exercises) for editing.
export async function GET(req: Request) {
  const pool = getPool();
  if (!pool) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await ensureLibrary(pool);
  return NextResponse.json(await getLibrary(pool));
}

// Admin: update a device's editable fields.
export async function POST(req: Request) {
  const pool = getPool();
  if (!pool) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  const id = body.id as string;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const ok = await updateDevice(pool, id, body);
  if (!ok) return NextResponse.json({ error: "Device not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
