import { getPool } from "@/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public: serve a device photo stored in Postgres.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const pool = getPool();
  if (!pool) return new Response("Not found", { status: 404 });

  const r = await pool.query("select mime, bytes from device_images where device_id = $1", [
    params.id,
  ]);
  const row = r.rows[0];
  if (!row) return new Response("Not found", { status: 404 });

  const body = new Uint8Array(row.bytes as Buffer) as unknown as BodyInit;
  return new Response(body, {
    headers: {
      "content-type": row.mime as string,
      "cache-control": "public, max-age=3600",
    },
  });
}
