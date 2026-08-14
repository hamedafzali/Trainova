"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useHydrated, useStore } from "@/lib/store";
import { getToken } from "@/lib/auth";
import { DeviceAvatar } from "@/components/DeviceAvatar";
import type { Device } from "@/domain/types";

const CATEGORIES = ["machine", "free_weight", "cable", "bodyweight", "cardio"];
const LEVELS = ["beginner", "intermediate", "advanced"];

export default function AdminDevicesPage() {
  const hydrated = useHydrated();
  const isAdmin = useStore((s) => s.session?.role === "admin");
  const [devices, setDevices] = useState<Device[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/devices", {
        headers: { authorization: `Bearer ${getToken()}` },
      });
      if (r.ok) setDevices((await r.json()).devices ?? []);
      else setError("Couldn't load the device library.");
    } catch {
      setError("Couldn't load the device library. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (isAdmin) load();
    else setLoading(false);
  }, [hydrated, isAdmin, load]);

  const save = async (d: Device) => {
    const r = await fetch("/api/admin/devices", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${getToken()}` },
      body: JSON.stringify(d),
    });
    if (r.ok) {
      setEditing(null);
      load();
    } else alert("Save failed.");
  };

  if (!hydrated || loading) return <main className="p-4 text-white/50">Loading…</main>;
  if (!isAdmin)
    return (
      <main className="mx-auto max-w-3xl space-y-3 p-4">
        <p className="text-white/50">Admins only.</p>
        <Link href="/" className="text-blue-400 hover:text-blue-300">
          ← Home
        </Link>
      </main>
    );

  return (
    <main className="mx-auto max-w-3xl space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Devices</h1>
          <p className="page-subtitle">Shared equipment library · {devices.length}</p>
        </div>
        <Link href="/admin" className="text-sm text-blue-400 hover:text-blue-300 font-semibold transition-colors">
          ← Admin
        </Link>
      </header>

      <ul className="space-y-3">
        {devices.map((d) =>
          editing === d.id ? (
            <DeviceForm key={d.id} device={d} onCancel={() => setEditing(null)} onSave={save} />
          ) : (
            <li key={d.id} className="card flex items-center gap-3">
              <DeviceAvatar device={d} className="h-11 w-11 rounded-lg text-lg" />
              <div className="flex-1">
                <p className="font-semibold leading-tight text-white">{d.name}</p>
                <p className="text-xs text-white/50 mt-0.5">
                  {d.machineNumber ? `No.${d.machineNumber} · ` : ""}
                  {d.category.replace("_", " ")}
                  {d.primaryMuscle ? ` · ${d.primaryMuscle}` : ""}
                  {d.difficulty ? ` · ${d.difficulty}` : ""}
                </p>
              </div>
              <button className="btn-ghost text-xs" onClick={() => setEditing(d.id)}>
                Edit
              </button>
            </li>
          )
        )}
      </ul>
    </main>
  );
}

function DeviceForm({
  device,
  onCancel,
  onSave,
}: {
  device: Device;
  onCancel: () => void;
  onSave: (d: Device) => void;
}) {
  const [d, setD] = useState<Device>(device);
  const [uploading, setUploading] = useState(false);
  const set = (patch: Partial<Device>) => setD((cur) => ({ ...cur, ...patch }));

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("deviceId", d.id);
      fd.append("file", file);
      const r = await fetch("/api/admin/devices/image", {
        method: "POST",
        headers: { authorization: `Bearer ${getToken()}` },
        body: fd,
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) set({ imageUrl: j.url });
      else alert(j.error ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <li className="card space-y-3">
      <p className="text-sm font-semibold text-white">Edit {device.name}</p>

      <div className="flex items-center gap-3">
        <DeviceAvatar device={d} className="h-16 w-16 rounded-xl text-2xl" />
        <label className="btn-ghost cursor-pointer text-xs">
          {uploading ? "Uploading…" : "Upload photo"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
          />
        </label>
      </div>

      <Field label="Name">
        <input className="input" value={d.name} onChange={(e) => set({ name: e.target.value })} />
      </Field>
      <Field label="Image URL (or upload above)">
        <input
          className="input"
          placeholder="/devices/d-22.svg or https://…"
          value={d.imageUrl ?? ""}
          onChange={(e) => set({ imageUrl: e.target.value || null })}
        />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Machine no.">
          <input
            className="input"
            value={d.machineNumber ?? ""}
            onChange={(e) => set({ machineNumber: e.target.value || null })}
          />
        </Field>
        <Field label="Muscle">
          <input
            className="input"
            value={d.primaryMuscle ?? ""}
            onChange={(e) => set({ primaryMuscle: e.target.value || null })}
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Category">
          <select
            className="input"
            value={d.category}
            onChange={(e) => set({ category: e.target.value as Device["category"] })}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c.replace("_", " ")}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Difficulty">
          <select
            className="input"
            value={d.difficulty ?? ""}
            onChange={(e) => set({ difficulty: (e.target.value || null) as Device["difficulty"] })}
          >
            <option value="">—</option>
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Guidance">
        <textarea
          className="input"
          rows={2}
          value={d.guidance ?? ""}
          onChange={(e) => set({ guidance: e.target.value || null })}
        />
      </Field>
      <div className="flex gap-2">
        <button className="btn-ghost flex-1" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn-primary flex-1" onClick={() => onSave(d)}>
          Save
        </button>
      </div>
    </li>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs text-muted">{label}</span>
      {children}
    </label>
  );
}
