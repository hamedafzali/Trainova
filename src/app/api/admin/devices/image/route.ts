import { NextResponse } from "next/server";
import { getPool } from "@/server/db";
import { requireAdmin } from "@/server/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 2_000_000; // 2 MB

// Admin: upload a photo for a device (stored in Postgres).
export async function POST(req: Request) {
  const pool = getPool();
  if (!pool) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const form = await req.formData().catch(() => null);
  const deviceId = String(form?.get("deviceId") ?? "");
  const file = form?.get("file");
  if (!deviceId || !(file instanceof File)) {
    return NextResponse.json({ error: "deviceId and file required" }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "File must be an image" }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image must be under 2 MB" }, { status: 413 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  await pool.query(
    `insert into device_images (device_id, mime, bytes, updated_at)
     values ($1, $2, $3, now())
     on conflict (device_id) do update set mime = excluded.mime, bytes = excluded.bytes, updated_at = now()`,
    [deviceId, file.type, bytes]
  );
  // Point the device at the served image (cache-busted by updated time).
  const url = `/api/device-image/${deviceId}`;
  await pool.query("update devices set image_url = $1 where id = $2", [url, deviceId]);

  return NextResponse.json({ ok: true, url: `${url}?t=${Date.now()}` });
}
