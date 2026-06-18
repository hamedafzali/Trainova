"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useHydrated, useStore } from "@/lib/store";
import { getToken } from "@/lib/auth";

type AdminUser = {
  id: string;
  email: string;
  role: string;
  created_at: string;
  has_state: string;
};

type Stats = {
  users: number;
  admins: number;
  trainers: number;
  withData: number;
  new7d: number;
  new30d: number;
  workouts: number;
  setsLogged: number;
  active7d: number;
  devices: number;
};

export default function AdminPage() {
  const hydrated = useHydrated();
  const isAdmin = useStore((s) => s.session?.role === "admin");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const t = getToken();
    if (!t) return;
    const auth = { authorization: `Bearer ${t}` };
    const [u, s] = await Promise.all([
      fetch("/api/admin/users", { headers: auth }),
      fetch("/api/admin/stats", { headers: auth }),
    ]);
    if (!u.ok) {
      setError("Not authorized.");
      setLoading(false);
      return;
    }
    setUsers((await u.json()).users ?? []);
    if (s.ok) setStats(await s.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (isAdmin) load();
    else setLoading(false);
  }, [hydrated, isAdmin, load]);

  const resetPassword = async (u: AdminUser) => {
    const pw = prompt(`New password for ${u.email} (6+ chars):`);
    if (!pw) return;
    const r = await fetch("/api/admin/reset-password", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ userId: u.id, password: pw }),
    });
    alert(r.ok ? "Password updated." : "Failed to update password.");
  };

  const deleteUser = async (u: AdminUser) => {
    if (!confirm(`Delete ${u.email} and all their data? This can’t be undone.`)) return;
    const r = await fetch("/api/admin/delete-user", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ userId: u.id }),
    });
    if (r.ok) load();
    else alert("Failed to delete user.");
  };

  if (!hydrated || loading) return <main className="p-4 text-muted">Loading…</main>;

  if (!isAdmin) {
    return (
      <main className="space-y-3 p-4">
        <h1 className="text-2xl font-bold">Admin</h1>
        <p className="text-muted">Admins only.</p>
        <Link href="/" className="text-accent">
          ← Home
        </Link>
      </main>
    );
  }

  return (
    <main className="space-y-4 p-4">
      <header className="flex items-center justify-between pt-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin</h1>
          <p className="text-sm text-muted">{users.length} users</p>
        </div>
        <Link href="/profile" className="text-sm text-accent">
          Done
        </Link>
      </header>

      {stats && (
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Users" value={stats.users} sub={`+${stats.new7d} this wk`} />
          <Stat label="Active 7d" value={stats.active7d} sub="trained" />
          <Stat label="Workouts" value={stats.workouts} sub="completed" />
          <Stat label="Sets" value={stats.setsLogged} sub="logged" />
          <Stat label="Trainers" value={stats.trainers} sub={`${stats.admins} admin`} />
          <Stat label="Devices" value={stats.devices} sub="in library" />
        </div>
      )}

      <Link href="/admin/devices" className="btn-ghost w-full">
        🏋️ Manage device library
      </Link>

      {error && <p className="text-sm text-danger">{error}</p>}

      <ul className="space-y-2">
        {users.map((u) => (
          <li key={u.id} className="card space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{u.email}</p>
                <p className="text-xs text-muted">
                  {u.role}
                  {u.role === "admin" ? " ★" : ""} · joined{" "}
                  {new Date(u.created_at).toLocaleDateString()} ·{" "}
                  {Number(u.has_state) > 0 ? "has data" : "no data"}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="btn-ghost flex-1 text-xs" onClick={() => resetPassword(u)}>
                Reset password
              </button>
              <button className="btn-danger flex-1 text-xs" onClick={() => deleteUser(u)}>
                Delete user
              </button>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}

function Stat({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div className="card p-3 text-center">
      <p className="text-2xl font-bold tabular-nums">{value.toLocaleString()}</p>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-inkSoft">{label}</p>
      <p className="text-[10px] text-muted">{sub}</p>
    </div>
  );
}
