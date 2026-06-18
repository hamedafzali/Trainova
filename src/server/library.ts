import type { Pool } from "pg";
import { SEED_DEVICES, SEED_EXERCISES } from "@/lib/seed";
import type { Device, Exercise } from "@/domain/types";

// Seed the central library from the app's seed data the first time it's read.
export async function ensureLibrary(pool: Pool): Promise<void> {
  const c = await pool.query("select count(*)::int as n from devices");
  if (c.rows[0].n > 0) return;

  for (const d of SEED_DEVICES) {
    await pool.query(
      `insert into devices (id, owner, name, machine_number, category, image_url, primary_muscle, difficulty, guidance)
       values ($1, null, $2, $3, $4, $5, $6, $7, $8) on conflict (id) do nothing`,
      [d.id, d.name, d.machineNumber, d.category, d.imageUrl, d.primaryMuscle, d.difficulty ?? null, d.guidance ?? null]
    );
  }
  for (const e of SEED_EXERCISES) {
    await pool.query(
      `insert into exercises (id, owner, name, default_device_id, is_compound, primary_muscle)
       values ($1, null, $2, $3, $4, $5) on conflict (id) do nothing`,
      [e.id, e.name, e.defaultDeviceId, e.isCompound, e.primaryMuscle]
    );
  }
}

function toDevice(r: Record<string, unknown>): Device {
  return {
    id: r.id as string,
    owner: (r.owner as string) ?? null,
    name: r.name as string,
    machineNumber: (r.machine_number as string) ?? null,
    category: r.category as Device["category"],
    imageUrl: (r.image_url as string) ?? null,
    primaryMuscle: (r.primary_muscle as string) ?? null,
    difficulty: (r.difficulty as Device["difficulty"]) ?? null,
    guidance: (r.guidance as string) ?? null,
  };
}

function toExercise(r: Record<string, unknown>): Exercise {
  return {
    id: r.id as string,
    owner: (r.owner as string) ?? null,
    name: r.name as string,
    defaultDeviceId: (r.default_device_id as string) ?? null,
    isCompound: Boolean(r.is_compound),
    primaryMuscle: (r.primary_muscle as string) ?? null,
  };
}

export async function getLibrary(pool: Pool): Promise<{ devices: Device[]; exercises: Exercise[] }> {
  const d = await pool.query("select * from devices order by name");
  const e = await pool.query("select * from exercises order by name");
  return { devices: d.rows.map(toDevice), exercises: e.rows.map(toExercise) };
}

const DEVICE_FIELDS: Record<string, string> = {
  name: "name",
  machineNumber: "machine_number",
  category: "category",
  imageUrl: "image_url",
  primaryMuscle: "primary_muscle",
  difficulty: "difficulty",
  guidance: "guidance",
};

/** Update editable fields of a device. Returns false if it doesn't exist. */
export async function updateDevice(
  pool: Pool,
  id: string,
  patch: Record<string, unknown>
): Promise<boolean> {
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [key, col] of Object.entries(DEVICE_FIELDS)) {
    if (key in patch) {
      values.push(patch[key] === "" ? null : patch[key]);
      sets.push(`${col} = $${values.length}`);
    }
  }
  if (sets.length === 0) return true;
  values.push(id);
  const r = await pool.query(
    `update devices set ${sets.join(", ")} where id = $${values.length}`,
    values
  );
  return (r.rowCount ?? 0) > 0;
}
