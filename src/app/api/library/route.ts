import { NextResponse } from "next/server";
import { getPool } from "@/server/db";
import { ensureLibrary, getLibrary } from "@/server/library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public: the shared equipment/exercise catalog. Clients merge it over their
// local seed so admin edits reach everyone.
export async function GET() {
  const pool = getPool();
  if (!pool) return NextResponse.json({ devices: [], exercises: [] });
  await ensureLibrary(pool);
  const lib = await getLibrary(pool);
  return NextResponse.json(lib);
}
