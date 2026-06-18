"use client";

import type { Device, Exercise } from "@/domain/types";

/** Fetch the central shared library; null on error/offline (keep local seed). */
export async function fetchLibrary(): Promise<{
  devices: Device[];
  exercises: Exercise[];
} | null> {
  try {
    const r = await fetch("/api/library");
    if (!r.ok) return null;
    const j = await r.json();
    if (!Array.isArray(j.devices) || !Array.isArray(j.exercises)) return null;
    if (j.devices.length === 0) return null;
    return j;
  } catch {
    return null;
  }
}
