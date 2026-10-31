// Native stand-in for src/lib/library.ts: same call, absolute URL.
import type { Device, Exercise } from "@/domain/types";
import { apiFetch } from "./auth";

export async function fetchLibrary(): Promise<{ devices: Device[]; exercises: Exercise[] } | null> {
  try {
    const r = await apiFetch("/api/library");
    if (!r.ok) return null;
    const j = await r.json();
    if (!Array.isArray(j.devices) || !Array.isArray(j.exercises)) return null;
    if (j.devices.length === 0) return null;
    return j;
  } catch {
    return null;
  }
}
