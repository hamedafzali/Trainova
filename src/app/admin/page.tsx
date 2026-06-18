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

export default function AdminPage() {
  const hydrated = useHydrated();
  const isAdmin = useStore((s) => s.session?.role === "admin");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const t = getToken();
    if (!t) return;
    const r = await fetch("/api/admin/users", { headers: { authorization: `Bearer ${t}` } });
    if (!r.ok) {
      setError("Not authorized.");
      setLoading(false);
      return;
    }
    const j = await r.json();
    setUsers(j.users ?? []);
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
